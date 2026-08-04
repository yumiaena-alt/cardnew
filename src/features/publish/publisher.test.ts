import { afterEach, describe, expect, it, vi } from 'vitest';
import { publishToInstagram } from './publisher';

/**
 * The publish call, driven against a stubbed network.
 *
 * This is the one path that acts in public under a user's own name, and it has
 * never run for real — there is no connected account yet. Until there is, the
 * shape of what it would send is the only thing that can be checked, and it is
 * worth checking: a carousel assembled wrongly does not fail, it posts.
 */

type Call = { url: string; body: string };

/**
 * Answers Graph writes in sequence and records what was sent.
 *
 * @param responses - Bodies to return, in call order.
 * @returns The recorded calls.
 */
function stubGraph(responses: { ok?: boolean; body: unknown }[]): Call[] {
  const calls: Call[] = [];
  let index = 0;

  vi.stubGlobal('fetch', async (url: string, init?: { body?: string }) => {
    calls.push({ url, body: init?.body ?? '' });
    const next = responses[index] ?? responses.at(-1);
    index += 1;

    return await Promise.resolve({
      ok: next?.ok ?? true,
      status: (next?.ok ?? true) ? 200 : 400,
      json: async () => await Promise.resolve(next?.body),
    });
  });

  return calls;
}

const base = { accountExternalId: '17841', accessToken: 'token', caption: '여름 신메뉴' };

/** A container id for each creation call, then the published post, then its link. */
const HAPPY = [
  { body: { id: 'container_1' } },
  { body: { id: 'container_2' } },
  { body: { id: 'container_3' } },
  { body: { id: 'container_4' } },
  { body: { id: 'post_1' } },
  { body: { permalink: 'https://instagram.com/p/abc' } },
];

describe(publishToInstagram, () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // A carousel needs at least two children, so a one-card deck posted as one
  // would be refused by the network.
  it('posts a single card as an image rather than a carousel of one', async () => {
    const calls = stubGraph([
      { body: { id: 'container_1' } },
      { body: { id: 'post_1' } },
      { body: { permalink: 'https://instagram.com/p/abc' } },
    ]);

    const result = await publishToInstagram({ ...base, imageUrls: ['https://img/1.jpg'] });

    expect(result).toMatchObject({ ok: true, externalPostId: 'post_1' });
    expect(calls[0]?.body).toContain('image_url');
    expect(calls[0]?.body).not.toContain('is_carousel_item');
  });

  it('builds a child per card and one carousel parent', async () => {
    const calls = stubGraph(HAPPY);

    await publishToInstagram({
      ...base,
      imageUrls: ['https://img/1.jpg', 'https://img/2.jpg', 'https://img/3.jpg'],
    });

    const children = calls.filter((call) => call.body.includes('is_carousel_item'));
    const parent = calls.find((call) => call.body.includes('CAROUSEL'));

    expect(children).toHaveLength(3);
    expect(parent?.body).toContain('container_1%2Ccontainer_2%2Ccontainer_3');
  });

  // The caption belongs on the parent. On a child it is silently dropped, which
  // publishes a post with no words at all.
  it('puts the caption on the carousel, not on its children', async () => {
    const calls = stubGraph(HAPPY);

    await publishToInstagram({ ...base, imageUrls: ['https://img/1.jpg', 'https://img/2.jpg'] });

    const children = calls.filter((call) => call.body.includes('is_carousel_item'));

    expect(children.every((call) => !call.body.includes('caption'))).toBeTruthy();
    expect(calls.find((call) => call.body.includes('CAROUSEL'))?.body).toContain('caption');
  });

  // Ten is the network's limit. Sending eleven fails the whole post, so a long
  // deck is trimmed and the caller is told how much was left behind.
  it('trims a deck longer than the carousel limit and says how much', async () => {
    stubGraph([
      ...Array.from({ length: 12 }, () => ({ body: { id: 'c' } })),
      { body: { id: 'p' } },
    ]);

    const result = await publishToInstagram({
      ...base,
      imageUrls: Array.from({ length: 12 }, (_, index) => `https://img/${index}.jpg`),
    });

    expect(result).toMatchObject({ ok: true, skippedPanels: 2 });
  });

  it('stops before publishing when a container is refused', async () => {
    const calls = stubGraph([
      { ok: false, body: { error: { message: 'Media could not be fetched' } } },
    ]);

    const result = await publishToInstagram({ ...base, imageUrls: ['https://img/1.jpg'] });

    expect(result).toStrictEqual({ ok: false, error: 'Media could not be fetched' });
    expect(calls.every((call) => !call.url.includes('media_publish'))).toBeTruthy();
  });

  // A post exists whether or not its link came back, so a missing permalink is
  // not a reason to report a failed publish.
  it('keeps the post when its link cannot be read', async () => {
    stubGraph([
      { body: { id: 'container_1' } },
      { body: { id: 'post_1' } },
      { ok: false, body: {} },
    ]);

    const result = await publishToInstagram({ ...base, imageUrls: ['https://img/1.jpg'] });

    expect(result).toMatchObject({ ok: true, permalink: null });
  });

  it('refuses a deck with no cards rather than posting an empty one', async () => {
    stubGraph(HAPPY);

    await expect(publishToInstagram({ ...base, imageUrls: [] })).resolves.toStrictEqual({
      ok: false,
      error: 'no_images',
    });
  });
});
