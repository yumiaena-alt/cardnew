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
 * @param url - The fully built request URL, access token included.
 * @param label - What the call was for. Logged when it is refused.
 * @returns The decoded body, or null when the call did not succeed.
 */
export async function getGraph(url: string, label: string): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS) }).catch(
    () => null,
  );

  if (!response?.ok) {
    logger.warn('Graph request failed', { label, status: response?.status ?? 0 });

    return null;
  }

  return await response.json();
}
