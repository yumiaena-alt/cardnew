import type { SlideDoc } from '@/lib/slidedoc/doc';
import { Env } from './Env';

/**
 * Client for the render service (`services/render`).
 *
 * Rendering runs as a separate process because it needs a real browser: the
 * layout engine measures text in a live DOM, which is the only way autofit and
 * collision detection can be trusted. Vercel cannot host that, so it lives on
 * its own host and is reached over HTTP.
 */

/** One panel is a single browser screenshot; a slow one is still under a minute. */
const RENDER_TIMEOUT_MS = 60_000;

/**
 * High enough that type edges stay clean, low enough that a photographic card
 * lands around 300KB instead of the 10MB the same card costs as a PNG.
 */
const JPEG_QUALITY = 88;

export type PanelFormat = 'png' | 'jpeg';

/** What a rendered panel is stored as. Instagram only accepts JPEG. */
export const PANEL_CONTENT_TYPE = 'image/jpeg';
export const PANEL_EXTENSION = 'jpg';

export type RenderedPanel = {
  bytes: ArrayBuffer;
  /** Cache key covering every input that changes the pixels. */
  docHash: string;
  /** Layers whose text did not fit. Copy is too long for the layout. */
  overflows: string[];
  /** Layer pairs that overlap. The composition needs adjusting. */
  collisions: string[];
};

type RenderConfig = {
  url: string;
  token: string;
};

/**
 * Reads the render service configuration.
 *
 * @returns The service base URL and shared secret.
 * @throws Error when the render service is not configured.
 */
function requireConfig(): RenderConfig {
  if (!(Env.RENDER_SERVICE_URL && Env.RENDER_SERVICE_TOKEN)) {
    throw new Error('Render service is not configured');
  }

  return { url: Env.RENDER_SERVICE_URL, token: Env.RENDER_SERVICE_TOKEN };
}

/**
 * Splits a comma-separated warning header into its entries.
 *
 * @param value - Raw header value, or null when the header is absent.
 * @returns The entries, or an empty array.
 */
function parseWarningHeader(value: string | null): string[] {
  if (!value) {
    return [];
  }

  return value.split(',').filter((entry) => entry !== '');
}

/**
 * Renders one slide document to an image.
 *
 * JPEG by default, not PNG. A card carrying a photograph costs about 10MB as a
 * PNG and a few hundred KB as a JPEG, and Instagram refuses both an image over
 * 8MB and any format other than JPEG — so a PNG card is one that cannot be
 * published at all.
 *
 * Typesetting warnings come back alongside the image rather than as failures:
 * a panel whose headline overflows is still a panel, and the caller decides
 * whether to shorten the copy or accept it.
 *
 * @param doc - The slide document to render.
 * @param scale - Render multiplier over the 1080px logical width.
 * @param format - Output format. JPEG unless a caller needs losslessness.
 * @returns The image bytes, its hash, and any typesetting warnings.
 * @throws Error when the service is unconfigured, unreachable, or rejects the document.
 */
export async function renderPanel(
  doc: SlideDoc,
  scale = 1,
  format: PanelFormat = 'jpeg',
): Promise<RenderedPanel> {
  const config = requireConfig();

  const response = await fetch(`${config.url}/render`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${config.token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      doc,
      format,
      scale,
      ...(format === 'jpeg' ? { quality: JPEG_QUALITY } : {}),
    }),
    signal: AbortSignal.timeout(RENDER_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Render service responded ${response.status}`);
  }

  return {
    bytes: await response.arrayBuffer(),
    docHash: response.headers.get('x-doc-hash') ?? '',
    overflows: parseWarningHeader(response.headers.get('x-overflows')),
    collisions: parseWarningHeader(response.headers.get('x-collisions')),
  };
}

/** Stitching twenty cards is a long job on a small host, so it gets its own budget. */
const VIDEO_TIMEOUT_MS = 240_000;

/**
 * Stitches rendered cards into one video.
 *
 * The reel this product makes is our own cards moving, which is why it is built
 * from the images we already rendered rather than asked of a generative video
 * API: a generated clip has nothing to do with the deck it came from, so it
 * would not be a fan-out of anything. It also costs nothing extra per second.
 *
 * @param images - Rendered card bytes, in reading order.
 * @param secondsPerSlide - How long each card stays on screen.
 * @returns The video bytes and its length in seconds.
 * @throws Error when the service is unconfigured, unreachable, or has no ffmpeg.
 */
export async function renderVideo(
  images: ArrayBuffer[],
  secondsPerSlide?: number,
): Promise<{ bytes: ArrayBuffer; durationSeconds: number }> {
  const config = requireConfig();

  const response = await fetch(`${config.url}/video`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${config.token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      images: images.map((image) => Buffer.from(image).toString('base64')),
      ...(secondsPerSlide === undefined ? {} : { secondsPerSlide }),
    }),
    signal: AbortSignal.timeout(VIDEO_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Render service responded ${response.status}`);
  }

  return {
    bytes: await response.arrayBuffer(),
    durationSeconds: Number(response.headers.get('x-duration-seconds') ?? 0),
  };
}

/**
 * Checks that the render service is up.
 *
 * Used before a batch starts: discovering the renderer is down after charging
 * for fifty cards is worse than refusing the run.
 *
 * @returns True when the service answers its health check.
 */
export async function isRenderServiceReachable(): Promise<boolean> {
  if (!(Env.RENDER_SERVICE_URL && Env.RENDER_SERVICE_TOKEN)) {
    return false;
  }

  const response = await fetch(`${Env.RENDER_SERVICE_URL}/health`, {
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);

  return response?.ok ?? false;
}
