import { logger } from '@/libs/Logger';

/**
 * The one place the Graph API version and timeout are decided.
 *
 * Both the connection flow and the reply path talk to the same API, and a
 * version that drifts between them would mean a payload shape verified against
 * one endpoint and guessed at for the other.
 */

export const GRAPH_BASE = 'https://graph.facebook.com/v21.0';

/** Long enough for a slow provider, short enough that a webhook still answers. */
export const GRAPH_TIMEOUT_MS = 15_000;

/**
 * Calls the Graph API and decodes the body.
 *
 * @param url - The fully built request URL.
 * @param label - What the call was for. Logged when it is refused.
 * @param accessToken - Sent as a bearer header when given. A stored token goes
 * here rather than in the query string, which would put it in proxy logs.
 * @returns The decoded body, or null when the call did not succeed.
 */
export async function getGraph(url: string, label: string, accessToken?: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
  }).catch(() => null);

  if (!response?.ok) {
    logger.warn('Graph request failed', { label, status: response?.status ?? 0 });

    return null;
  }

  return await response.json();
}

/**
 * Reads a Graph error into something short enough to store.
 *
 * The provider's own wording is kept: most refusals here are conditions only
 * the user can fix — a comment too old to answer, an image the network could
 * not fetch — and a message of ours would say less.
 *
 * @param payload - The decoded error body.
 * @returns The provider's message, or a fallback.
 */
export function readGraphError(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null || !('error' in payload)) {
    return 'unknown_error';
  }

  const { error } = payload;

  if (typeof error === 'object' && error !== null && 'message' in error) {
    return typeof error.message === 'string' ? error.message.slice(0, 300) : 'unknown_error';
  }

  return 'unknown_error';
}

/**
 * Posts to the Graph API.
 *
 * @param input - Path, form fields, the account's token, and a label for logs.
 * @returns The decoded body, or the provider's reason for refusing.
 */
export async function postGraph(input: {
  path: string;
  body: Record<string, string>;
  accessToken: string;
  label: string;
}): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  const response = await fetch(`${GRAPH_BASE}/${input.path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(input.body).toString(),
    signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
  }).catch(() => null);

  if (!response) {
    return { ok: false, error: 'network_error' };
  }

  if (!response.ok) {
    logger.warn('Graph write refused', { label: input.label, status: response.status });

    return { ok: false, error: readGraphError(await response.json().catch(() => null)) };
  }

  return { ok: true, data: await response.json() };
}
