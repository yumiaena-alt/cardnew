import {
  boolean,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { boardRows, boards } from './Board';
import { decks } from './Deck';
import { channelEnum, runScopeKindEnum, runStatusEnum } from './Enums';
import { cardnews } from './Namespace';
import { organizations, users } from './Org';

/**
 * One generation execution, and the only unit credits are charged against.
 * A run is created in `estimated` state by the dry-run quote, so the estimate
 * the user accepted and the amount actually charged sit on the same row.
 */
export const runs = cardnews.table(
  'runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    /** Null for a single-deck run started outside the monthly board. */
    boardId: uuid('board_id').references(() => boards.id, { onDelete: 'set null' }),
    status: runStatusEnum('status').notNull().default('estimated'),
    scopeKind: runScopeKindEnum('scope_kind').notNull().default('full'),
    itemCount: integer('item_count').notNull(),
    estimatedCredits: integer('estimated_credits').notNull(),
    chargedCredits: integer('charged_credits').notNull().default(0),
    refundedCredits: integer('refunded_credits').notNull().default(0),
    /** Repeating a request with the same key returns the existing run instead of charging again. */
    idempotencyKey: text('idempotency_key').notNull(),
    /**
     * Real provider cost of this run. Recorded so the credit price can be
     * checked against what generation actually costs rather than guessed.
     */
    costSnapshot: jsonb('cost_snapshot').$type<{
      llmInputTokens: number;
      llmOutputTokens: number;
      imageCount: number;
      providerCostUsd: number;
    }>(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('runs_idempotency_uq').on(t.idempotencyKey),
    index('runs_org_created_idx').on(t.orgId, t.createdAt),
    index('runs_status_idx').on(t.status),
  ],
);

/**
 * One cut inside a run. Items carry their own status because partial failure is
 * expected: a single failed card leaves the rest of the run to finish, and only
 * the failed items are refunded.
 */
export const runItems = cardnews.table(
  'run_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    runId: uuid('run_id')
      .notNull()
      .references(() => runs.id, { onDelete: 'cascade' }),
    rowId: uuid('row_id').references(() => boardRows.id, { onDelete: 'set null' }),
    deckId: uuid('deck_id').references(() => decks.id, { onDelete: 'set null' }),
    channel: channelEnum('channel').notNull(),
    isOrigin: boolean('is_origin').notNull(),
    estimatedCredits: integer('estimated_credits').notNull(),
    status: runStatusEnum('status').notNull().default('queued'),
    attempts: integer('attempts').notNull().default(0),
    errorMessage: text('error_message'),
  },
  (t) => [index('run_items_run_status_idx').on(t.runId, t.status)],
);

export type Run = typeof runs.$inferSelect;
export type NewRun = typeof runs.$inferInsert;
export type RunItem = typeof runItems.$inferSelect;
export type NewRunItem = typeof runItems.$inferInsert;
export type RunStatus = (typeof runStatusEnum.enumValues)[number];
