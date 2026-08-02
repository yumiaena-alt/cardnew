# 03. 데이터 모델 — Panelo

기준일: 2026-08-02 · 버전 0.2 · Drizzle ORM 0.45 / PostgreSQL 17 (Supabase)

## 0. Postgres 스키마 — `cardnews`

애플리케이션 테이블은 `public`이 아니라 **전용 스키마 `cardnews`** 에 만든다. Supabase가 관리하는 객체나 확장이 `public`에 떨어뜨리는 것들과 섞이지 않게 하려는 것이고, 권한 부여·백업 대상을 애플리케이션 표면에 정확히 겨눌 수 있다.

```ts
// src/models/Namespace.ts
import { pgSchema } from 'drizzle-orm/pg-core';

export const cardnews = pgSchema('cardnews');
```

모든 테이블과 enum은 `pgTable`/`pgEnum`이 아니라 이 네임스페이스를 통해 선언한다.

```ts
export const organizations = cardnews.table('organizations', { … });
export const memberRoleEnum = cardnews.enum('member_role', [ … ]);
```

생성된 마이그레이션은 `CREATE SCHEMA "cardnews";`로 시작하고, 테이블·enum·인덱스·FK가 전부 `"cardnews"."…"`로 한정된다.

> **예외**: 보일러플레이트 데모 테이블 `counter`(`src/models/Schema.ts`)는 `0000_init-db.sql`에서 이미 `public`에 만들어졌으므로 그대로 둔다. 마케팅 페이지 정리 시 테이블째 제거할 대상이다.

## 1. 파일 구성

기존 `src/models/Schema.ts` 단일 파일을 도메인별로 분리하고, `drizzle.config.ts`의 `schema`를 glob(`./src/models/*.ts`)으로 바꾼다. barrel 파일을 두지 않는 이유는 린트의 `no-barrel-file` 규칙 때문이다.

```
src/models/
├─ Namespace.ts    # pgSchema('cardnews') — 모든 테이블의 소속
├─ Enums.ts        # cardnews.enum 정의
├─ Org.ts          # organizations, users, memberships, projects
├─ Brand.ts        # brand_kits, brand_assets
├─ Template.ts     # templates, template_versions, design_learnings
├─ Deck.ts         # decks, deck_versions, panels
├─ Board.ts        # boards, board_rows, board_row_outputs, series_templates
├─ Run.ts          # runs, run_items
├─ Billing.ts      # subscriptions, credit_ledger, plan_limits
├─ Publish.ts      # social_accounts, schedules, publications, metrics_daily
├─ System.ts       # webhook_events, notifications, audit_logs
└─ Schema.ts       # (보일러플레이트) counter — public 스키마, 제거 예정
```

## 2. 엔티티 관계도

```
organizations ─┬─ memberships ── users
               ├─ projects ──┬─ brand_kits ── brand_assets
               │             ├─ social_accounts
               │             ├─ series_templates
               │             └─ boards ── board_rows ── board_row_outputs ─┐
               ├─ templates ── template_versions                            │
               │            └─ design_learnings                             │
               ├─ decks ──┬─ deck_versions ── panels                       ─┘
               │          └─ schedules ── publications ── metrics_daily
               ├─ runs ── run_items
               ├─ subscriptions / credit_ledger
               └─ notifications / audit_logs
```

## 3. 공통 규약

| 항목 | 규칙 |
|---|---|
| 스키마 | 모든 테이블은 `cardnews.table(...)`. `pgTable`을 직접 쓰지 않는다 |
| PK | `uuid('id').defaultRandom().primaryKey()` |
| 조직 스코프 | 조직 데이터를 담는 모든 테이블은 `orgId` 컬럼을 **직접** 보유한다 (조인 없이 격리 필터가 걸리도록) |
| 타임스탬프 | `timestamp(..., { withTimezone: true })`. 앱은 UTC 저장, 표시 시 사용자 타임존 변환 |
| 소프트 삭제 | `deletedAt`. 조직·프로젝트·Deck에만 적용. 하위는 CASCADE 하드 삭제 |
| 삭제 정책 | 소유 관계는 `onDelete: 'cascade'`, 참조 관계는 `'set null'` |
| JSONB | 반드시 `.$type<T>()`로 타입 고정. 스키마 없는 jsonb 금지 |
| 금액·수량 | `integer`. 크레딧은 정수, 금액은 최소 화폐 단위(센트) |

## 4. Enums

```ts
// src/models/Enums.ts
import { pgEnum } from 'drizzle-orm/pg-core';

export const memberRoleEnum = pgEnum('member_role', [
  'owner', 'admin', 'editor', 'reviewer', 'viewer',
]);

export const channelEnum = pgEnum('channel', [
  'instagram', 'threads', 'tiktok', 'youtube', 'blog',
]);

export const ratioEnum = pgEnum('ratio', ['1:1', '4:5', '16:9', '9:16', '3:4']);

export const deckStatusEnum = pgEnum('deck_status', [
  'drafting', 'ready', 'scheduled', 'published', 'archived',
]);

export const boardRowStatusEnum = pgEnum('board_row_status', [
  'draft', 'queued', 'running', 'done', 'failed', 'skipped',
]);

export const runStatusEnum = pgEnum('run_status', [
  'estimated', 'queued', 'running', 'done', 'failed', 'canceled',
]);

export const runScopeKindEnum = pgEnum('run_scope_kind', ['full', 'panel', 'slot']);

export const templateSourceEnum = pgEnum('template_source', ['system', 'learned', 'forked']);

export const scheduleStatusEnum = pgEnum('schedule_status', [
  'pending', 'publishing', 'published', 'failed', 'canceled',
]);

export const creditReasonEnum = pgEnum('credit_reason', [
  'grant.signup', 'grant.monthly', 'grant.purchase', 'grant.promo',
  'spend.run', 'spend.learn',
  'refund.run_failed', 'refund.manual',
  'expire.monthly',
]);
```

## 5. 조직 · 사용자

```ts
// src/models/Org.ts
import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { memberRoleEnum } from './Enums';

export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  clerkOrgId: text('clerk_org_id').notNull().unique(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  planKey: text('plan_key').notNull().default('free'),
  timezone: text('timezone').notNull().default('Asia/Seoul'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  clerkUserId: text('clerk_user_id').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  locale: text('locale').notNull().default('ko'),
  /** 마케팅 수신 동의 시각. null이면 미동의. 법적 증빙용으로 시각을 반드시 남긴다. */
  marketingOptInAt: timestamp('marketing_opt_in_at', { withTimezone: true }),
  /** 탈퇴 요청 시각. 30일 유예 후 하드 삭제 잡이 처리한다. */
  deletionRequestedAt: timestamp('deletion_requested_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const memberships = pgTable('memberships', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: memberRoleEnum('role').notNull().default('editor'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, t => [
  uniqueIndex('memberships_org_user_uq').on(t.orgId, t.userId),
  index('memberships_user_idx').on(t.userId),
]);

/**
 * 브랜드 단위 컨테이너. Phase 1~3에서는 조직당 1개(`default`)만 자동 생성하고
 * UI에서 숨긴다. 스키마는 Phase 4의 멀티 브랜드를 미리 지탱한다.
 */
export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, t => [index('projects_org_idx').on(t.orgId)]);
```

## 6. 브랜드킷

```ts
// src/models/Brand.ts

export type BrandTone = {
  /** 채널별 말투 규칙. Fan-out 시 Cut 톤 조정의 근거가 된다. */
  perChannel: Partial<Record<Channel, { formality: 'casual' | 'neutral' | 'formal'; endings: string[] }>>;
  bannedWords: string[];
  mustInclude: string[];
};

export type BrandPalette = {
  primary: string;
  secondary: string;
  background: string;
  text: string;
};

export const brandKits = pgTable('brand_kits', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  palette: jsonb('palette').$type<BrandPalette>().notNull(),
  fontHeading: text('font_heading').notNull().default('Pretendard'),
  fontBody: text('font_body').notNull().default('Pretendard'),
  tone: jsonb('tone').$type<BrandTone>().notNull(),
  logoAssetId: uuid('logo_asset_id'),
  isActive: boolean('is_active').notNull().default(true),
}, t => [index('brand_kits_project_idx').on(t.projectId)]);

export const brandAssets = pgTable('brand_assets', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),                       // 'logo' | 'image' | 'font'
  storagePath: text('storage_path').notNull(),
  mimeType: text('mime_type').notNull(),
  byteSize: integer('byte_size').notNull(),
  width: integer('width'),
  height: integer('height'),
  blurDataUrl: text('blur_data_url'),
  /** 업로드 시 "본인이 권리를 보유함" 확인 시각. 저작권 분쟁 대비 증빙. */
  rightsConfirmedAt: timestamp('rights_confirmed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, t => [index('brand_assets_project_kind_idx').on(t.projectId, t.kind)]);
```

## 7. 템플릿

템플릿은 완성 이미지가 아니라 **슬롯 스키마 + 스타일 토큰**이다.

```ts
// src/models/Template.ts

export type PanelSlotSpec = {
  key: string;                                    // 'headline' | 'body' | 'bg'
  type: 'text' | 'image' | 'shape';
  /** 0~1 정규화 좌표. 비율이 달라져도 재계산 가능하다. */
  box: { x: number; y: number; w: number; h: number };
  maxChars?: number;
  style?: Record<string, string>;
};

export type PanelLayoutSpec = {
  role: 'cover' | 'body' | 'cta';
  slots: PanelSlotSpec[];
};

export const templates = pgTable('templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  /** null이면 전체 사용자에게 제공되는 시스템 템플릿. */
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  source: templateSourceEnum('source').notNull().default('system'),
  ratio: ratioEnum('ratio').notNull(),
  defaultPanelCount: integer('default_panel_count').notNull().default(6),
  styleTags: jsonb('style_tags').$type<string[]>().notNull().default([]),
  previewPath: text('preview_path'),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, t => [
  index('templates_org_ratio_idx').on(t.orgId, t.ratio),
  index('templates_source_idx').on(t.source),
]);

export const templateVersions = pgTable('template_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  templateId: uuid('template_id').notNull().references(() => templates.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  layouts: jsonb('layouts').$type<PanelLayoutSpec[]>().notNull(),
  tokens: jsonb('tokens').$type<Record<string, string>>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, t => [uniqueIndex('template_versions_template_version_uq').on(t.templateId, t.version)]);

/** 레퍼런스 이미지 학습 기록. 학습 결과는 해당 조직 전용이며 타 조직에 전이되지 않는다. */
export const designLearnings = pgTable('design_learnings', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  sourceAssetIds: jsonb('source_asset_ids').$type<string[]>().notNull(),
  ratio: ratioEnum('ratio').notNull(),
  customInstruction: text('custom_instruction'),
  producedTemplateId: uuid('produced_template_id').references(() => templates.id, { onDelete: 'set null' }),
  rightsConfirmedAt: timestamp('rights_confirmed_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, t => [index('design_learnings_org_idx').on(t.orgId)]);
```

## 8. Deck · Panel

```ts
// src/models/Deck.ts

export type PanelSlotValue = {
  type: 'text' | 'image' | 'shape';
  value: string;                                   // 텍스트 내용 또는 asset id
  style?: Record<string, string>;
  /** 사용자가 직접 수정한 슬롯은 재생성 시 보존한다. */
  isUserEdited?: boolean;
};

export const decks = pgTable('decks', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  topic: text('topic').notNull(),
  channel: channelEnum('channel').notNull(),
  ratio: ratioEnum('ratio').notNull(),
  status: deckStatusEnum('status').notNull().default('drafting'),
  activeVersionId: uuid('active_version_id'),      // FK는 후행 마이그레이션에서 추가 (순환 참조 회피)
  /** 소재 중복 감지용. Phase 2는 jsonb, Phase 3에서 pgvector로 전환한다. */
  topicEmbedding: jsonb('topic_embedding').$type<number[]>(),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, t => [
  index('decks_org_status_idx').on(t.orgId, t.status),
  index('decks_project_created_idx').on(t.projectId, t.createdAt),
]);

/** 버전 트리. parentVersionId로 부분 재생성 계보를 추적한다. */
export const deckVersions = pgTable('deck_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  deckId: uuid('deck_id').notNull().references(() => decks.id, { onDelete: 'cascade' }),
  parentVersionId: uuid('parent_version_id'),
  label: text('label').notNull(),                  // 'v1', 'v1.2'
  templateVersionId: uuid('template_version_id').references(() => templateVersions.id),
  runId: uuid('run_id'),
  creditsCharged: integer('credits_charged').notNull().default(0),
  scopeKind: runScopeKindEnum('scope_kind').notNull().default('full'),
  scopeDetail: jsonb('scope_detail').$type<{ panelIndex?: number; slotKey?: string }>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, t => [
  index('deck_versions_deck_idx').on(t.deckId),
  index('deck_versions_parent_idx').on(t.parentVersionId),
]);

export const panels = pgTable('panels', {
  id: uuid('id').defaultRandom().primaryKey(),
  versionId: uuid('version_id').notNull().references(() => deckVersions.id, { onDelete: 'cascade' }),
  index: integer('index').notNull(),
  role: text('role').notNull().default('body'),    // 'cover' | 'body' | 'cta'
  slots: jsonb('slots').$type<Record<string, PanelSlotValue>>().notNull(),
  renderPath: text('render_path'),                 // Storage 경로 (PNG)
  blurDataUrl: text('blur_data_url'),
}, t => [uniqueIndex('panels_version_index_uq').on(t.versionId, t.index)]);
```

## 9. Board (핵심 차별 기능)

```ts
// src/models/Board.ts

export type BoardColumn = {
  key: string;
  label: string;
  type: 'topic' | 'channel' | 'template' | 'date' | 'text' | 'number' | 'tags';
  width: number;
  isRequired: boolean;
};

export type FanoutTarget = {
  channel: Channel;
  ratio: Ratio;
  templateVersionId?: string;
  /** true면 이 Cut이 원본. 나머지는 파생(5cr). */
  isOrigin: boolean;
};

export const boards = pgTable('boards', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),                  // '2026년 8월 배치'
  periodStart: date('period_start'),
  periodEnd: date('period_end'),
  columnConfig: jsonb('column_config').$type<BoardColumn[]>().notNull(),
  defaultFanout: jsonb('default_fanout').$type<FanoutTarget[]>().notNull().default([]),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, t => [index('boards_org_period_idx').on(t.orgId, t.periodStart)]);

export const boardRows = pgTable('board_rows', {
  id: uuid('id').defaultRandom().primaryKey(),
  boardId: uuid('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  /** 행 순서. 재정렬 시 간격을 두고 부여해 대량 UPDATE를 피한다 (1000, 2000, 3000…). */
  position: integer('position').notNull(),
  topic: text('topic').notNull(),
  cells: jsonb('cells').$type<Record<string, unknown>>().notNull().default({}),
  fanoutTargets: jsonb('fanout_targets').$type<FanoutTarget[]>().notNull().default([]),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  status: boardRowStatusEnum('status').notNull().default('draft'),
  estimatedCredits: integer('estimated_credits').notNull().default(0),
  lastRunId: uuid('last_run_id'),
  errorMessage: text('error_message'),
}, t => [
  index('board_rows_board_position_idx').on(t.boardId, t.position),
  index('board_rows_board_status_idx').on(t.boardId, t.status),
]);

/** 1행 → N개 Cut 매핑. 과금 차등(원본 15cr / 파생 5cr)의 근거가 되는 테이블. */
export const boardRowOutputs = pgTable('board_row_outputs', {
  id: uuid('id').defaultRandom().primaryKey(),
  rowId: uuid('row_id').notNull().references(() => boardRows.id, { onDelete: 'cascade' }),
  deckId: uuid('deck_id').notNull().references(() => decks.id, { onDelete: 'cascade' }),
  channel: channelEnum('channel').notNull(),
  ratio: ratioEnum('ratio').notNull(),
  isOrigin: boolean('is_origin').notNull().default(false),
  creditsCharged: integer('credits_charged').notNull().default(0),
  runItemId: uuid('run_item_id'),
}, t => [
  index('board_row_outputs_row_idx').on(t.rowId),
  uniqueIndex('board_row_outputs_row_channel_uq').on(t.rowId, t.channel, t.ratio),
]);

/** 반복 발행 슬롯. "매주 화요일 = 팁 시리즈" 같은 규칙을 저장한다. */
export const seriesTemplates = pgTable('series_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  /** RFC 5545 RRULE. 예: FREQ=WEEKLY;BYDAY=TU */
  rrule: text('rrule').notNull(),
  templateVersionId: uuid('template_version_id').notNull().references(() => templateVersions.id),
  fanoutPreset: jsonb('fanout_preset').$type<FanoutTarget[]>().notNull(),
  /** 조직 타임존 기준 발행 시각. */
  defaultTimeLocal: text('default_time_local').notNull().default('19:00'),
  isActive: boolean('is_active').notNull().default(true),
}, t => [index('series_templates_project_idx').on(t.projectId)]);
```

## 10. Run (생성 실행)

```ts
// src/models/Run.ts

export const runs = pgTable('runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  boardId: uuid('board_id').references(() => boards.id, { onDelete: 'set null' }),
  status: runStatusEnum('status').notNull().default('estimated'),
  scopeKind: runScopeKindEnum('scope_kind').notNull().default('full'),
  itemCount: integer('item_count').notNull(),
  estimatedCredits: integer('estimated_credits').notNull(),
  chargedCredits: integer('charged_credits').notNull().default(0),
  refundedCredits: integer('refunded_credits').notNull().default(0),
  /** 동일 키 재요청 시 기존 Run을 반환한다. 중복 과금 방지의 핵심. */
  idempotencyKey: text('idempotency_key').notNull(),
  /** 실제 원가 추적: 토큰 수, 이미지 생성 횟수, 제공사 단가. 크레딧 단가 조정 근거. */
  costSnapshot: jsonb('cost_snapshot').$type<{
    llmInputTokens: number;
    llmOutputTokens: number;
    imageCount: number;
    providerCostUsd: number;
  }>(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, t => [
  uniqueIndex('runs_idempotency_uq').on(t.idempotencyKey),
  index('runs_org_created_idx').on(t.orgId, t.createdAt),
  index('runs_status_idx').on(t.status),
]);

export const runItems = pgTable('run_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  runId: uuid('run_id').notNull().references(() => runs.id, { onDelete: 'cascade' }),
  rowId: uuid('row_id').references(() => boardRows.id, { onDelete: 'set null' }),
  deckId: uuid('deck_id').references(() => decks.id, { onDelete: 'set null' }),
  channel: channelEnum('channel').notNull(),
  isOrigin: boolean('is_origin').notNull(),
  estimatedCredits: integer('estimated_credits').notNull(),
  status: runStatusEnum('status').notNull().default('queued'),
  attempts: integer('attempts').notNull().default(0),
  errorMessage: text('error_message'),
}, t => [index('run_items_run_status_idx').on(t.runId, t.status)]);
```

## 11. 과금

```ts
// src/models/Billing.ts

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }).unique(),
  stripeCustomerId: text('stripe_customer_id').notNull(),
  stripeSubscriptionId: text('stripe_subscription_id'),
  planKey: text('plan_key').notNull().default('free'),
  status: text('status').notNull().default('active'),
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
}, t => [index('subscriptions_stripe_customer_idx').on(t.stripeCustomerId)]);

/**
 * 크레딧 원장. 이중부기 방식으로 잔액 컬럼을 두지 않는다.
 * 잔액 = SUM(delta). 차감과 환불이 각각 별도 행으로 남아 감사 추적이 가능하다.
 */
export const creditLedger = pgTable('credit_ledger', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  delta: integer('delta').notNull(),               // 지급 +, 차감 -, 환불 +
  reason: creditReasonEnum('reason').notNull(),
  refType: text('ref_type'),                       // 'run' | 'design_learning' | 'subscription'
  refId: uuid('ref_id'),
  /** 동일 키의 중복 기록을 DB 레벨에서 차단한다. */
  idempotencyKey: text('idempotency_key').notNull(),
  /** 월간 지급분의 소멸 예정일. 구매분은 null(무기한). 약관에 명시 필요. */
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, t => [
  uniqueIndex('credit_ledger_idem_uq').on(t.idempotencyKey),
  index('credit_ledger_org_created_idx').on(t.orgId, t.createdAt),
]);

export const planLimits = pgTable('plan_limits', {
  planKey: text('plan_key').primaryKey(),
  monthlyCredits: integer('monthly_credits').notNull(),
  maxSocialAccounts: integer('max_social_accounts').notNull(),
  maxMembers: integer('max_members').notNull(),
  maxBrandAssets: integer('max_brand_assets').notNull(),
  maxSavedTemplates: integer('max_saved_templates').notNull(),
  hasWatermark: boolean('has_watermark').notNull().default(false),
  overageCentsPerCredit: integer('overage_cents_per_credit').notNull().default(5),
});
```

### 시드 데이터

| plan_key | monthlyCredits | maxSocialAccounts | maxMembers | maxBrandAssets | maxSavedTemplates | hasWatermark | overageCents |
|---|---|---|---|---|---|---|---|
| free | 50 | 1 | 1 | 20 | 5 | true | 0 (초과 불가) |
| standard | 500 | 2 | 1 | 100 | 40 | false | 5 |
| pro | 1500 | 5 | 3 | 300 | 120 | false | 4 |
| agency | 3500 | 10 | 5 | 1000 | 400 | false | 3 |

## 12. 발행 (Phase 3)

```ts
// src/models/Publish.ts

export const socialAccounts = pgTable('social_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  channel: channelEnum('channel').notNull(),
  externalId: text('external_id').notNull(),
  handle: text('handle').notNull(),
  /** 토큰은 애플리케이션 레벨에서 암호화한 뒤 저장한다. 평문 저장 금지. */
  accessTokenEncrypted: text('access_token_encrypted').notNull(),
  refreshTokenEncrypted: text('refresh_token_encrypted'),
  tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
  scopes: jsonb('scopes').$type<string[]>().notNull().default([]),
  isActive: boolean('is_active').notNull().default(true),
  connectedAt: timestamp('connected_at', { withTimezone: true }).defaultNow().notNull(),
}, t => [
  uniqueIndex('social_accounts_channel_external_uq').on(t.channel, t.externalId),
  index('social_accounts_project_idx').on(t.projectId),
]);

export const schedules = pgTable('schedules', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  deckId: uuid('deck_id').notNull().references(() => decks.id, { onDelete: 'cascade' }),
  socialAccountId: uuid('social_account_id').notNull().references(() => socialAccounts.id, { onDelete: 'cascade' }),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  caption: text('caption'),
  hashtags: jsonb('hashtags').$type<string[]>().notNull().default([]),
  status: scheduleStatusEnum('status').notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
  errorMessage: text('error_message'),
}, t => [
  /** 스케줄러의 SKIP LOCKED 폴링 쿼리 전용 인덱스. */
  index('schedules_due_idx').on(t.status, t.scheduledAt),
  index('schedules_deck_idx').on(t.deckId),
]);

export const publications = pgTable('publications', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  scheduleId: uuid('schedule_id').references(() => schedules.id, { onDelete: 'set null' }),
  deckId: uuid('deck_id').notNull().references(() => decks.id, { onDelete: 'cascade' }),
  socialAccountId: uuid('social_account_id').notNull().references(() => socialAccounts.id, { onDelete: 'cascade' }),
  externalPostId: text('external_post_id').notNull(),
  permalink: text('permalink'),
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
}, t => [
  uniqueIndex('publications_account_external_uq').on(t.socialAccountId, t.externalPostId),
  index('publications_org_published_idx').on(t.orgId, t.publishedAt),
]);

/** 일자별 성과 스냅샷. 발행 후 7/14/30일 시점에 수집한다. */
export const metricsDaily = pgTable('metrics_daily', {
  id: uuid('id').defaultRandom().primaryKey(),
  publicationId: uuid('publication_id').notNull().references(() => publications.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  impressions: integer('impressions').notNull().default(0),
  reach: integer('reach').notNull().default(0),
  likes: integer('likes').notNull().default(0),
  comments: integer('comments').notNull().default(0),
  saves: integer('saves').notNull().default(0),
  shares: integer('shares').notNull().default(0),
  profileVisits: integer('profile_visits').notNull().default(0),
}, t => [uniqueIndex('metrics_daily_publication_date_uq').on(t.publicationId, t.date)]);
```

## 13. 시스템

```ts
// src/models/System.ts

/** 웹훅 멱등 처리. Clerk svix-id, Stripe event.id를 저장해 재전송을 무시한다. */
export const webhookEvents = pgTable('webhook_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  provider: text('provider').notNull(),            // 'clerk' | 'stripe' | 'meta'
  externalEventId: text('external_event_id').notNull(),
  payload: jsonb('payload').notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
}, t => [uniqueIndex('webhook_events_provider_external_uq').on(t.provider, t.externalEventId)]);

export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),                    // 'run.failed' | 'credit.low' | 'publish.failed' | 'token.expiring'
  titleKey: text('title_key').notNull(),           // i18n 키. 본문을 하드코딩하지 않는다.
  params: jsonb('params').$type<Record<string, string>>().notNull().default({}),
  linkPath: text('link_path'),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, t => [index('notifications_user_read_idx').on(t.userId, t.readAt)]);

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),                // 'deck.delete' | 'member.role_change' | 'account.disconnect'
  targetType: text('target_type').notNull(),
  targetId: uuid('target_id'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, t => [index('audit_logs_org_created_idx').on(t.orgId, t.createdAt)]);
```

## 14. 인덱스 전략 요약

| 쿼리 | 인덱스 |
|---|---|
| Board 시트 렌더 (행 순서대로) | `board_rows_board_position_idx` |
| Board 진행률 집계 | `board_rows_board_status_idx` |
| 스케줄러 폴링 | `schedules_due_idx` (status, scheduled_at) |
| 크레딧 잔액 계산 | `credit_ledger_org_created_idx` |
| 중복 Run 차단 | `runs_idempotency_uq` |
| 중복 발행 차단 | `publications_account_external_uq` |
| 조직 격리 필터 | 모든 조직 테이블의 `org_id` 선두 복합 인덱스 |

## 15. 마이그레이션 순서 (Phase 1)

```
0001_org_and_users        organizations, users, memberships, projects
0002_billing              plan_limits(+시드), subscriptions, credit_ledger
0003_template             templates, template_versions
0004_deck                 decks, deck_versions, panels
0005_deck_active_version  decks.active_version_id FK 추가 (순환 참조 해소)
0006_run                  runs, run_items
0007_brand                brand_kits, brand_assets
0008_system               webhook_events, notifications, audit_logs
```

Phase 2에서 `0009_board`(boards, board_rows, board_row_outputs, series_templates), Phase 3에서 `0010_publish`를 추가한다.

**주의**: `decks.active_version_id`와 `deck_versions.deck_id`는 순환 참조이므로 FK를 같은 마이그레이션에 넣으면 실패한다. 반드시 `0005`에서 분리해 추가한다.
