import { findDeckDetail, replacePanels } from '@/features/deck/repository';
import type { OrgScope } from '@/features/shared/scope';
import { cardnewsPlanSchema, slidePlanSchema } from '@/lib/plan/schema';
import type { SlidePlan } from '@/lib/plan/schema';
import { composeCardnews } from '@/lib/renderer/compose';
import { logger } from '@/libs/Logger';
import { PANEL_CONTENT_TYPE, renderPanel } from '@/libs/RenderService';
import { panelRenderPath, RENDER_BUCKET, uploadObject } from '@/libs/Storage';
import type { Panel, PanelPlan } from '@/models/Deck';
import type { RunItem } from '@/models/Run';

/**
 * Repainting part of a deck.
 *
 * Distinct from generating one: nothing new is planned and nothing new is
 * created. The stored plan is composed again with whatever the slots now say,
 * so a headline the user fixed by hand ends up in the image rather than being
 * overwritten by the wording the model originally chose.
 */

/** Matches the render scale used for a full generation, so cards stay uniform. */
const RENDER_SCALE = 2;

export type RegenerateResult = {
  deckId: string;
  /** Panels whose image was rebuilt. */
  repainted: number;
  warnings: string[];
};

/**
 * Rebuilds the planned slide from a panel, letting edited copy win.
 *
 * The slots are the current truth about what the card says — they are what the
 * editor writes to — so they override the plan's original wording. The rest of
 * the plan is what the image needs and the slots do not carry.
 *
 * Parsed through the planner's own schema rather than trusted: the column is
 * jsonb written by an older version of this code, and a role or mood the
 * renderer no longer knows should fail here rather than three layers down.
 *
 * @param panel - The stored panel.
 * @returns The slide to compose, or null when it cannot be rebuilt.
 */
function toSlidePlan(panel: Panel): SlidePlan | null {
  if (!panel.plan) {
    return null;
  }

  const { headline, body, eyebrow } = panel.slots;

  const merged: PanelPlan = {
    ...panel.plan,
    headline: headline?.type === 'text' ? headline.value : panel.plan.headline,
    body: body?.type === 'text' ? body.value : panel.plan.body,
    eyebrow: eyebrow?.type === 'text' ? eyebrow.value : panel.plan.eyebrow,
  };

  const parsed = slidePlanSchema.safeParse(merged);

  return parsed.success ? parsed.data : null;
}

/**
 * Repaints the panels a partial run targets.
 *
 * Only the targeted panel is re-rendered; the rest of the deck keeps the images
 * it already has. That is what makes a partial cost a fraction of a full run —
 * the saving is real work not done, not a discount.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @param input - The run item, and which panel it targets.
 * @returns What was repainted.
 * @throws Error when the deck, the panel, or its stored plan is missing.
 */
export async function regeneratePanels(
  scope: OrgScope,
  input: { item: RunItem; panelIndex: number },
): Promise<RegenerateResult> {
  const { deckId } = input.item;

  if (!deckId) {
    throw new Error('Partial regeneration has no deck to edit');
  }

  const detail = await findDeckDetail(scope, deckId);

  if (!detail) {
    throw new Error(`Deck ${deckId} not found`);
  }

  const target = detail.panels.find((panel) => panel.index === input.panelIndex);

  if (!target) {
    throw new Error(`Panel ${input.panelIndex} not found`);
  }

  const slide = toSlidePlan(target);

  if (!slide) {
    throw new Error('Panel has no stored plan and cannot be repainted');
  }

  // Composed as a one-slide deck. The template picker is seeded by the panel id,
  // so a repaint lands on the same template the card already used.
  const composed = composeCardnews({
    plan: cardnewsPlanSchema.parse({
      hook: slide.headline,
      caption: '',
      hashtags: [],
      targetAudience: null,
      slides: [slide],
    }),
    ratio: detail.deck.ratio,
    seed: target.id,
  });

  const [rendered] = composed.slides;

  if (!rendered) {
    throw new Error('Composition produced no slide');
  }

  const image = await renderPanel(rendered.doc, RENDER_SCALE);
  const path = panelRenderPath({
    orgId: scope.orgId,
    versionId: target.versionId,
    index: target.index,
  });

  await uploadObject({
    bucket: RENDER_BUCKET,
    path,
    body: image.bytes,
    contentType: PANEL_CONTENT_TYPE,
  });

  // Every panel is rewritten because `replacePanels` owns the whole version;
  // only the targeted one carries new bytes and a cleared edit flag.
  await replacePanels(
    target.versionId,
    detail.panels.map((panel) => ({
      index: panel.index,
      role: panel.role,
      slots:
        panel.id === target.id
          ? Object.fromEntries(
              Object.entries(panel.slots).map(([key, slot]) => [
                key,
                { ...slot, isUserEdited: false },
              ]),
            )
          : panel.slots,
      plan: panel.id === target.id ? slide : panel.plan,
      renderPath: panel.id === target.id ? path : panel.renderPath,
      blurDataUrl: panel.blurDataUrl,
    })),
  );

  logger.info('Panel repainted', {
    orgId: scope.orgId,
    runId: input.item.runId,
    deckId,
    panelIndex: input.panelIndex,
  });

  return {
    deckId,
    repainted: 1,
    warnings: [
      ...image.overflows.map((layer) => `overflow:${input.panelIndex}:${layer}`),
      ...image.collisions.map((pair) => `collision:${input.panelIndex}:${pair}`),
    ],
  };
}
