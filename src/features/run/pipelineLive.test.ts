import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { getBalance, grantCredits } from '@/features/credit/service';
import type { Scope } from '@/features/shared/scope';
import { db } from '@/libs/DB';
import { createSignedUrl, RENDER_BUCKET } from '@/libs/Storage';
import { decks, panels } from '@/models/Deck';
import { memberships, organizations, projects, users } from '@/models/Org';
import type { CreateRunInput } from '@/validations/RunValidation';
import { generateCut } from './pipeline';
import { findRun, listRunItems } from './repository';
import { createRun, finalizeRun } from './service';

/**
 * The generation path, end to end, against the real providers.
 *
 * Everything below the Server Action: charge, queue hand-off, plan, imagery,
 * render, upload, and the ledger closing out. It exists because every part of
 * this has been verified in isolation and never once together — which is the
 * arrangement that hides the mistakes nobody notices until a paying user finds
 * them.
 *
 * Skipped unless `RUN_LIVE_PIPELINE=1`. It spends real provider quota and
 * writes real objects to storage, so it must never run as part of the suite.
 */

const LIVE = process.env.RUN_LIVE_PIPELINE === '1';

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const USER_ID = '00000000-0000-4000-8000-000000000002';
const PROJECT_ID = '00000000-0000-4000-8000-000000000003';

const scope: Scope = {
  orgId: ORG_ID,
  userId: USER_ID,
  clerkOrgId: 'org_live_check',
  clerkUserId: 'user_live_check',
  role: 'owner',
  planKey: 'standard',
};

/**
 * Puts the tenant rows a run needs in place, once.
 */
async function seedTenant() {
  await db
    .insert(organizations)
    .values({
      id: ORG_ID,
      clerkOrgId: scope.clerkOrgId,
      name: 'Live check',
      slug: 'live-check',
      planKey: 'standard',
    })
    .onConflictDoNothing();

  await db
    .insert(users)
    .values({ id: USER_ID, clerkUserId: scope.clerkUserId, email: 'live@example.com' })
    .onConflictDoNothing();

  await db
    .insert(memberships)
    .values({ orgId: ORG_ID, userId: USER_ID, role: 'owner' })
    .onConflictDoNothing();

  await db
    .insert(projects)
    .values({ id: PROJECT_ID, orgId: ORG_ID, name: 'default', isDefault: true })
    .onConflictDoNothing();

  await grantCredits(scope, {
    amount: 100,
    reason: 'grant.promo',
    idempotencyKey: `live-check:${Date.now()}`,
  });
}

const TOPIC = '동네 카페 여름 신메뉴 3종 소개';

/**
 * 매번 새 배열을 만든다. `createRun` 이 받는 타입은 가변 배열이라 상수 하나를
 * 공유하면 readonly 로 굳어 버린다.
 *
 * @returns 카드뉴스 한 건짜리 실행 입력.
 */
function items(): CreateRunInput['items'] {
  return [{ topic: TOPIC, targets: [{ channel: 'instagram', ratio: '4:5', isOrigin: true }] }];
}
const MINUTES = 600_000;

/** 단계가 이어져야 하므로 상태를 파일 수준에 둔다. 실행 순서가 곧 파이프라인 순서다. */
let opening = 0;
let runId = '';
let deckId = '';

describe.skipIf(!LIVE)('generation, live', () => {
  it(
    'quotes a card news at fifteen without moving credits',
    async () => {
      await seedTenant();
      opening = await getBalance(scope);

      const quote = await createRun(scope, {
        items: items(),
        scope: { kind: 'full' },
        idempotencyKey: `live:${Date.now()}`,
        dryRun: true,
      });

      expect(quote.estimate.total).toBe(15);
      await expect(getBalance(scope)).resolves.toBe(opening);
    },
    MINUTES,
  );

  it(
    'charges and hands the run to the queue',
    async () => {
      const charged = await createRun(scope, {
        items: items(),
        scope: { kind: 'full' },
        idempotencyKey: `live:${Date.now()}:run`,
        dryRun: false,
      });

      if (charged.dryRun) {
        throw new Error('unreachable');
      }

      runId = charged.run.id;

      expect(charged.run.status).toBe('queued');
      await expect(getBalance(scope)).resolves.toBe(opening - 15);
    },
    MINUTES,
  );

  it(
    'generates the cards the worker would',
    async () => {
      const [item] = await listRunItems(scope, runId);

      if (!item) {
        throw new Error('run has no items');
      }

      const result = await generateCut({ scope, item, projectId: PROJECT_ID, createdBy: USER_ID });
      ({ deckId } = result);

      await finalizeRun(scope, runId, {
        outcomes: [{ itemId: item.id, status: 'done', deckId }],
      });

      expect(result.panelCount).toBeGreaterThan(0);
    },
    MINUTES,
  );

  it(
    'closes the run without refunding anything',
    async () => {
      const closed = await findRun(scope, runId);

      expect(closed?.status).toBe('done');
      await expect(getBalance(scope)).resolves.toBe(opening - 15);
    },
    MINUTES,
  );

  // 이미지가 실제로 열리는지까지 본다. 경로만 저장되고 오브젝트가 없는 상태는
  // DB 만 보면 성공처럼 보인다.
  it(
    'leaves every card readable through a signed url',
    async () => {
      const [deck] = await db.select().from(decks).where(eq(decks.id, deckId)).limit(1);
      const rows = await db
        .select({ index: panels.index, renderPath: panels.renderPath })
        .from(panels)
        .where(eq(panels.versionId, deck?.activeVersionId ?? ''))
        .orderBy(panels.index);

      expect(rows.length).toBeGreaterThan(0);

      for (const row of rows) {
        const res = await fetch(await createSignedUrl(RENDER_BUCKET, row.renderPath ?? ''), {
          signal: AbortSignal.timeout(20_000),
        });
        const bytes = Buffer.from(await res.arrayBuffer());

        // biome-ignore lint/suspicious/noConsole: this harness reports to a person
        console.log(`  panel ${row.index}: ${res.status} ${(bytes.length / 1024).toFixed(0)}KB`);

        expect(res.ok).toBeTruthy();
      }
    },
    MINUTES,
  );
});
