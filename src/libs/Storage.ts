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
