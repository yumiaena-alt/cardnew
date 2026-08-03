'use server';

import { DomainError } from '@/features/shared/errors';
import { getScope, requirePermission } from '@/features/shared/scope';
import { logger } from '@/libs/Logger';
import type { Article, IngestFailure } from './fetchArticle';
import { fetchArticle } from './fetchArticle';

/**
 * Server Action for reading a link.
 *
 * Reading is free and stores nothing. It is one fetch and a regex pass, and
 * the user has not decided to make anything yet — charging here would bill for
 * finding out whether a link is even usable.
 */

export type IngestActionResult =
  | { ok: true; article: Article }
  | { ok: false; code: IngestFailure | 'unauthorized' | 'forbidden' | 'invalid_input' };

/**
 * Reads an article from a link.
 *
 * @param url - The link the user pasted.
 * @returns The extracted article, or why it could not be read.
 */
export async function readArticle(url: string): Promise<IngestActionResult> {
  try {
    const scope = await getScope();
    requirePermission(scope, 'deck:create');

    if (typeof url !== 'string' || url.length > 2000) {
      return { ok: false, code: 'invalid_input' };
    }

    const result = await fetchArticle(url.trim());

    if (!result.ok) {
      return { ok: false, code: result.reason };
    }

    return { ok: true, article: result.article };
  } catch (error) {
    const code =
      error instanceof DomainError && error.code === 'forbidden' ? 'forbidden' : 'unauthorized';

    logger.warn('Article read rejected', { code });

    return { ok: false, code };
  }
}
