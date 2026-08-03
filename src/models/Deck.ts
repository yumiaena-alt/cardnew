import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { index, integer, jsonb, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { channelEnum, deckStatusEnum, ratioEnum, runScopeKindEnum } from './Enums';
import { cardnews } from './Namespace';
import { organizations, projects, users } from './Org';
import { templateVersions } from './Template';

/**
 * Where a stock photo came from.
 *
 * Stored with the slot rather than in a side table because attribution has to
 * survive as long as the image is on screen: Unsplash requires the credit to be
 * shown, and `commercialSafe` is what the publishing path checks before a card
 * goes out to a paying user's audience.
 */
export type SlotProvenance = {
  source: string;
  sourceId: string;
  sourceUrl: string | null;
  authorName: string | null;
  authorUrl: string | null;
  license: string;
  attributionRequired: boolean;
  commercialSafe: boolean;
};

/**
 * The planning inputs behind one panel.
 *
 * A structural subset of the planner's slide schema — only the fields a repaint
 * actually reads. Copying the whole planner type here would couple the stored
 * shape to a prompt format that is expected to change.
 */
export type PanelPlan = {
  role: string;
  headline: string;
  body: string | null;
  eyebrow: string | null;
  imageQuery: string;
  imageMood: string;
  templateHint: string | null;
};

/** The value a slot currently holds — text content, or the id of an image asset. */
export type PanelSlotValue = {
  type: 'text' | 'image' | 'shape';
  value: string;
  style?: Record<string, string>;
  /** Set on image slots sourced from a stock provider. */
  provenance?: SlotProvenance;
  /** A slot the user edited by hand survives regeneration untouched. */
  isUserEdited?: boolean;
};

export const decks = cardnews.table(
  'decks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    topic: text('topic').notNull(),
    channel: channelEnum('channel').notNull(),
    ratio: ratioEnum('ratio').notNull(),
    status: deckStatusEnum('status').notNull().default('drafting'),
    /**
     * Points at the version currently shown to the user. `deck_versions.deck_id`
     * points back, so the two form a cycle: the foreign key lives in migration
     * `0005` on its own because inlining it would make `CREATE TABLE` fail.
     * Cleared rather than cascaded, so dropping a version cannot delete the deck.
     *
     * The reference below reads `deckVersions` before its declaration, which is
     * unavoidable for a cycle and safe here: the callback is lazy, so it runs
     * only after both tables exist.
     */
    // oxlint-disable-next-line no-use-before-define
    activeVersionId: uuid('active_version_id').references((): AnyPgColumn => deckVersions.id, {
      onDelete: 'set null',
    }),
    /** Duplicate-topic detection. Jsonb for now; moves to pgvector in Phase 3. */
    topicEmbedding: jsonb('topic_embedding').$type<number[]>(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('decks_org_status_idx').on(t.orgId, t.status),
    index('decks_project_created_idx').on(t.projectId, t.createdAt),
  ],
);

/**
 * Version tree. `parentVersionId` records which version a partial regeneration
 * branched from, so the lineage of a single edited slot stays reconstructable.
 */
export const deckVersions = cardnews.table(
  'deck_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    deckId: uuid('deck_id')
      .notNull()
      .references(() => decks.id, { onDelete: 'cascade' }),
    parentVersionId: uuid('parent_version_id'),
    label: text('label').notNull(),
    templateVersionId: uuid('template_version_id').references(() => templateVersions.id),
    /** Set once `runs` exists; kept unconstrained so a purged run cannot orphan a version. */
    runId: uuid('run_id'),
    creditsCharged: integer('credits_charged').notNull().default(0),
    scopeKind: runScopeKindEnum('scope_kind').notNull().default('full'),
    scopeDetail: jsonb('scope_detail').$type<{ panelIndex?: number; slotKey?: string }>(),
    /**
     * Stitched reel, when one has been built. Null until someone asks for it —
     * most decks are posted as a carousel and never need a video.
     */
    videoPath: text('video_path'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('deck_versions_deck_idx').on(t.deckId),
    index('deck_versions_parent_idx').on(t.parentVersionId),
  ],
);

export const panels = cardnews.table(
  'panels',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    versionId: uuid('version_id')
      .notNull()
      .references(() => deckVersions.id, { onDelete: 'cascade' }),
    index: integer('index').notNull(),
    role: text('role').notNull().default('body'),
    slots: jsonb('slots').$type<Record<string, PanelSlotValue>>().notNull(),
    /**
     * The planned slide this panel was composed from.
     *
     * Kept because a repaint needs inputs the rendered image cannot give back:
     * the image search term, the mood that drove contrast, the template hint.
     * Without it, regenerating one card would mean re-planning the whole deck.
     */
    plan: jsonb('plan').$type<PanelPlan>(),
    /** Storage path of the rendered PNG. Null until the render service returns. */
    renderPath: text('render_path'),
    blurDataUrl: text('blur_data_url'),
  },
  (t) => [uniqueIndex('panels_version_index_uq').on(t.versionId, t.index)],
);

export type Deck = typeof decks.$inferSelect;
export type NewDeck = typeof decks.$inferInsert;
export type DeckVersion = typeof deckVersions.$inferSelect;
export type NewDeckVersion = typeof deckVersions.$inferInsert;
export type Panel = typeof panels.$inferSelect;
export type NewPanel = typeof panels.$inferInsert;
export type DeckStatus = (typeof deckStatusEnum.enumValues)[number];
export type RunScopeKind = (typeof runScopeKindEnum.enumValues)[number];
