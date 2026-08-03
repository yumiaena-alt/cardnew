import { randomBytes } from 'node:crypto';

// Set before the import: `Env` parses the environment when its module is
// evaluated, so a hook would run after these were already read.
process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('base64');

const { afterEach, describe, expect, it, vi } = await import('vitest');

// oxlint-disable eslint/require-await -- the double stands in for an async call.
const store = vi.hoisted(() => ({
  accounts: [] as {
    id: string;
    orgId: string;
    externalId: string;
    handle: string;
    accessTokenCipher: string | null;
    isActive: boolean;
  }[],
}));

// Referenced by path rather than by `import()`: the typed form demands every
// export of the module, and this reaches one.
vi.mock('./repository', () => ({
  listAccountCredentials: async () => store.accounts,
}));

const { encryptSecret } = await import('@/libs/Crypto');
const { listUnansweredComments } = await import('./comments');

const scope = { orgId: 'org_1' };

/**
 * Answers the media call with a fixed body.
 *
 * @param body - What the API returns.
 * @param ok - Whether the response succeeds.
 */
function respondWith(body: unknown, ok = true) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      status: ok ? 200 : 400,
      json: vi.fn().mockResolvedValue(body),
    }),
  );
}

/**
 * Registers one connected account.
 *
 * @param handle - The account handle.
 */
function connect(handle = 'panelo') {
  store.accounts = [
    {
      id: 'account_1',
      orgId: 'org_1',
      externalId: '17841',
      handle,
      accessTokenCipher: encryptSecret('token'),
      isActive: true,
    },
  ];
}

describe('comment inbox', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe(listUnansweredComments, () => {
    it('keeps the comments nobody has replied to, newest first', async () => {
      connect();
      respondWith({
        data: [
          {
            id: 'media_1',
            permalink: 'https://example.com/p/1',
            comments: {
              data: [
                {
                  id: 'c1',
                  text: '가격 알려주세요',
                  username: 'a',
                  timestamp: '2026-08-01T00:00:00+0000',
                },
                {
                  id: 'c2',
                  text: '재고 있나요',
                  username: 'b',
                  timestamp: '2026-08-02T00:00:00+0000',
                },
              ],
            },
          },
        ],
      });

      const inbox = await listUnansweredComments(scope);

      expect(inbox.comments.map((comment) => comment.id)).toStrictEqual(['c2', 'c1']);
      expect(inbox.comments[0]?.permalink).toBe('https://example.com/p/1');
      expect(inbox.comments[0]?.accountHandle).toBe('panelo');
    });

    // The inbox exists to show what is still waiting. A comment somebody
    // answered from the phone app is not waiting.
    it('drops a comment that already has a reply', async () => {
      connect();
      respondWith({
        data: [
          {
            id: 'media_1',
            comments: {
              data: [{ id: 'c1', text: '가격 알려주세요', replies: { data: [{ id: 'r1' }] } }],
            },
          },
        ],
      });

      await expect(listUnansweredComments(scope)).resolves.toMatchObject({ comments: [] });
    });

    // An empty inbox and a lapsed token look identical to the reader otherwise,
    // and one of them means comments are piling up unanswered.
    it('names an account the network refused rather than reporting it empty', async () => {
      connect('shop');
      respondWith({ error: { message: 'expired' } }, false);

      await expect(listUnansweredComments(scope)).resolves.toStrictEqual({
        comments: [],
        unreachableAccounts: ['shop'],
      });
    });

    it('reads nothing when no account is connected', async () => {
      store.accounts = [];

      await expect(listUnansweredComments(scope)).resolves.toStrictEqual({
        comments: [],
        unreachableAccounts: [],
      });
    });
  });
});
