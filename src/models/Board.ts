import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { decks } from './Deck';
import type { Channel, Ratio } from './Enums';
import { boardRowStatusEnum, channelEnum, ratioEnum } from './Enums';
import { cardnews } from './Namespace';
import { organizations, projects, users } from './Org';
import { templateVersions } from './Template';

export type BoardColumn = {
  key: string;
  label: string;
  type: 'topic' | 'channel' | 'template' | 'date' | 'text' | 'number' | 'tags';
  width: number;
  isRequired: boolean;
};

/** One channel a row expands into. Exactly one target per row carries `isOrigin`. */
export type FanoutTarget = {
  channel: Channel;
  ratio: Ratio;
  templateVersionId?: string;
  isOrigin: boolean;
};

export const boards = cardnews.table(
  'boards',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    periodStart: date('period_start'),
    periodEnd: date('period_end'),
    columnConfig: jsonb('column_config').$type<BoardColumn[]>().notNull(),
    defaultFanout: jsonb('default_fanout').$type<FanoutTarget[]>().notNull().default([]),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('boards_org_period_idx').on(t.orgId, t.periodStart)],
);

export const boardRows = cardnews.table(
  'board_rows',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    boardId: uuid('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    /** Sparse ordering (1000, 2000, 3000…) so a reorder rewrites one row, not the sheet. */
    position: integer('position').notNull(),
    topic: text('topic').notNull(),
    cells: jsonb('cells').$type<Record<string, unknown>>().notNull().default({}),
    fanoutTargets: jsonb('fanout_targets').$type<FanoutTarget[]>().notNull().default([]),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    status: boardRowStatusEnum('status').notNull().default('draft'),
    estimatedCredits: integer('estimated_credits').notNull().default(0),
    /** Left unconstrained on purpose: pruning run history must not touch the sheet. */
    lastRunId: uuid('last_run_id'),
    errorMessage: text('error_message'),
  },
  (t) => [
    index('board_rows_board_position_idx').on(t.boardId, t.position),
    index('board_rows_board_status_idx').on(t.boardId, t.status),
  ],
);

/**
 * The row → channel expansion, one deck per cut. This table is what makes the
 * split price defensible: the origin cut is charged in full and every derived
 * cut at the fan-out rate, and both are recorded next to the deck they produced.
 */
export const boardRowOutputs = cardnews.table(
  'board_row_outputs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    rowId: uuid('row_id')
      .notNull()
      .references(() => boardRows.id, { onDelete: 'cascade' }),
    deckId: uuid('deck_id')
      .notNull()
      .references(() => decks.id, { onDelete: 'cascade' }),
    channel: channelEnum('channel').notNull(),
    ratio: ratioEnum('ratio').notNull(),
    isOrigin: boolean('is_origin').notNull().default(false),
    creditsCharged: integer('credits_charged').notNull().default(0),
    runItemId: uuid('run_item_id'),
  },
  (t) => [
    index('board_row_outputs_row_idx').on(t.rowId),
    uniqueIndex('board_row_outputs_row_channel_uq').on(t.rowId, t.channel, t.ratio),
  ],
);

/** Recurring publishing slot — "every Tuesday is the tips series". */
export const seriesTemplates = cardnews.table(
  'series_templates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** RFC 5545 RRULE, for example `FREQ=WEEKLY;BYDAY=TU`. */
    rrule: text('rrule').notNull(),
    templateVersionId: uuid('template_version_id')
      .notNull()
      .references(() => templateVersions.id),
    fanoutPreset: jsonb('fanout_preset').$type<FanoutTarget[]>().notNull(),
    /** Wall-clock time in the organization timezone, not UTC. */
    defaultTimeLocal: text('default_time_local').notNull().default('19:00'),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => [index('series_templates_project_idx').on(t.projectId)],
);

export type Board = typeof boards.$inferSelect;
export type NewBoard = typeof boards.$inferInsert;
export type BoardRow = typeof boardRows.$inferSelect;
export type NewBoardRow = typeof boardRows.$inferInsert;
export type BoardRowOutput = typeof boardRowOutputs.$inferSelect;
export type NewBoardRowOutput = typeof boardRowOutputs.$inferInsert;
export type SeriesTemplate = typeof seriesTemplates.$inferSelect;
export type NewSeriesTemplate = typeof seriesTemplates.$inferInsert;
export type BoardRowStatus = (typeof boardRowStatusEnum.enumValues)[number];
