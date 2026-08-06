import type { SlideRole } from '@/lib/slidedoc/doc';
import type { Layer } from '@/lib/slidedoc/layers';
import type { PanelLayoutSpec, PanelSlotSpec } from '@/models/Template';
import { backgroundLayers, text } from './covers';
import type { BuildContext, BuildResult, Template } from './types';

/**
 * Learned layouts as templates.
 *
 * A learned design arrives as data: slot keys and boxes. Built-in templates are
 * builder functions, because decisions like which way an overlay runs and
 * whether text inverts come from the measured luminance of the photo behind it,
 * and data cannot make a decision.
 *
 * So the data is wrapped in a builder rather than given a path of its own. The
 * boxes come from what was learned; the contrast decisions come from the same
 * helper every built-in template uses. A learned design that put white text on
 * a bright photo would otherwise be unreadable in exactly the way the built-in
 * ones are careful not to be.
 */

/** Font sizes the learned boxes are filled at before autofit adjusts them. */
const SIZE_BY_ROLE = {
  headline: 84,
  subhead: 52,
  body: 38,
  eyebrow: 26,
  caption: 24,
  badge: 26,
  pagenum: 22,
} as const;

type TextRole = keyof typeof SIZE_BY_ROLE;

/**
 * Whether a learned slot key names a text role we can place.
 *
 * A learned design can name a slot anything; this is the gate between what a
 * model wrote and the roles the renderer knows, and it narrows rather than
 * casts so an unknown key cannot be waved through as one of ours.
 *
 * @param key - The slot key as learned.
 * @returns Whether it is a text role.
 */
function isTextRole(key: string): key is TextRole {
  return key in SIZE_BY_ROLE;
}

/**
 * Slide roles a learned layout applies to.
 *
 * A learned design distinguishes three kinds of card, while a plan names six.
 * The four middle roles are all "a card in the body of the deck", which is
 * exactly what a body layout was read from.
 */
const SLIDE_ROLES: Record<PanelLayoutSpec['role'], readonly SlideRole[]> = {
  cover: ['cover'],
  body: ['problem', 'point', 'example', 'quote'],
  cta: ['cta'],
};

/** Where a learned layout's copy comes from, by slot key. */
function contentFor(key: string, context: BuildContext): string | null {
  const { plan, pageLabel } = context;

  if (key === 'headline') {
    return plan.headline;
  }

  if (key === 'body') {
    return plan.body;
  }

  if (key === 'eyebrow' || key === 'badge') {
    return plan.eyebrow;
  }

  if (key === 'pagenum') {
    return pageLabel;
  }

  return null;
}

/**
 * Places one learned slot.
 *
 * @param slot - The slot as it was learned.
 * @param context - What is being built.
 * @param colors - Text colours the background helper settled on.
 * @returns The layer, or null when there is nothing to put in it.
 */
function toLayer(
  slot: PanelSlotSpec,
  context: BuildContext,
  colors: { textColor: string; mutedColor: string },
): Layer | null {
  if (slot.type !== 'text' || !isTextRole(slot.key)) {
    return null;
  }

  const role = slot.key;
  const content = contentFor(role, context);

  if (content === null || content.trim() === '') {
    return null;
  }

  const isQuiet = role === 'pagenum' || role === 'caption';

  return text({
    id: slot.key,
    role,
    content,
    // Learned boxes are absolute, so they anchor from the top left rather than
    // joining a stack — the layout was read off a design that already resolved
    // where things sit relative to each other.
    anchor: 'top-left',
    x: slot.box.x,
    y: slot.box.y,
    w: slot.box.w,
    size: SIZE_BY_ROLE[role],
    weight:
      role === 'headline'
        ? (context.brand.typography.headingWeight ?? 700)
        : (context.brand.typography.bodyWeight ?? 400),
    family: 'sans',
    color: isQuiet ? colors.mutedColor : colors.textColor,
    lineHeight: 1.25,
    maxLines: role === 'headline' ? 4 : 6,
  });
}

/**
 * Turns one learned layout into a template.
 *
 * @param layout - The layout as it was learned.
 * @param index - Position in the learned set, for a stable id.
 * @returns A template the selector can pick like any other.
 */
function toTemplate(layout: PanelLayoutSpec, index: number): Template {
  return {
    id: `learned-${layout.role}-${index}`,
    name: `학습 ${layout.role}`,
    roles: SLIDE_ROLES[layout.role],
    // A learned layout works on a flat background as well as a photo; whether a
    // photo is used is the plan's business, not the template's.
    requiresImage: false,
    vibe: 'editorial',
    build(context): BuildResult {
      const headline = layout.slots.find((slot) => slot.key === 'headline');
      const bg = backgroundLayers(
        context,
        SIZE_BY_ROLE.headline,
        context.brand.typography.headingWeight ?? 700,
        // Overlay follows where the copy sits: text low on the card needs the
        // bottom darkened, text high needs the top.
        (headline?.box.y ?? 0.5) > 0.5 ? 'bottom' : 'top',
        (headline?.box.y ?? 0.5) > 0.5 ? 'bottom' : 'top',
      );

      const layers = [
        ...bg.layers,
        ...layout.slots
          .map((slot) => toLayer(slot, context, bg))
          .filter((layer): layer is Layer => layer !== null),
      ];

      return { layers, background: { kind: 'solid', color: bg.background } };
    },
  };
}

/**
 * Turns a learned design into templates the selector can choose from.
 *
 * @param layouts - Layouts stored on the template version.
 * @returns One template per layout.
 */
export function learnedTemplates(layouts: PanelLayoutSpec[]): Template[] {
  return layouts.map(toTemplate);
}
