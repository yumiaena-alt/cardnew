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
import { ratioEnum, templateSourceEnum } from './Enums';
import { cardnews } from './Namespace';
import { organizations } from './Org';

/**
 * One editable region of a card. The box is normalised to 0~1 of the canvas
 * rather than stored in pixels, so the same layout survives a ratio change and
 * fan-out does not need a separate design per channel.
 */
export type PanelSlotSpec = {
  key: string;
  type: 'text' | 'image' | 'shape';
  box: { x: number; y: number; w: number; h: number };
  maxChars?: number;
  style?: Record<string, string>;
};

export type PanelLayoutSpec = {
  role: 'cover' | 'body' | 'cta';
  slots: PanelSlotSpec[];
};

/**
 * A template is a slot schema plus style tokens, never a finished image. The
 * mutable parts live in `template_versions` so an edit cannot silently change
 * cards that were already generated from an earlier version.
 */
export const templates = cardnews.table(
  'templates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** Null marks a system template offered to every tenant. */
    orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    source: templateSourceEnum('source').notNull().default('system'),
    ratio: ratioEnum('ratio').notNull(),
    defaultPanelCount: integer('default_panel_count').notNull().default(6),
    styleTags: jsonb('style_tags').$type<string[]>().notNull().default([]),
    previewPath: text('preview_path'),
    isArchived: boolean('is_archived').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('templates_org_ratio_idx').on(t.orgId, t.ratio),
    index('templates_source_idx').on(t.source),
  ],
);

export const templateVersions = cardnews.table(
  'template_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    templateId: uuid('template_id')
      .notNull()
      .references(() => templates.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    layouts: jsonb('layouts').$type<PanelLayoutSpec[]>().notNull(),
    tokens: jsonb('tokens').$type<Record<string, string>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('template_versions_template_version_uq').on(t.templateId, t.version)],
);

/**
 * Record of learning a template from reference images. The result belongs to the
 * organization that supplied the references and never transfers to another one.
 */
export const designLearnings = cardnews.table(
  'design_learnings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    sourceAssetIds: jsonb('source_asset_ids').$type<string[]>().notNull(),
    ratio: ratioEnum('ratio').notNull(),
    customInstruction: text('custom_instruction'),
    producedTemplateId: uuid('produced_template_id').references(() => templates.id, {
      onDelete: 'set null',
    }),
    /** Proof that the uploader confirmed they hold rights to the references. */
    rightsConfirmedAt: timestamp('rights_confirmed_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('design_learnings_org_idx').on(t.orgId)],
);

export type Template = typeof templates.$inferSelect;
export type NewTemplate = typeof templates.$inferInsert;
export type TemplateVersion = typeof templateVersions.$inferSelect;
export type NewTemplateVersion = typeof templateVersions.$inferInsert;
export type DesignLearning = typeof designLearnings.$inferSelect;
export type NewDesignLearning = typeof designLearnings.$inferInsert;
export type TemplateSource = (typeof templateSourceEnum.enumValues)[number];
