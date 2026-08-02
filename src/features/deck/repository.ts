import { eq, isNull } from 'drizzle-orm';
import { orgScoped } from '@/features/shared/orgScope';
import type { OrgScope } from '@/features/shared/scope';
import { db } from '@/libs/DB';
import type { Deck, DeckVersion, NewPanel, Panel } from '@/models/Deck';
import { deckVersions, decks, panels } from '@/models/Deck';
import { projects } from '@/models/Org';

/**
 * Deck, version, and panel access.
 *
 * A deck is never written without a version: the version is what carries the
 * panels and the credits that produced them, so a deck row on its own would
 * describe generation that cannot be traced back to a charge.
 */

export type CreateDeckInput = {
  projectId: string;
  title: string;
  topic: string;
  channel: Deck['channel'];
  ratio: Deck['ratio'];
  createdBy: string;
  runId: string;
  templateVersionId?: string;
  creditsCharged: number;
};

/**
 * Finds the organization's default project.
 *
 * Phase 1~3 keeps exactly one project per organization and hides the switcher,
 * so generation resolves it here rather than making every caller pass one.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @returns The default project id, or null when the tenant has none yet.
 */
export async function findDefaultProjectId(scope: OrgScope): Promise<string | null> {
  const [row] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(orgScoped(scope, projects, eq(projects.isDefault, true), isNull(projects.deletedAt)))
    .limit(1);

  return row?.id ?? null;
}

/**
 * Creates a deck with its first version, and points the deck at that version.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @param input - Deck fields plus the run that produced it.
 * @returns The created deck and version.
 */
export async function createDeckWithVersion(
  scope: OrgScope,
  input: CreateDeckInput,
): Promise<{ deck: Deck; version: DeckVersion }> {
  return await db.transaction(async (tx) => {
    const [deck] = await tx
      .insert(decks)
      .values({
        orgId: scope.orgId,
        projectId: input.projectId,
        title: input.title,
        topic: input.topic,
        channel: input.channel,
        ratio: input.ratio,
        status: 'drafting',
        createdBy: input.createdBy,
      })
      .returning();

    if (!deck) {
      throw new Error('Deck insert returned no row');
    }

    const [version] = await tx
      .insert(deckVersions)
      .values({
        deckId: deck.id,
        label: 'v1',
        templateVersionId: input.templateVersionId,
        runId: input.runId,
        creditsCharged: input.creditsCharged,
        scopeKind: 'full',
      })
      .returning();

    if (!version) {
      throw new Error('Deck version insert returned no row');
    }

    const [linked] = await tx
      .update(decks)
      .set({ activeVersionId: version.id })
      .where(eq(decks.id, deck.id))
      .returning();

    return { deck: linked ?? deck, version };
  });
}

/**
 * Replaces the panels of one version.
 *
 * Written as delete-then-insert so a retried render cannot leave a version
 * holding panels from two different attempts at once.
 *
 * @param versionId - Version whose panels to write.
 * @param rows - Panel rows, minus `versionId`.
 * @returns The stored panels.
 */
export async function replacePanels(
  versionId: string,
  rows: Omit<NewPanel, 'versionId'>[],
): Promise<Panel[]> {
  return await db.transaction(async (tx) => {
    await tx.delete(panels).where(eq(panels.versionId, versionId));

    if (rows.length === 0) {
      return [];
    }

    return await tx
      .insert(panels)
      .values(rows.map((row) => ({ ...row, versionId })))
      .returning();
  });
}

/**
 * Marks a deck ready once every panel of its active version has rendered.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @param deckId - Deck to mark.
 * @param status - Status to apply.
 * @returns The updated deck, or null when it is not the caller's.
 */
export async function setDeckStatus(
  scope: OrgScope,
  deckId: string,
  status: Deck['status'],
): Promise<Deck | null> {
  const [row] = await db
    .update(decks)
    .set({ status })
    .where(orgScoped(scope, decks, eq(decks.id, deckId)))
    .returning();

  return row ?? null;
}
