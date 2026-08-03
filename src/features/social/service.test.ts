import { randomBytes } from 'node:crypto';

// Set before the import: `Env` parses the environment when its module is
// evaluated, so a hook would run after these were already read.
process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('base64');

const { beforeEach, describe, expect, it, vi } = await import('vitest');

// The repository and the network are faked so the tests exercise the decision
// this module makes: whether a comment is answered at all, and exactly once.
// oxlint-disable eslint/require-await -- the doubles stand in for async calls.
const store = vi.hoisted(() => ({
  account: null as {
    id: string;
    orgId: string;
    externalId: string;
    accessTokenCipher: string | null;
    isActive: boolean;
  } | null,
  automations: [] as {
    id: string;
    externalPostId: string | null;
    keywords: string[];
    message: string;
    linkUrl: string | null;
  }[],
  claimed: [] as string[],
  settled: [] as { status: string; errorMessage?: string }[],
  sent: [] as { commentId: string; message: string }[],
  replyFails: false,
}));

// Referenced by path rather than by `import()`: the typed form demands every
// export of the module, and the runtime only reaches these four.
vi.mock('./repository', () => ({
  findAccountByExternalId: async () => store.account,
  listActiveAutomations: async () => store.automations,
  claimDmSend: async (_scope: unknown, input: { externalCommentId: string }) => {
    if (store.claimed.includes(input.externalCommentId)) {
      return null;
    }

    store.claimed.push(input.externalCommentId);

    return { id: `send_${store.claimed.length}` };
  },
  settleDmSend: async (_scope: unknown, _sendId: string, outcome: { status: string }) => {
    store.settled.push(outcome);
  },
}));

vi.mock(import('./reply'), async (importOriginal) => ({
  ...(await importOriginal()),
  sendPrivateReply: async (input: { commentId: string; message: string }) => {
    if (store.replyFails) {
      return { ok: false, error: 'comment is too old' };
    }

    store.sent.push({ commentId: input.commentId, message: input.message });

    return { ok: true };
  },
}));

const { encryptSecret } = await import('@/libs/Crypto');
const { handleCommentChange } = await import('./service');

const ACCOUNT_ID = '17841000000000000';

/**
 * Builds a connected account row.
 *
 * @param overrides - Fields to change.
 * @returns The account.
 */
function connectedAccount(overrides: { isActive?: boolean } = {}) {
  return {
    id: 'account_1',
    orgId: 'org_1',
    externalId: ACCOUNT_ID,
    accessTokenCipher: encryptSecret('token'),
    isActive: true,
    ...overrides,
  };
}

/**
 * Builds a comment as the webhook reports it.
 *
 * @param overrides - Fields to change.
 * @returns The comment.
 */
function comment(overrides: Partial<{ id: string; text: string; from: { id: string } }> = {}) {
  return {
    id: 'comment_1',
    text: '가격 알려주세요',
    from: { id: 'someone_else' },
    media: { id: 'media_1' },
    ...overrides,
  };
}

describe('comment automation', () => {
  beforeEach(() => {
    store.account = connectedAccount();
    store.automations = [
      {
        id: 'auto_1',
        externalPostId: null,
        keywords: ['가격'],
        message: '가격표 보내드려요',
        linkUrl: null,
      },
    ];
    store.claimed = [];
    store.settled = [];
    store.sent = [];
    store.replyFails = false;
  });

  describe(handleCommentChange, () => {
    it('replies when a keyword matches', async () => {
      const outcome = await handleCommentChange({
        accountExternalId: ACCOUNT_ID,
        comment: comment(),
      });

      expect(outcome).toBe('sent');
      expect(store.sent).toStrictEqual([{ commentId: 'comment_1', message: '가격표 보내드려요' }]);
      expect(store.settled).toStrictEqual([{ status: 'sent' }]);
    });

    // The one failure a user would never forgive: the network redelivers a
    // webhook it did not hear back from, and the same person gets messaged twice.
    it('answers a redelivered comment only once', async () => {
      await handleCommentChange({ accountExternalId: ACCOUNT_ID, comment: comment() });
      const second = await handleCommentChange({
        accountExternalId: ACCOUNT_ID,
        comment: comment(),
      });

      expect(second).toBe('duplicate');
      expect(store.sent).toHaveLength(1);
    });

    it('ignores a comment the account owner wrote', async () => {
      const outcome = await handleCommentChange({
        accountExternalId: ACCOUNT_ID,
        comment: comment({ from: { id: ACCOUNT_ID } }),
      });

      expect(outcome).toBe('own_comment');
      expect(store.sent).toStrictEqual([]);
    });

    it('stays quiet when no keyword matches', async () => {
      const outcome = await handleCommentChange({
        accountExternalId: ACCOUNT_ID,
        comment: comment({ text: '잘 봤습니다' }),
      });

      expect(outcome).toBe('no_match');
      expect(store.claimed).toStrictEqual([]);
    });

    it('skips a rule bound to a different post', async () => {
      store.automations = [
        {
          id: 'auto_1',
          externalPostId: 'media_2',
          keywords: ['가격'],
          message: 'x',
          linkUrl: null,
        },
      ];

      await expect(
        handleCommentChange({ accountExternalId: ACCOUNT_ID, comment: comment() }),
      ).resolves.toBe('no_match');
    });

    it('declines when the account was never connected', async () => {
      store.account = null;

      await expect(
        handleCommentChange({ accountExternalId: ACCOUNT_ID, comment: comment() }),
      ).resolves.toBe('no_account');
    });

    it('declines a paused account rather than replying from it', async () => {
      store.account = connectedAccount({ isActive: false });

      await expect(
        handleCommentChange({ accountExternalId: ACCOUNT_ID, comment: comment() }),
      ).resolves.toBe('no_account');
    });

    // Kept rather than deleted: the claim is what stops a retry from sending,
    // and the stored reason is the only place the refusal is visible.
    it('records the provider reason when the reply is refused', async () => {
      store.replyFails = true;

      const outcome = await handleCommentChange({
        accountExternalId: ACCOUNT_ID,
        comment: comment(),
      });

      expect(outcome).toBe('failed');
      expect(store.settled).toStrictEqual([
        { status: 'failed', errorMessage: 'comment is too old' },
      ]);
    });
  });
});
