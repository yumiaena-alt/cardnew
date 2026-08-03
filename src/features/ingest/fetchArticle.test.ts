import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// oxlint-disable eslint/require-await -- these doubles stand in for async APIs
// (the DNS resolver, fetch), so their signatures must match even though the
// canned values they return resolve synchronously.
import { fetchArticle } from './fetchArticle';

// The resolver is passed in rather than mocked, so the screen can be tested
// against addresses that must never be fetched without depending on what a real
// resolver happens to answer for a name.
const dns = { addresses: ['93.184.216.34'] };
// oxlint-disable-next-line eslint/require-await -- matches the async resolver contract
const resolve = async () => dns.addresses;

const HTML = `<html><head><title>여름 신메뉴</title></head><body><article><p>${'가'.repeat(200)}</p></article></body></html>`;

function htmlResponse(body = HTML) {
  return new Response(body, { status: 200, headers: { 'content-type': 'text/html' } });
}

describe(fetchArticle, () => {
  beforeEach(() => {
    dns.addresses = ['93.184.216.34'];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Every case below is a way to make our server fetch something on someone
  // else's behalf. The point of the screen is that none of them get out.
  describe('request forgery screen', () => {
    it('refuses a plain http link', async () => {
      await expect(fetchArticle('http://example.com/a', resolve)).resolves.toMatchObject({
        reason: 'invalid_url',
      });
    });

    it('refuses a link that is not a url at all', async () => {
      await expect(fetchArticle('not a url', resolve)).resolves.toMatchObject({
        reason: 'invalid_url',
      });
    });

    it('refuses loopback by literal address', async () => {
      await expect(fetchArticle('https://127.0.0.1/a', resolve)).resolves.toMatchObject({
        reason: 'blocked_host',
      });
    });

    it('refuses a private range by literal address', async () => {
      await expect(fetchArticle('https://10.1.2.3/a', resolve)).resolves.toMatchObject({
        reason: 'blocked_host',
      });
    });

    it('refuses the cloud metadata address', async () => {
      await expect(
        fetchArticle('https://169.254.169.254/latest/meta-data', resolve),
      ).resolves.toMatchObject({ reason: 'blocked_host' });
    });

    it('refuses IPv6 loopback', async () => {
      await expect(fetchArticle('https://[::1]/a', resolve)).resolves.toMatchObject({
        reason: 'blocked_host',
      });
    });

    it('refuses a public name that resolves to a private address', async () => {
      dns.addresses = ['192.168.0.5'];

      await expect(fetchArticle('https://internal.example.com/a', resolve)).resolves.toMatchObject({
        reason: 'blocked_host',
      });
    });

    it('refuses when only one of several answers is private', async () => {
      dns.addresses = ['93.184.216.34', '10.0.0.9'];

      await expect(fetchArticle('https://mixed.example.com/a', resolve)).resolves.toMatchObject({
        reason: 'blocked_host',
      });
    });

    it('screens a redirect target, not just the first hop', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(
          async () =>
            new Response(null, { status: 302, headers: { location: 'https://127.0.0.1/inner' } }),
        ),
      );

      await expect(fetchArticle('https://example.com/a', resolve)).resolves.toMatchObject({
        reason: 'blocked_host',
      });
    });
  });

  describe('extraction', () => {
    it('reads the title and body of an article', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => htmlResponse()),
      );

      const result = await fetchArticle('https://example.com/a', resolve);

      expect(result).toMatchObject({ ok: true });
      expect(result.ok && result.article.title).toBe('여름 신메뉴');
    });

    it('drops script contents rather than treating them as prose', async () => {
      const withScript = `<html><head><title>t</title></head><body><article><script>var secret='leak';</script><p>${'나'.repeat(200)}</p></article></body></html>`;

      vi.stubGlobal(
        'fetch',
        vi.fn(async () => htmlResponse(withScript)),
      );

      const result = await fetchArticle('https://example.com/a', resolve);

      expect(result.ok && result.article.text).not.toContain('leak');
    });

    it('refuses a page that is not html', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(
          async () =>
            new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
        ),
      );

      await expect(fetchArticle('https://example.com/a.json', resolve)).resolves.toMatchObject({
        reason: 'unsupported_content',
      });
    });

    it('refuses a page with almost no body text', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => htmlResponse('<html><body><p>hi</p></body></html>')),
      );

      await expect(fetchArticle('https://example.com/a', resolve)).resolves.toMatchObject({
        reason: 'empty_content',
      });
    });
  });
});
