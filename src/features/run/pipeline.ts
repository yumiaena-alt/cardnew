import { createDeckWithVersion, replacePanels, setDeckStatus } from '@/features/deck/repository';
import type { OrgScope } from '@/features/shared/scope';
import { AnthropicPlanner } from '@/lib/plan/planner';
import type { CardnewsPlan } from '@/lib/plan/schema';
import type { ComposedCardnews } from '@/lib/renderer/compose';
import { composeCardnews } from '@/lib/renderer/compose';
import { logger } from '@/libs/Logger';
import { PANEL_CONTENT_TYPE, renderPanel } from '@/libs/RenderService';
import { panelRenderPath, RENDER_BUCKET, uploadObject } from '@/libs/Storage';
import type { NewPanel, PanelSlotValue, SlotProvenance } from '@/models/Deck';
import type { RunItem } from '@/models/Run';
import type { SlideImagery } from './imagery';
import { sourceImagery } from './imagery';

/**
 * Generation of one cut, from topic to stored panels.
 *
 * The plan is produced once per source topic and reused by every derived cut.
 * That is what the split price pays for: the origin buys the writing, and a
 * derived cut only re-lays the same copy out at another ratio, so re-planning
 * per channel would spend model tokens on work already done and, worse, let the
 * channels drift apart in wording.
 */

export type GenerateCutInput = {
  scope: OrgScope;
  item: RunItem;
  projectId: string;
  createdBy: string;
  /** Plan from the origin cut of the same topic. Absent for the origin itself. */
  plan?: CardnewsPlan;
  /** Photography sourced by the origin cut. Reused so channels stay visually consistent. */
  imagery?: SlideImagery;
};

export type GenerateCutResult = {
  deckId: string;
  plan: CardnewsPlan;
  imagery: SlideImagery;
  panelCount: number;
  /** Typesetting problems worth surfacing. Not failures. */
  warnings: string[];
  usage: { inputTokens: number; outputTokens: number };
};

/** Rendering at 2x keeps text crisp on retina without doubling the byte size. */
const RENDER_SCALE = 2;

/**
 * Produces the plan for a cut, reusing the origin's when there is one.
 *
 * @param item - The run item being generated.
 * @param reuse - Plan from the origin cut of this topic, when available.
 * @returns The plan and what it cost, zero when reused.
 */
async function resolvePlan(
  item: RunItem,
  reuse: CardnewsPlan | undefined,
): Promise<{ plan: CardnewsPlan; usage: { inputTokens: number; outputTokens: number } }> {
  if (reuse) {
    return { plan: reuse, usage: { inputTokens: 0, outputTokens: 0 } };
  }

  const result = await new AnthropicPlanner().generate({
    request: {
      topic: item.topic,
      ratio: item.ratio,
      slideCount: 'auto',
      language: 'ko',
      imageSource: 'stock',
      imageScope: 'safe',
      reviewPlanFirst: false,
      brandKitId: null,
    },
  });

  return { plan: result.plan, usage: result.usage };
}

type PanelRow = Omit<NewPanel, 'versionId'>;

/**
 * Turns one planned slide into the editable slot values stored on its panel.
 *
 * The copy is persisted alongside the rendered image rather than only baked
 * into the PNG: editing a headline later has to change text, not pixels, and
 * regenerating a single slot needs to know what was there before.
 *
 * @param slide - The planned slide.
 * @returns Slot values keyed by slot name, omitting the empty ones.
 */
/**
 * Maps a planned slide onto the panel role the editor groups by.
 *
 * @param role - Role the planner assigned.
 * @param index - Position of the slide in the deck.
 * @returns The stored panel role.
 */
function toPanelRole(role: CardnewsPlan['slides'][number]['role'] | undefined, index: number) {
  if (role === 'cta') {
    return 'cta';
  }

  return index === 0 ? 'cover' : 'body';
}

function toSlots(
  slide: CardnewsPlan['slides'][number],
  provenance: SlotProvenance | null,
): Record<string, PanelSlotValue> {
  const slots: Record<string, PanelSlotValue> = {
    headline: { type: 'text', value: slide.headline },
  };

  if (slide.body) {
    slots.body = { type: 'text', value: slide.body };
  }

  if (slide.eyebrow) {
    slots.eyebrow = { type: 'text', value: slide.eyebrow };
  }

  if (provenance) {
    // The value is the provider's own id, not our path: the bytes live in the
    // rendered PNG, and what has to survive is who the photo belongs to.
    slots.background = {
      type: 'image',
      value: `${provenance.source}:${provenance.sourceId}`,
      provenance,
    };
  }

  return slots;
}

/**
 * Renders every slide of a composed deck and stores the images.
 *
 * @param input - Organization, version, the composed slides, and the plan behind them.
 * @returns Panel rows ready to persist, plus typesetting warnings.
 */
async function renderAndStore(input: {
  orgId: string;
  versionId: string;
  composed: ComposedCardnews;
  plan: CardnewsPlan;
  imagery: SlideImagery;
}): Promise<{ rows: PanelRow[]; warnings: string[] }> {
  const rows: PanelRow[] = [];
  const warnings: string[] = [];

  for (const [index, slide] of input.composed.slides.entries()) {
    const rendered = await renderPanel(slide.doc, RENDER_SCALE);
    const path = panelRenderPath({ orgId: input.orgId, versionId: input.versionId, index });

    await uploadObject({
      bucket: RENDER_BUCKET,
      path,
      body: rendered.bytes,
      contentType: PANEL_CONTENT_TYPE,
    });

    warnings.push(...rendered.overflows.map((layer) => `overflow:${index}:${layer}`));
    warnings.push(...rendered.collisions.map((pair) => `collision:${index}:${pair}`));

    const planned = input.plan.slides[index];

    rows.push({
      index,
      role: toPanelRole(planned?.role, index),
      slots: planned ? toSlots(planned, input.imagery.provenance[index] ?? null) : {},
      // Stored so one card can be repainted later without re-planning the deck.
      plan: planned
        ? {
            role: planned.role,
            headline: planned.headline,
            body: planned.body,
            eyebrow: planned.eyebrow,
            imageQuery: planned.imageQuery,
            imageMood: planned.imageMood,
            templateHint: planned.templateHint,
          }
        : null,
      renderPath: path,
    });
  }

  return { rows, warnings };
}

/**
 * Generates one cut end to end: plan, compose, render, store, persist.
 *
 * @param input - Scope, the run item, the owning project, and a reusable plan.
 * @returns The created deck, the plan for derived cuts to reuse, and warnings.
 * @throws Error when planning, rendering, or storage fails.
 */
export async function generateCut(input: GenerateCutInput): Promise<GenerateCutResult> {
  const { plan, usage } = await resolvePlan(input.item, input.plan);
  const imagery = input.imagery ?? (await sourceImagery(plan, input.item.ratio));

  const composed = composeCardnews({
    plan,
    ratio: input.item.ratio,
    images: imagery.images,
    // Seeded by the item so a retry redraws the same layout rather than
    // silently producing a different design for the same charge.
    seed: input.item.id,
  });

  const { deck, version } = await createDeckWithVersion(input.scope, {
    projectId: input.projectId,
    // The plan's hook is the cover line, which is what a user recognises the
    // deck by in a list. The raw topic is the fallback when the hook is empty.
    title: plan.hook.trim() === '' ? input.item.topic : plan.hook,
    topic: input.item.topic,
    channel: input.item.channel,
    ratio: input.item.ratio,
    createdBy: input.createdBy,
    runId: input.item.runId,
    templateVersionId: input.item.templateVersionId ?? undefined,
    creditsCharged: input.item.estimatedCredits,
  });

  const { rows, warnings } = await renderAndStore({
    orgId: input.scope.orgId,
    versionId: version.id,
    composed,
    plan,
    imagery,
  });

  await replacePanels(version.id, rows);
  await setDeckStatus(input.scope, deck.id, 'ready');

  logger.info('Cut generated', {
    orgId: input.scope.orgId,
    runId: input.item.runId,
    deckId: deck.id,
    panels: rows.length,
    warnings: warnings.length,
  });

  return { deckId: deck.id, plan, imagery, panelCount: rows.length, warnings, usage };
}
