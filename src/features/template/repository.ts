import { and, desc, eq } from 'drizzle-orm';
import type { OrgScope } from '@/features/shared/scope';
import { db } from '@/libs/DB';
import type { Ratio } from '@/models/Enums';
import type { PanelLayoutSpec, Template } from '@/models/Template';
import { designLearnings, templates, templateVersions } from '@/models/Template';

/**
 * Storage for learned templates.
 *
 * A learned design is written as a template plus its first version plus the
 * record of what it was learned from, in one transaction. Half of that on disk
 * is a template nobody can trace back to the images someone confirmed rights
 * to — which is the record the rights confirmation exists to produce.
 */

export type SaveLearnedInput = {
  name: string;
  ratio: Ratio;
  layouts: PanelLayoutSpec[];
  tokens: Record<string, string>;
  instruction: string | null;
  imageCount: number;
};

/** Every learned template starts at one; edits add versions rather than replace. */
const FIRST_VERSION = 1;

/**
 * Writes a learned template, its first version, and how it came to exist.
 *
 * @param scope - Tenant scope.
 * @param input - The learned design and what produced it.
 * @returns The new template's id.
 */
export async function saveLearnedTemplate(
  scope: OrgScope,
  input: SaveLearnedInput,
): Promise<string> {
  return await db.transaction(async (tx) => {
    const [template] = await tx
      .insert(templates)
      .values({
        orgId: scope.orgId,
        name: input.name,
        source: 'learned',
        ratio: input.ratio,
      })
      .returning();

    if (!template) {
      throw new Error('Template insert returned nothing');
    }

    await tx.insert(templateVersions).values({
      templateId: template.id,
      version: FIRST_VERSION,
      layouts: input.layouts,
      tokens: input.tokens,
    });

    await tx.insert(designLearnings).values({
      orgId: scope.orgId,
      // The images themselves are not kept. They are someone else's work held
      // only long enough to read a structure out of, and the count is what a
      // later question about this template actually needs.
      sourceAssetIds: Array.from({ length: input.imageCount }, (_, index) => `reference-${index}`),
      ratio: input.ratio,
      customInstruction: input.instruction,
      producedTemplateId: template.id,
      rightsConfirmedAt: new Date(),
    });

    return template.id;
  });
}

type LearnedTemplate = {
  id: string;
  name: string;
  ratio: Template['ratio'];
  createdAt: Date;
  layouts: PanelLayoutSpec[];
  tokens: Record<string, string>;
};

/** A gallery, not an archive. */
const TEMPLATE_LIMIT = 50;

/**
 * Lists this organization's learned templates, newest first.
 *
 * @param scope - Tenant scope.
 * @returns The templates with their current version.
 */
export async function listLearnedTemplates(scope: OrgScope): Promise<LearnedTemplate[]> {
  return await db
    .select({
      id: templates.id,
      name: templates.name,
      ratio: templates.ratio,
      createdAt: templates.createdAt,
      layouts: templateVersions.layouts,
      tokens: templateVersions.tokens,
    })
    .from(templates)
    .innerJoin(templateVersions, eq(templateVersions.templateId, templates.id))
    .where(and(eq(templates.orgId, scope.orgId), eq(templates.source, 'learned')))
    .orderBy(desc(templates.createdAt))
    .limit(TEMPLATE_LIMIT);
}
