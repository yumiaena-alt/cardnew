import { Env } from './Env';

/**
 * Supabase Storage access over the REST API.
 *
 * The REST endpoints are used directly rather than through `@supabase/supabase-js`:
 * upload and sign are the only two operations the generation pipeline needs, and
 * both are one `fetch` each, so the client would be a dependency carried for
 * nothing.
 *
 * The service role key is used, which bypasses row-level security. Nothing here
 * may ever run outside the server — object paths are derived from ids resolved
 * on the server, never from a request body.
 */

/** Rendered panel images. Private; reads go through a signed URL. */
export const RENDER_BUCKET = 'renders';

const UPLOAD_TIMEOUT_MS = 30_000;

type StorageConfig = {
  url: string;
  key: string;
};

/**
 * Reads the storage credentials, failing loudly when they are absent.
 *
 * @returns The configured base URL and service role key.
 * @throws Error when storage is not configured in this environment.
 */
function requireConfig(): StorageConfig {
  if (!(Env.SUPABASE_URL && Env.SUPABASE_SERVICE_ROLE_KEY)) {
    throw new Error('Supabase storage is not configured');
  }

  return { url: Env.SUPABASE_URL, key: Env.SUPABASE_SERVICE_ROLE_KEY };
}

export type UploadInput = {
  bucket: string;
  /** Object path inside the bucket. Built from server-resolved ids only. */
  path: string;
  body: ArrayBuffer;
  contentType: string;
};

/**
 * Uploads an object, replacing any existing one at the same path.
 *
 * Upsert rather than insert because a retried run re-renders the same panel:
 * failing on the second attempt would leave a run unable to finish after a
 * transient error.
 *
 * @param input - Bucket, path, bytes, and content type.
 * @returns The stored path, for writing onto the owning row.
 * @throws Error when storage is unconfigured or the upload is rejected.
 */
export async function uploadObject(input: UploadInput): Promise<string> {
  const config = requireConfig();

  const response = await fetch(`${config.url}/storage/v1/object/${input.bucket}/${input.path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${config.key}`,
      'content-type': input.contentType,
      'x-upsert': 'true',
    },
    // A Blob rather than the raw buffer: it carries the content type with it and
    // types cleanly as a body, which a bare typed array does not.
    body: new Blob([input.body], { type: input.contentType }),
    signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Storage upload failed with ${response.status}`);
  }

  return input.path;
}

/** Long enough for one editing session, short enough that a leaked link dies. */
const DEFAULT_SIGNED_URL_TTL_SECONDS = 3600;

/**
 * Creates a time-limited URL for a private object.
 *
 * The render bucket is private, so this is the only way a browser sees a
 * generated panel. Signing per request rather than making the bucket public
 * keeps one tenant's cards from being readable by anyone who guesses a path.
 *
 * @param bucket - Bucket the object lives in.
 * @param path - Object path inside the bucket.
 * @param expiresInSeconds - Lifetime of the URL.
 * @returns An absolute signed URL.
 * @throws Error when storage is unconfigured or the object cannot be signed.
 */
export async function createSignedUrl(
  bucket: string,
  path: string,
  expiresInSeconds: number = DEFAULT_SIGNED_URL_TTL_SECONDS,
): Promise<string> {
  const config = requireConfig();

  const response = await fetch(`${config.url}/storage/v1/object/sign/${bucket}/${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${config.key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ expiresIn: expiresInSeconds }),
    signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Storage sign failed with ${response.status}`);
  }

  const payload: unknown = await response.json();

  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('signedURL' in payload) ||
    typeof payload.signedURL !== 'string'
  ) {
    throw new Error('Storage sign returned no URL');
  }

  return `${config.url}/storage/v1${payload.signedURL}`;
}

/**
 * Builds the storage path for one rendered panel.
 *
 * Paths are namespaced by organization so a misdirected read cannot reach
 * another tenant's images even if the bucket is ever made public by mistake.
 *
 * @param input - Organization, deck version, and panel index.
 * @returns The object path inside the render bucket.
 */
export function panelRenderPath(input: {
  orgId: string;
  versionId: string;
  index: number;
}): string {
  return `${input.orgId}/${input.versionId}/${input.index}.png`;
}

/**
 * Builds the storage path for a deck's stitched video.
 *
 * Namespaced beside the cards it was built from, so a deleted version takes its
 * video with it rather than leaving an orphan nobody will ever look for.
 *
 * @param input - Organization and deck version.
 * @returns The object path inside the render bucket.
 */
export function deckVideoPath(input: { orgId: string; versionId: string }): string {
  return `${input.orgId}/${input.versionId}/reel.mp4`;
}
