import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { logger } from '@/libs/Logger';

/**
 * Reads an article from a user-supplied link.
 *
 * The URL comes from a text box and is fetched by our server, which is the
 * textbook shape of a server-side request forgery: without the checks below,
 * anyone could point this at a private address or a cloud metadata endpoint and
 * have us fetch it for them. Every hop is resolved and screened before the
 * request goes out.
 */

/** Enough for a long article; past this the page is not an article. */
const MAX_BYTES = 2_000_000;
const FETCH_TIMEOUT_MS = 15_000;

/** Redirects are followed by hand so each hop can be screened, not just the first. */
const MAX_REDIRECTS = 3;

/** What the planner can actually use. Beyond this the model just pays for filler. */
const MAX_EXTRACTED_CHARS = 4000;

export type Article = {
  url: string;
  title: string;
  text: string;
};

export type IngestFailure =
  | 'invalid_url'
  | 'blocked_host'
  | 'unreachable'
  | 'unsupported_content'
  | 'empty_content';

export type IngestResult = { ok: true; article: Article } | { ok: false; reason: IngestFailure };

/**
 * Whether an IP belongs to a range that must never be fetched.
 *
 * Covers loopback, link-local — which is where cloud metadata lives — and the
 * private IPv4 and IPv6 ranges.
 *
 * @param ip - The resolved address.
 * @returns True when the address is not public.
 */
const PRIVATE_IPV6_PREFIXES = ['fc', 'fd', 'fe80'];

/** First octet values that are private or reserved on their own. */
const RESERVED_FIRST_OCTETS = new Set([0, 10, 127]);

/** Ranges that depend on the second octet too, as [first, min, max]. */
const RESERVED_RANGES: [number, number, number][] = [
  [172, 16, 31],
  [192, 168, 168],
  [169, 254, 254],
  [100, 64, 127],
];

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);

  if (parts.length !== 4 || parts.some(Number.isNaN)) {
    return false;
  }

  const [first = 0, second = 0] = parts;

  if (RESERVED_FIRST_OCTETS.has(first)) {
    return true;
  }

  return RESERVED_RANGES.some(
    ([octet, min, max]) => first === octet && second >= min && second <= max,
  );
}

function isPrivateAddress(ip: string): boolean {
  if (ip === '::1' || PRIVATE_IPV6_PREFIXES.some((prefix) => ip.startsWith(prefix))) {
    return true;
  }

  return isPrivateIpv4(ip);
}

/** Resolves a hostname to its addresses. Injected so the screen is testable. */
export type HostResolver = (host: string) => Promise<string[]>;

/**
 * Resolves through the system resolver.
 *
 * @param host - The hostname to resolve.
 * @returns Every address the name answers with.
 */
async function resolveHost(host: string): Promise<string[]> {
  const answers = await lookup(host, { all: true });

  return answers.map((entry) => entry.address);
}

/**
 * Screens one URL: https only, and a host that resolves to a public address.
 *
 * @param raw - The URL to check.
 * @param resolve - How to resolve a hostname.
 * @returns The parsed URL, or the reason it was refused.
 */
async function screenUrl(
  raw: string,
  resolve: HostResolver,
): Promise<{ ok: true; url: URL } | { ok: false; reason: IngestFailure }> {
  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: 'invalid_url' };
  }

  if (url.protocol !== 'https:') {
    return { ok: false, reason: 'invalid_url' };
  }

  // A URL keeps IPv6 literals in brackets, and `isIP` does not recognise that
  // form. Left as-is, `https://[::1]/` would slip past the literal check and be
  // sent to the resolver, which is exactly the bypass this screen exists to stop.
  const host = url.hostname.replaceAll(/^\[|\]$/gu, '');

  if (isIP(host) !== 0) {
    return isPrivateAddress(host) ? { ok: false, reason: 'blocked_host' } : { ok: true, url };
  }

  const resolved = await resolve(host).catch(() => null);

  if (!resolved || resolved.length === 0) {
    return { ok: false, reason: 'unreachable' };
  }

  // Every resolved address must be public. One private answer is enough to
  // refuse, since which one the socket picks is not ours to decide.
  if (resolved.some(isPrivateAddress)) {
    return { ok: false, reason: 'blocked_host' };
  }

  return { ok: true, url };
}

/**
 * Pulls the readable text out of an HTML document.
 *
 * Deliberately simple: scripts and styles go, block tags become breaks, tags
 * are dropped and whitespace collapses. A real readability pass would be a
 * dependency, and what the planner needs is prose, not structure.
 *
 * @param html - The raw document.
 * @returns The title and body text.
 */
function extractText(html: string): { title: string; text: string } {
  const withoutScripts = html
    .replaceAll(/<script[\s\S]*?<\/script>/giu, ' ')
    .replaceAll(/<style[\s\S]*?<\/style>/giu, ' ')
    .replaceAll(/<noscript[\s\S]*?<\/noscript>/giu, ' ');

  const titleMatch = withoutScripts.match(/<title[^>]*>([\s\S]*?)<\/title>/iu);
  const article = withoutScripts.match(/<article[\s\S]*?<\/article>/iu)?.[0] ?? withoutScripts;

  const text = article
    .replaceAll(/<\/(p|div|section|h[1-6]|li|br)[^>]*>/giu, '\n')
    .replaceAll(/<[^>]+>/gu, ' ')
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll(/[ \t]+/gu, ' ')
    .replaceAll(/\n{3,}/gu, '\n\n')
    .trim();

  return {
    title: (titleMatch?.[1] ?? '').replaceAll(/<[^>]+>/gu, '').trim(),
    text: text.slice(0, MAX_EXTRACTED_CHARS),
  };
}

/**
 * Fetches and extracts an article, screening every redirect hop.
 *
 * @param rawUrl - The link the user pasted.
 * @param resolve - How to resolve a hostname. Defaults to the system resolver.
 * @returns The extracted article, or why it could not be read.
 */
export async function fetchArticle(
  rawUrl: string,
  resolve: HostResolver = resolveHost,
): Promise<IngestResult> {
  let target = rawUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const screened = await screenUrl(target, resolve);

    if (!screened.ok) {
      return { ok: false, reason: screened.reason };
    }

    const response = await fetch(screened.url, {
      redirect: 'manual',
      headers: { accept: 'text/html,application/xhtml+xml' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    }).catch(() => null);

    if (!response) {
      return { ok: false, reason: 'unreachable' };
    }

    const location = response.headers.get('location');

    if (response.status >= 300 && response.status < 400 && location) {
      target = new URL(location, screened.url).toString();
      continue;
    }

    if (!response.ok) {
      return { ok: false, reason: 'unreachable' };
    }

    if (!(response.headers.get('content-type') ?? '').includes('html')) {
      return { ok: false, reason: 'unsupported_content' };
    }

    const length = Number(response.headers.get('content-length') ?? '0');

    if (length > MAX_BYTES) {
      return { ok: false, reason: 'unsupported_content' };
    }

    const body = await response.text();
    const html = body.slice(0, MAX_BYTES);
    const { title, text } = extractText(html);

    if (text.length < 100) {
      return { ok: false, reason: 'empty_content' };
    }

    logger.info('Article ingested', { chars: text.length });

    return { ok: true, article: { url: screened.url.toString(), title, text } };
  }

  return { ok: false, reason: 'unreachable' };
}
