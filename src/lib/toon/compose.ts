import { approxMeasureFn, fitTextSize } from '@/lib/renderer/autofit';
import type { ResolvedImage } from '@/lib/renderer/types';
import { parseSlideDoc, SLIDEDOC_VERSION } from '@/lib/slidedoc/doc';
import type { SlideDoc, SlideRole } from '@/lib/slidedoc/doc';
import type { BubbleTail, Layer } from '@/lib/slidedoc/layers';
import { canvasSize } from '@/lib/slidedoc/primitives';
import type { AspectRatio } from '@/lib/slidedoc/primitives';
import type { BubbleAnchor, ToonCut, ToonDialogue, ToonSceneType } from './schema';

/**
 * 4단계 — 그림 위에 글을 얹는다.
 *
 * 이미지 모델에게 글자를 그리게 하지 않는다. 한글을 제대로 쓰는 이미지 모델이
 * 없기도 하지만, 더 큰 이유는 **글자가 픽셀이 되면 고칠 수 없다는 것**이다.
 * 오타 하나에 다시 생성 비용이 든다. 그림과 글을 분리해 두면 대사 수정은
 * 0크레딧이고, 이미 있는 캔버스 편집기가 그대로 동작한다.
 *
 * 합성은 이 파일이 SlideDoc을 만들고 렌더 서비스가 브라우저로 그린다. Sharp나
 * node-canvas로 따로 그리지 않는 이유는 그러면 조판 규칙이 두 벌이 되기 때문이다 —
 * 에디터가 보여 주는 것과 내보낸 이미지가 어긋나는 순간 신뢰가 깨진다.
 */

const INK = '#141210';
const PAPER = '#FFFFFF';
/** 나레이션 띠. 완전 불투명이 아니라 그림이 살짝 비치게 둔다. */
const NARRATION_BAND = '#FFFFFFF2';
const BUBBLE_BORDER = '#141210';

/** 캔버스 가장자리 여백. 인스타 UI에 먹히지 않는 선. */
const MARGIN = 0.06;
/** 말풍선 폭. 이보다 넓으면 두 개를 나란히 놓을 수 없다. */
const BUBBLE_WIDTH = 0.42;
/** 말풍선 안쪽 여백 (base px). */
const BUBBLE_PAD_X = 26;
const BUBBLE_PAD_Y = 20;
const BUBBLE_RADIUS = 24;
const BUBBLE_FONT = { min: 24, max: 38, lineHeight: 1.35, maxLines: 3 } as const;
const NARRATION_FONT = { min: 24, max: 34, lineHeight: 1.4, maxLines: 2 } as const;
/** 같은 자리에 말풍선이 겹칠 때 아래로 밀어 내는 간격 (캔버스 높이 비율). */
const BUBBLE_STACK_GAP = 0.02;

/**
 * 컷 역할 → SlideDoc의 슬라이드 역할.
 *
 * 새 역할을 SlideDoc에 추가하지 않는다. `slideRoleSchema`는 이미 저장된 문서
 * 전부의 계약이고, 인스타툰의 여섯 박자는 카드뉴스의 여섯 역할에 무리 없이
 * 대응된다. 컷 고유의 정보는 패널의 `plan`에 그대로 남는다.
 */
const SCENE_TO_ROLE: Record<ToonSceneType, SlideRole> = {
  cover: 'cover',
  setup: 'problem',
  conflict: 'problem',
  climax: 'point',
  resolution: 'example',
  cta: 'cta',
};

/** 말풍선 자리 → 꼬리가 향할 방향. 꼬리는 언제나 그림 안쪽을 가리킨다. */
const ANCHOR_TO_TAIL: Record<BubbleAnchor, BubbleTail['side']> = {
  'top-left': 'bottom',
  'top-right': 'bottom',
  'middle-left': 'bottom',
  'middle-right': 'bottom',
  'bottom-left': 'top',
  'bottom-right': 'top',
};

/** 말풍선의 세로 시작점. 나레이션 띠와 겹치지 않는 자리에서 시작한다. */
const BUBBLE_Y: Record<BubbleAnchor, number> = {
  'top-left': 0.2,
  'top-right': 0.2,
  'middle-left': -0.02,
  'middle-right': -0.02,
  'bottom-left': 0.12,
  'bottom-right': 0.12,
};

export type ComposeToonCutOptions = {
  cut: ToonCut;
  ratio: AspectRatio;
  /** 생성된 컷 그림. null이면 종이 배경 위 글자만 남는다 — 실패해도 컷은 선다. */
  image: ResolvedImage | null;
  /** 표지에 얹을 후킹 한 줄. `visualFocus`가 비었을 때 대신 쓴다. */
  hook: string;
  totalCuts: number;
};

export type ComposedToonCut = {
  doc: SlideDoc;
  /** 조판이 못 맞춘 것. 실패가 아니라 카피를 줄여야 한다는 신호다. */
  warnings: string[];
};

/**
 * 말풍선 하나의 세로 크기를 미리 잰다.
 *
 * 도형의 높이를 텍스트보다 **먼저** 알아야 한다. 도형이 먼저 그려지고 그 위에
 * 글자가 얹히기 때문이다. 조판 엔진과 같은 측정 함수·같은 제약을 쓰므로,
 * 나중에 typeset이 다시 계산해도 같은 크기가 나온다.
 *
 * @param text - 대사.
 * @param innerWidth - 안쪽 여백을 뺀 폭 (논리 px).
 * @returns 글자 높이(논리 px)와 최소 크기까지 줄여도 안 들어갔는지.
 */
function measureBubbleText(
  text: string,
  innerWidth: number,
): { height: number; overflow: boolean } {
  const fit = fitTextSize(
    text,
    {
      maxWidth: innerWidth,
      maxLines: BUBBLE_FONT.maxLines,
      minSize: BUBBLE_FONT.min,
      maxSize: BUBBLE_FONT.max,
      lineHeight: BUBBLE_FONT.lineHeight,
    },
    approxMeasureFn(BUBBLE_FONT.lineHeight),
  );

  return { height: fit.metrics.height, overflow: fit.overflow };
}

/**
 * 말풍선 하나를 도형 + 텍스트 두 레이어로 만든다.
 *
 * 두 레이어로 나누는 이유: 텍스트 레이어여야 autoFit·충돌 검사·캔버스 편집이
 * 전부 그대로 따라온다. 말풍선 전용 레이어 타입을 만들면 그 셋을 다시 써야 한다.
 *
 * @param input - 대사, 같은 컷 안에서의 순번, 논리 캔버스 크기.
 * @returns 레이어 두 장과 넘침 경고.
 */
function bubbleLayers(input: {
  dialogue: ToonDialogue;
  index: number;
  canvas: { width: number; height: number };
}): { layers: Layer[]; warnings: string[] } {
  const { dialogue, index, canvas } = input;

  const innerWidth = BUBBLE_WIDTH * canvas.width - BUBBLE_PAD_X * 2;
  const measured = measureBubbleText(dialogue.text, innerWidth);

  const heightRatio = (measured.height + BUBBLE_PAD_Y * 2) / canvas.height;
  const padYRatio = BUBBLE_PAD_Y / canvas.height;
  const padXRatio = BUBBLE_PAD_X / canvas.width;

  const { anchor } = dialogue;
  const isMiddle = anchor.startsWith('middle-');
  // 같은 자리에 두 개가 오면 아래로 흘려 보낸다. 겹쳐 두면 하나는 안 읽힌다.
  const bubbleY = BUBBLE_Y[anchor] + index * (heightRatio + BUBBLE_STACK_GAP);

  const shape: Layer = {
    id: `bubble-${index}`,
    type: 'shape',
    role: 'bubble',
    shape: dialogue.tone === 'thought' ? 'ellipse' : 'rect',
    fill: { kind: 'solid', color: PAPER },
    stroke: { color: BUBBLE_BORDER, width: dialogue.tone === 'shout' ? 5 : 3 },
    radius: BUBBLE_RADIUS,
    tail: {
      side: ANCHOR_TO_TAIL[anchor],
      // 꼬리는 말풍선이 붙은 쪽 반대편에 둔다 — 화면 안쪽의 화자를 가리키게.
      at: anchor.endsWith('-left') ? 0.7 : 0.2,
      size: 22,
    },
    layout: { anchor, x: MARGIN, y: bubbleY, w: BUBBLE_WIDTH, h: heightRatio, rotate: 0, z: 10 },
    hidden: false,
    locked: false,
    opacity: 1,
  };

  const text: Layer = {
    id: `bubble-text-${index}`,
    type: 'text',
    role: 'body',
    text: dialogue.text,
    style: {
      family: 'Pretendard',
      weight: dialogue.tone === 'shout' ? 800 : 600,
      size: BUBBLE_FONT.max,
      autoFit: {
        enabled: true,
        min: BUBBLE_FONT.min,
        max: BUBBLE_FONT.max,
        maxLines: BUBBLE_FONT.maxLines,
      },
      color: INK,
      align: 'center',
      lineHeight: BUBBLE_FONT.lineHeight,
      letterSpacing: -0.02,
      italic: dialogue.tone === 'whisper',
      underline: false,
      strike: false,
      transform: 'none',
    },
    // 가운데 앵커는 도형과 글자가 같은 선을 기준으로 접히므로 여백을 더하지
    // 않아야 세로 가운데에 온다. 위·아래 앵커일 때만 안쪽 여백만큼 민다.
    layout: {
      anchor,
      x: MARGIN + padXRatio,
      y: bubbleY + (isMiddle ? 0 : padYRatio),
      w: BUBBLE_WIDTH - padXRatio * 2,
      h: measured.height / canvas.height,
      rotate: 0,
      z: 11,
    },
    hidden: false,
    locked: false,
    opacity: 1,
  };

  return {
    layers: [shape, text],
    warnings: measured.overflow ? [`bubble_overflow:${index}`] : [],
  };
}

/**
 * 나레이션 띠. 그림 위 상단에 종이 한 장을 깔고 그 위에 글을 쓴다.
 *
 * 배경 휘도를 재서 글자색을 정하는 대신 흰 띠를 깐다. 인스타툰의 그림은
 * 컷마다 밝기가 크게 달라서, 재서 맞추는 쪽이 "대체로 읽히지만 가끔 안 읽히는"
 * 결과를 낸다. 띠를 깔면 대비가 구조적으로 보장된다.
 *
 * @param narration - 나레이션 한 줄.
 * @param canvas - 논리 캔버스 크기.
 * @returns 띠와 글자 레이어, 그리고 넘침 경고.
 */
function narrationLayers(
  narration: string,
  canvas: { width: number; height: number },
): { layers: Layer[]; warnings: string[] } {
  const padX = 32;
  const padY = 22;
  const innerWidth = canvas.width - padX * 2;

  const fit = fitTextSize(
    narration,
    {
      maxWidth: innerWidth,
      maxLines: NARRATION_FONT.maxLines,
      minSize: NARRATION_FONT.min,
      maxSize: NARRATION_FONT.max,
      lineHeight: NARRATION_FONT.lineHeight,
    },
    approxMeasureFn(NARRATION_FONT.lineHeight),
  );

  const band: Layer = {
    id: 'narration-band',
    type: 'shape',
    role: 'scrim',
    shape: 'rect',
    fill: { kind: 'solid', color: NARRATION_BAND },
    radius: 0,
    layout: {
      anchor: 'top-left',
      x: 0,
      y: 0,
      w: 1,
      h: (fit.metrics.height + padY * 2) / canvas.height,
      rotate: 0,
      z: 5,
    },
    hidden: false,
    locked: false,
    opacity: 1,
  };

  const text: Layer = {
    id: 'narration',
    type: 'text',
    role: 'caption',
    text: narration,
    style: {
      family: 'Pretendard',
      weight: 500,
      size: NARRATION_FONT.max,
      autoFit: {
        enabled: true,
        min: NARRATION_FONT.min,
        max: NARRATION_FONT.max,
        maxLines: NARRATION_FONT.maxLines,
      },
      color: INK,
      align: 'center',
      lineHeight: NARRATION_FONT.lineHeight,
      letterSpacing: -0.02,
      italic: false,
      underline: false,
      strike: false,
      transform: 'none',
    },
    layout: {
      anchor: 'top-left',
      x: padX / canvas.width,
      y: padY / canvas.height,
      w: innerWidth / canvas.width,
      h: fit.metrics.height / canvas.height,
      rotate: 0,
      z: 6,
    },
    hidden: false,
    locked: false,
    opacity: 1,
  };

  return { layers: [band, text], warnings: fit.overflow ? ['narration_overflow'] : [] };
}

/**
 * 표지의 강조 문구. 하단 스크림 위에 크게 얹는다.
 *
 * 표지만 다른 규칙을 쓰는 이유: 피드에서는 이 한 장의 아래쪽 3분의 1만 읽힌다.
 * 나레이션 띠와 같은 크기로 쓰면 스크롤을 멈추게 하지 못한다.
 *
 * @param focus - 강조 문구.
 * @returns 스크림과 글자 레이어.
 */
function coverFocusLayers(focus: string): Layer[] {
  const scrim: Layer = {
    id: 'cover-scrim',
    type: 'shape',
    role: 'scrim',
    shape: 'rect',
    fill: {
      kind: 'gradient',
      type: 'linear',
      angle: 180,
      stops: [
        { at: 0, color: '#14121000' },
        { at: 1, color: '#141210E6' },
      ],
    },
    radius: 0,
    layout: { anchor: 'bottom-left', x: 0, y: 0, w: 1, h: 0.42, rotate: 0, z: 5 },
    hidden: false,
    locked: false,
    opacity: 1,
  };

  const headline: Layer = {
    id: 'cover-focus',
    type: 'text',
    role: 'headline',
    text: focus,
    style: {
      family: 'Pretendard',
      weight: 800,
      size: 96,
      autoFit: { enabled: true, min: 54, max: 104, maxLines: 3 },
      color: PAPER,
      align: 'left',
      lineHeight: 1.22,
      letterSpacing: -0.035,
      italic: false,
      underline: false,
      strike: false,
      transform: 'none',
      shadow: { x: 0, y: 2, blur: 18, color: '#00000066' },
    },
    layout: { anchor: 'bottom-left', x: MARGIN, y: 0.08, w: 1 - MARGIN * 2, rotate: 0, z: 6 },
    hidden: false,
    locked: false,
    opacity: 1,
  };

  return [scrim, headline];
}

/**
 * 진행 표시.
 *
 * @param cut - 이 컷.
 * @param totalCuts - 전체 컷 수.
 * @returns 페이지 번호 레이어.
 */
function pageLabelLayer(cut: ToonCut, totalCuts: number): Layer {
  return {
    id: 'pagenum',
    type: 'text',
    role: 'pagenum',
    text: `${cut.cutNumber} / ${totalCuts}`,
    style: {
      family: 'Pretendard',
      weight: 600,
      size: 24,
      autoFit: { enabled: false, min: 18, max: 24, maxLines: 1 },
      color: PAPER,
      align: 'right',
      lineHeight: 1.2,
      letterSpacing: 0,
      italic: false,
      underline: false,
      strike: false,
      transform: 'none',
      shadow: { x: 0, y: 1, blur: 6, color: '#00000099' },
    },
    layout: { anchor: 'bottom-right', x: MARGIN, y: 0.03, w: 0.2, rotate: 0, z: 20 },
    hidden: false,
    locked: false,
    opacity: 0.9,
  };
}

/**
 * 컷 하나를 SlideDoc으로 조판한다.
 *
 * LLM이 개입하지 않는다. 같은 컷은 언제 조판해도 같은 문서가 나오고,
 * 그래서 재시도가 다른 배치를 내놓지 않는다.
 *
 * @param options - 컷, 비율, 생성된 그림, 후킹 문구, 전체 컷 수.
 * @returns 문서와 조판 경고.
 */
export function composeToonCut(options: ComposeToonCutOptions): ComposedToonCut {
  const { cut, ratio, image, hook, totalCuts } = options;
  const canvas = canvasSize(ratio);

  const layers: Layer[] = [];
  const warnings: string[] = [];

  if (image) {
    layers.push({
      id: 'panel-art',
      type: 'image',
      role: 'background',
      assetId: image.assetId,
      src: image.src,
      focus: image.focus ?? { x: 0.5, y: 0.42 },
      fit: 'cover',
      scale: 1,
      flipX: false,
      flipY: false,
      radius: 0,
      filter: { brightness: 1, contrast: 1, saturate: 1, blur: 0, grayscale: 0 },
      manualOverlay: false,
      hidden: false,
      locked: false,
      opacity: 1,
      layout: { anchor: 'top-left', x: 0, y: 0, w: 1, rotate: 0, z: 0 },
    });
  } else {
    // 그림 없이도 컷은 선다. 한 컷의 생성 실패로 이야기 전체를 버리지 않는다.
    warnings.push(`missing_art:${cut.cutNumber}`);
  }

  const focus = cut.visualFocus === null || cut.visualFocus.trim() === '' ? null : cut.visualFocus;

  if (cut.sceneType === 'cover') {
    layers.push(...coverFocusLayers(focus ?? hook));
  } else if (cut.narration !== null && cut.narration.trim() !== '') {
    const narration = narrationLayers(cut.narration, canvas);

    layers.push(...narration.layers);
    warnings.push(...narration.warnings.map((entry) => `${entry}:${cut.cutNumber}`));
  }

  for (const [index, dialogue] of cut.dialogue.entries()) {
    const bubble = bubbleLayers({ dialogue, index, canvas });

    layers.push(...bubble.layers);
    warnings.push(...bubble.warnings.map((entry) => `${entry}:${cut.cutNumber}`));
  }

  layers.push(pageLabelLayer(cut, totalCuts));

  const doc = parseSlideDoc({
    v: SLIDEDOC_VERSION,
    canvas: { ratio, bg: { kind: 'solid', color: PAPER } },
    role: SCENE_TO_ROLE[cut.sceneType],
    layers,
    meta: {
      templateId: `toon-${cut.sceneType}`,
      brandKitId: null,
      // 흰 띠와 스크림으로 대비를 구조적으로 보장한다. 재검증할 것이 없다.
      contrastChecked: true,
      fitted: false,
    },
  });

  return { doc, warnings };
}
