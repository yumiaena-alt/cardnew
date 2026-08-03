import type { OrgScope } from '@/features/shared/scope';
import { decryptSecret } from '@/libs/Crypto';
import { GRAPH_BASE, getGraph } from './graph';
import type { AccountWithCredential } from './repository';
import { listAccountCredentials } from './repository';

/**
 * The comment inbox.
 *
 * Comments are read from the network on each request rather than mirrored into
 * our database. A local copy would be wrong the moment someone replied from the
 * phone app, and "has this been answered" is exactly the question a stale copy
 * gets wrong in the direction that wastes the user's time.
 */

/** How far back to look. A month of posting for the target user, roughly. */
const MEDIA_LIMIT = 12;
const COMMENTS_PER_POST = 25;

const COMMENT_FIELDS = `id,text,timestamp,username,replies.limit(1){id}`;
const MEDIA_FIELDS = `id,permalink,comments.limit(${COMMENTS_PER_POST}){${COMMENT_FIELDS}}`;

type InboxComment = {
  id: string;
  text: string;
  /** Who wrote it. Empty when the network withholds it. */
  username: string;
  createdAt: string | null;
  /** The post it was left on. Where the user goes to answer. */
  permalink: string | null;
  accountHandle: string;
};

export type Inbox = {
  comments: InboxComment[];
  /** Accounts the network refused to answer for — usually a lapsed token. */
  unreachableAccounts: string[];
};

type RawRecord = Record<string, unknown>;

/**
 * Views an unknown value as a record without asserting its shape.
 *
 * @param value - The value to read.
 * @returns The record, or null when the value is not one.
 */
function asRecord(value: unknown): RawRecord | null {
  return typeof value === 'object' && value !== null ? { ...value } : null;
}

/**
 * Reads the rows out of a Graph edge.
 *
 * @param record - The object carrying the edge.
 * @param key - The edge name.
 * @returns The rows, empty when the edge is absent.
 */
function readEdge(record: RawRecord | null, key: string): unknown[] {
  const edge = asRecord(record?.[key] ?? null);

  return Array.isArray(edge?.data) ? edge.data : [];
}

/**
 * Reads one comment, keeping only the ones still waiting for an answer.
 *
 * A comment with any reply is treated as handled. That includes a reply from
 * someone else, which is deliberate: the inbox exists to surface what nobody
 * has responded to, not to track who responded.
 *
 * @param raw - A raw comment from the API.
 * @param context - The post it belongs to and the account it arrived on.
 * @returns The comment, or null when it is answered or carries no text.
 */
function readComment(
  raw: unknown,
  context: { permalink: string | null; accountHandle: string },
): InboxComment | null {
  const record = asRecord(raw);
  const id = typeof record?.id === 'string' ? record.id : null;
  const text = typeof record?.text === 'string' ? record.text : '';

  if (!id || text.trim() === '' || readEdge(record, 'replies').length > 0) {
    return null;
  }

  return {
    id,
    text,
    username: typeof record?.username === 'string' ? record.username : '',
    createdAt: typeof record?.timestamp === 'string' ? record.timestamp : null,
    permalink: context.permalink,
    accountHandle: context.accountHandle,
  };
}

/**
 * Reads the unanswered comments on one account's recent posts.
 *
 * @param account - The connected account and its stored credential.
 * @returns The comments, or null when the network refused the request.
 */
async function fetchAccountComments(
  account: AccountWithCredential,
): Promise<InboxComment[] | null> {
  if (!account.accessTokenCipher) {
    return null;
  }

  const params = new URLSearchParams({ fields: MEDIA_FIELDS, limit: String(MEDIA_LIMIT) });
  const payload = await getGraph(
    `${GRAPH_BASE}/${account.externalId}/media?${params.toString()}`,
    'comment inbox',
    decryptSecret(account.accessTokenCipher),
  );

  if (payload === null) {
    return null;
  }

  const root = asRecord(payload);
  const media = Array.isArray(root?.data) ? root.data : [];

  return media.flatMap((entry) => {
    const record = asRecord(entry);
    const permalink = typeof record?.permalink === 'string' ? record.permalink : null;

    return readEdge(record, 'comments')
      .map((comment) => readComment(comment, { permalink, accountHandle: account.handle }))
      .filter((comment): comment is InboxComment => comment !== null);
  });
}

/**
 * Collects everything waiting for a reply across the organization's accounts.
 *
 * An account the network refuses is reported rather than swallowed: an empty
 * inbox and a lapsed token look identical to the reader otherwise, and one of
 * them means comments are piling up unanswered.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @returns The comments, newest first, and any accounts that could not be read.
 */
export async function listUnansweredComments(scope: OrgScope): Promise<Inbox> {
  const accounts = await listAccountCredentials(scope);
  // Read in parallel: one slow account should not hold up the others, and the
  // page cannot render until all of them have answered anyway.
  const results = await Promise.all(
    accounts.map(async (account) => await fetchAccountComments(account)),
  );

  const comments = results
    .flatMap((result) => result ?? [])
    .toSorted((left, right) => (right.createdAt ?? '').localeCompare(left.createdAt ?? ''));

  const unreachableAccounts = accounts
    .filter((_account, index) => results[index] === null)
    .map((account) => account.handle);

  return { comments, unreachableAccounts };
}
