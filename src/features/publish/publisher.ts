import { getGraph, GRAPH_BASE, postGraph } from '@/features/social/graph';

/**
 * Putting a deck on Instagram.
 *
 * The network does this in two moves: a container is created from the images
 * and the caption, and then published. They are separate calls because the
 * network fetches every image itself, which can take longer than one request
 * should — which also means the images have to be reachable from the outside
 * for the whole of that fetch.
 */

/** The network's own carousel limit. A deck longer than this is truncated. */
const MAX_CAROUSEL_ITEMS = 10;

export type PublishResult =
  | { ok: true; externalPostId: string; permalink: string | null; skippedPanels: number }
  | { ok: false; error: string };

export type PublishInput = {
  accountExternalId: string;
  accessToken: string;
  /** Publicly fetchable image URLs, in reading order. */
  imageUrls: string[];
  caption: string;
};

/**
 * Reads an id out of a Graph write response.
 *
 * @param data - The decoded body.
 * @returns The id, or null when the body carries none.
 */
function readId(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || !('id' in data)) {
    return null;
  }

  return typeof data.id === 'string' ? data.id : null;
}

/**
 * Creates one media container.
 *
 * @param input - Account, token, and the container's fields.
 * @returns The container id, or the provider's reason for refusing.
 */
async function createContainer(input: {
  accountExternalId: string;
  accessToken: string;
  fields: Record<string, string>;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const result = await postGraph({
    path: `${input.accountExternalId}/media`,
    body: input.fields,
    accessToken: input.accessToken,
    label: 'media container',
  });

  if (!result.ok) {
    return result;
  }

  const id = readId(result.data);

  return id ? { ok: true, id } : { ok: false, error: 'container_without_id' };
}

/**
 * Builds the container that will be published.
 *
 * A single card is posted as an image, not as a carousel of one — the network
 * rejects a carousel with fewer than two children, and a one-card deck is a
 * normal thing to make.
 *
 * @param input - The account, its token, the images, and the caption.
 * @returns The container id, or why it could not be built.
 */
async function buildContainer(
  input: PublishInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const [first, ...rest] = input.imageUrls;

  if (!first) {
    return { ok: false, error: 'no_images' };
  }

  if (rest.length === 0) {
    return await createContainer({
      accountExternalId: input.accountExternalId,
      accessToken: input.accessToken,
      fields: { image_url: first, caption: input.caption },
    });
  }

  const children: string[] = [];

  for (const imageUrl of input.imageUrls) {
    // Sequential on purpose: the network rate-limits container creation, and a
    // burst of ten gets refused where ten in a row does not.
    const child = await createContainer({
      accountExternalId: input.accountExternalId,
      accessToken: input.accessToken,
      fields: { image_url: imageUrl, is_carousel_item: 'true' },
    });

    if (!child.ok) {
      return child;
    }

    children.push(child.id);
  }

  return await createContainer({
    accountExternalId: input.accountExternalId,
    accessToken: input.accessToken,
    fields: {
      media_type: 'CAROUSEL',
      children: children.join(','),
      caption: input.caption,
    },
  });
}

/**
 * Reads the public link of a post that just went out.
 *
 * A missing link is not a failure. The post exists either way, and the link is
 * a convenience for the user rather than something the record depends on.
 *
 * @param postId - The published post.
 * @param accessToken - The account's token.
 * @returns The permalink, or null.
 */
async function readPermalink(postId: string, accessToken: string): Promise<string | null> {
  const payload = await getGraph(
    `${GRAPH_BASE}/${postId}?fields=permalink`,
    'permalink',
    accessToken,
  );

  if (typeof payload !== 'object' || payload === null || !('permalink' in payload)) {
    return null;
  }

  return typeof payload.permalink === 'string' ? payload.permalink : null;
}

/**
 * Publishes a deck as one post.
 *
 * @param input - The account, its token, the rendered images, and the caption.
 * @returns The post's id and link, or the provider's reason for refusing.
 */
export async function publishToInstagram(input: PublishInput): Promise<PublishResult> {
  const imageUrls = input.imageUrls.slice(0, MAX_CAROUSEL_ITEMS);
  const container = await buildContainer({ ...input, imageUrls });

  if (!container.ok) {
    return container;
  }

  const published = await postGraph({
    path: `${input.accountExternalId}/media_publish`,
    body: { creation_id: container.id },
    accessToken: input.accessToken,
    label: 'media publish',
  });

  if (!published.ok) {
    return published;
  }

  const externalPostId = readId(published.data);

  if (!externalPostId) {
    return { ok: false, error: 'publish_without_id' };
  }

  return {
    ok: true,
    externalPostId,
    permalink: await readPermalink(externalPostId, input.accessToken),
    skippedPanels: input.imageUrls.length - imageUrls.length,
  };
}
