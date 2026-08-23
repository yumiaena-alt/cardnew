import { createDeckWithVersion, replacePanels, setDeckStatus } from '@/features/deck/repository';
import type { OrgScope } from '@/features/shared/scope';
import { generatePanelImage } from '@/lib/images/generate';
import type { ResolvedImage } from '@/lib/renderer/types';
import type { AspectRatio } from '@/lib/slidedoc/primitives';
import { BASE_NEGATIVE_PROMPT, buildCutPrompt, cutSeed } from '@/lib/toon/character';
import type { CharacterAppearance } from '@/lib/toon/character';
import { composeToonCut } from '@/lib/toon/compose';
import type { ToonCut, ToonStoryboard } from '@/lib/toon/schema';
import { generateStoryboard } from '@/lib/toon/storyboard';
import { logger } from '@/libs/Logger';
import { PANEL_CONTENT_TYPE, renderPanel } from '@/libs/RenderService';
import { createSignedUrl, panelRenderPath, RENDER_BUCKET, uploadObject } from '@/libs/Storage';
import type { NewPanel, PanelSlotValue } from '@/models/Deck';
import type { RunItem } from '@/models/Run';
import type { ArtStyle } from '@/models/Toon';
import { findCharacter, findFormula, saveStoryboard } from './repository';

/**
 * 인스타툰 한 편을, 주제에서 저장된 카드까지.
 *
 * 카드뉴스 파이프라인(`features/run/pipeline.ts`)과 같은 자리에 서고 같은 것을
 * 내놓는다 — 덱 하나와 패널 여러 장. 그래서 편집기·예약 발행·릴스·성과가
 * 전부 그대로 붙는다. 다른 것은 가운데 두 단계뿐이다: 카피 대신 스토리보드를
 * 쓰고, 사진을 찾는 대신 그림을 그린다.
 *
 * 한 컷의 그림이 실패해도 편 전체를 버리지 않는다. 대사와 나레이션은 남고
 * 그 컷만 다시 그리면 된다 — 아홉 장 중 한 장 때문에 아홉 장 값을 환불하는
 * 것보다, 여덟 장을 건네고 한 장을 다시 그리게 하는 편이 낫다.
 */

/** 2x 렌더. 카드뉴스와 같은 값이라 두 종류의 카드가 같은 선명도로 나온다. */
const RENDER_SCALE = 2;

/**
 * 캐릭터 시트 서명 URL의 수명.
 *
 * 한 편을 다 그리는 동안만 살아 있으면 된다. 컷마다 최대 90초이므로 넉넉히
 * 잡되, 제공사 쪽에 남는 링크의 수명을 필요 이상으로 늘리지 않는다.
 */
const REFERENCE_URL_TTL_SECONDS = 1800;

export type GenerateToonInput = {
  scope: OrgScope;
  item: RunItem;
  projectId: string;
  createdBy: string;
};

export type GenerateToonResult = {
  deckId: string;
  storyboardId: string;
  panelCount: number;
  /** 실제로 그려진 컷 수. 마진 계산이 이 값을 쓴다. */
  generatedImageCount: number;
  /** 일관성·조판·생성 실패. 실패가 아니라 사람이 볼 것들이다. */
  warnings: string[];
  usage: { inputTokens: number; outputTokens: number };
};

class ToonGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToonGenerationError';
  }
}

type CharacterSheet = {
  name: string;
  appearance: CharacterAppearance;
  artStyle: ArtStyle;
  seed: number;
  referenceUrl: string | null;
};

/**
 * 컷마다 그림을 그린다.
 *
 * 순차로 돈다. 아홉 장을 동시에 요청하면 제공사 쪽에서 줄을 서게 되어 벽시계
 * 시간이 크게 줄지 않는데, 실패가 한꺼번에 터지면 어느 컷이 왜 실패했는지가
 * 로그에서 뒤섞인다.
 *
 * @param input - 컷들, 캐릭터 시트, 비율.
 * @returns 컷 순서에 맞춘 이미지 배열(실패는 null), 경고, 그린 장수.
 */
async function drawCuts(input: {
  cuts: ToonCut[];
  sheet: CharacterSheet;
  ratio: AspectRatio;
}): Promise<{ images: (ResolvedImage | null)[]; warnings: string[]; drawn: number }> {
  const images: (ResolvedImage | null)[] = [];
  const warnings: string[] = [];
  let drawn = 0;

  for (const cut of input.cuts) {
    const result = await generatePanelImage({
      prompt: buildCutPrompt(input.sheet, cut),
      negativePrompt: BASE_NEGATIVE_PROMPT,
      // 같은 캐릭터의 모든 컷이 같은 시드를 쓴다. 장면만 바뀌므로 구도는
      // 달라지되 화풍과 인상이 남는다.
      seed: cutSeed(input.sheet.seed),
      ratio: input.ratio,
      referenceUrl: input.sheet.referenceUrl,
    });

    if (!result.ok) {
      logger.warn('Toon cut art failed', { cut: cut.cutNumber, reason: result.reason });

      images.push(null);
      warnings.push(`art_failed:${cut.cutNumber}:${result.stage}`);

      continue;
    }

    drawn += 1;
    images.push({
      src: result.image.dataUri,
      assetId: null,
      meanLuma: result.image.analysis.overall.meanLuma,
      stdDev: result.image.analysis.overall.stdDev,
      bands: result.image.analysis,
    });
  }

  return { images, warnings, drawn };
}

/**
 * 컷 하나가 패널에 남기는 편집 가능한 값들.
 *
 * 대사를 픽셀이 아니라 슬롯으로 남기는 것이 이 파이프라인의 요점이다.
 * 오타 하나를 고치는 데 다시 그릴 이유가 없어야 한다.
 *
 * @param cut - 컷.
 * @returns 슬롯 이름별 값.
 */
function toSlots(cut: ToonCut): Record<string, PanelSlotValue> {
  const slots: Record<string, PanelSlotValue> = {};

  if (cut.visualFocus !== null && cut.visualFocus.trim() !== '') {
    slots.headline = { type: 'text', value: cut.visualFocus };
  }

  if (cut.narration !== null && cut.narration.trim() !== '') {
    slots.narration = { type: 'text', value: cut.narration };
  }

  for (const [index, line] of cut.dialogue.entries()) {
    slots[`dialogue${index + 1}`] = { type: 'text', value: line.text };
  }

  return slots;
}

/**
 * 패널이 맡을 역할.
 *
 * @param cut - 컷.
 * @param index - 덱 안에서의 순번.
 * @returns 편집기가 묶어 보여 줄 역할.
 */
function toPanelRole(cut: ToonCut, index: number): 'cover' | 'body' | 'cta' {
  if (index === 0) {
    return 'cover';
  }

  return cut.sceneType === 'cta' ? 'cta' : 'body';
}

/**
 * 컷을 조판해 렌더하고 저장한다.
 *
 * @param input - 조직, 버전, 스토리보드, 컷별 그림, 비율.
 * @returns 저장할 패널 행과 조판 경고.
 */
async function renderAndStore(input: {
  orgId: string;
  versionId: string;
  storyboard: ToonStoryboard;
  images: (ResolvedImage | null)[];
  ratio: AspectRatio;
}): Promise<{ rows: Omit<NewPanel, 'versionId'>[]; warnings: string[] }> {
  const rows: Omit<NewPanel, 'versionId'>[] = [];
  const warnings: string[] = [];
  const total = input.storyboard.cuts.length;

  for (const [index, cut] of input.storyboard.cuts.entries()) {
    const composed = composeToonCut({
      cut,
      ratio: input.ratio,
      image: input.images[index] ?? null,
      hook: input.storyboard.hook,
      totalCuts: total,
    });

    warnings.push(...composed.warnings);

    const rendered = await renderPanel(composed.doc, RENDER_SCALE);
    const path = panelRenderPath({ orgId: input.orgId, versionId: input.versionId, index });

    await uploadObject({
      bucket: RENDER_BUCKET,
      path,
      body: rendered.bytes,
      contentType: PANEL_CONTENT_TYPE,
    });

    warnings.push(...rendered.overflows.map((layer) => `overflow:${index}:${layer}`));
    warnings.push(...rendered.collisions.map((pair) => `collision:${index}:${pair}`));

    rows.push({
      index,
      role: toPanelRole(cut, index),
      slots: toSlots(cut),
      // 컷을 다시 그리려면 무엇을 그리라고 했는지가 필요하다. 렌더된 이미지에서
      // 되돌릴 수 없으므로 패널에도 남긴다 — 스토리보드 행은 편 단위이고,
      // 이건 카드 한 장 단위다.
      plan: {
        role: cut.sceneType,
        headline: cut.visualFocus ?? cut.narration ?? '',
        body: cut.narration,
        eyebrow: null,
        imageQuery: cut.imagePrompt,
        imageMood: cut.characterEmotion,
        templateHint: `toon-${cut.sceneType}`,
      },
      doc: composed.doc,
      renderPath: path,
    });
  }

  return { rows, warnings };
}

/**
 * 캐릭터 시트를 읽고 참고 이미지에 서명 URL을 붙인다.
 *
 * 서명에 실패해도 생성을 멈추지 않는다. 참고 이미지는 일관성 장치 셋 중
 * 하나일 뿐이고, 나머지 둘(앵커 문장·고정 시드)만으로도 편은 만들어진다.
 * 여기서 던지면 스토리지 문제 하나로 이미 차감된 크레딧이 환불된다.
 *
 * @param scope - 테넌트 범위.
 * @param characterId - 실행 항목이 지목한 캐릭터.
 * @returns 캐릭터 시트와 경고.
 * @throws ToonGenerationError when the character is not this tenant's.
 */
async function loadCharacterSheet(
  scope: OrgScope,
  characterId: string,
): Promise<{ sheet: CharacterSheet; warnings: string[] }> {
  const character = await findCharacter(scope, characterId);

  if (!character) {
    throw new ToonGenerationError(`Character ${characterId} not found`);
  }

  const base: CharacterSheet = {
    name: character.name,
    appearance: character.appearance,
    artStyle: character.artStyle,
    seed: character.seed,
    referenceUrl: null,
  };

  if (!character.referencePath) {
    return { sheet: base, warnings: [] };
  }

  try {
    const referenceUrl = await createSignedUrl(
      RENDER_BUCKET,
      character.referencePath,
      REFERENCE_URL_TTL_SECONDS,
    );

    return { sheet: { ...base, referenceUrl }, warnings: [] };
  } catch (error) {
    logger.warn('Character sheet could not be signed, drawing from the anchor alone', {
      characterId,
      reason: error instanceof Error ? error.message : 'unknown',
    });

    return { sheet: base, warnings: ['reference_unavailable'] };
  }
}

/**
 * 인스타툰 한 편을 만든다: 스토리보드 → 그림 → 합성 → 렌더 → 저장.
 *
 * @param input - 범위, 실행 항목, 프로젝트, 작성자.
 * @returns 만들어진 덱과 스토리보드, 그린 장수, 경고.
 * @throws ToonGenerationError when the item carries no instatoon inputs, or the
 * character it names is not this tenant's.
 */
export async function generateToonCut(input: GenerateToonInput): Promise<GenerateToonResult> {
  const spec = input.item.toon;

  if (!spec) {
    throw new ToonGenerationError(`Run item ${input.item.id} has no instatoon inputs`);
  }

  const loaded = await loadCharacterSheet(input.scope, spec.characterId);
  const formula = spec.formulaId ? await findFormula(input.scope, spec.formulaId) : null;
  const { ratio } = input.item;

  const written = await generateStoryboard({
    topic: input.item.topic,
    characterName: loaded.sheet.name,
    formula,
    // 견적을 낼 때 확정된 값이다. 공식에서 다시 읽으면, 차감 이후에 공식을
    // 고친 사용자가 지불한 것보다 긴 편을 받는다.
    cutCount: spec.cutCount,
  });

  const drawing = await drawCuts({ cuts: written.storyboard.cuts, sheet: loaded.sheet, ratio });

  const { deck, version } = await createDeckWithVersion(input.scope, {
    projectId: input.projectId,
    title: written.storyboard.hook,
    topic: input.item.topic,
    channel: input.item.channel,
    ratio: input.item.ratio,
    createdBy: input.createdBy,
    runId: input.item.runId,
    creditsCharged: input.item.estimatedCredits,
  });

  const stored = await renderAndStore({
    orgId: input.scope.orgId,
    versionId: version.id,
    storyboard: written.storyboard,
    images: drawing.images,
    ratio,
  });

  await replacePanels(version.id, stored.rows);
  await setDeckStatus(input.scope, deck.id, 'ready');

  const warnings = [
    ...loaded.warnings,
    ...written.warnings,
    ...drawing.warnings,
    ...stored.warnings,
  ];

  const storyboardId = await saveStoryboard(input.scope, {
    deckId: deck.id,
    characterId: spec.characterId,
    formulaId: spec.formulaId,
    topic: input.item.topic,
    ratio: input.item.ratio,
    storyboard: written.storyboard,
    warnings,
  });

  logger.info('Instatoon generated', {
    orgId: input.scope.orgId,
    runId: input.item.runId,
    deckId: deck.id,
    cuts: stored.rows.length,
    drawn: drawing.drawn,
    warnings: warnings.length,
  });

  return {
    deckId: deck.id,
    storyboardId,
    panelCount: stored.rows.length,
    generatedImageCount: drawing.drawn,
    warnings,
    usage: written.usage,
  };
}
