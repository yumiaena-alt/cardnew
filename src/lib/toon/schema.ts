import * as z from 'zod';

/**
 * 인스타툰 파이프라인의 출력 계약.
 *
 * `lib/plan/schema.ts`와 같은 원칙을 따른다: **LLM은 무엇을 말하고 무엇을 그릴지만
 * 정한다.** 좌표·크기·색은 조판 엔진이 정하고, 캐릭터의 생김새는 캐릭터 시트가 정한다.
 * 셋 중 하나라도 LLM에게 맡기면 컷마다 값이 달라져 — 인스타툰에서는 그게 곧
 * "3컷부터 다른 사람이 나오는" 문제가 된다.
 *
 * 글자 수 상한은 조판 실패를 줄이기 위한 것이다. 말풍선은 카드 제목과 달리
 * 그림 위에 얹히므로, 넘치면 줄어드는 게 아니라 그림을 가린다.
 */

/**
 * 컷이 이야기에서 맡는 역할.
 *
 * 이 여섯 개로 고정한 이유: 사이다/공감 인스타툰의 바이럴 구조는 사실상
 * "후킹 → 상황 제시 → 갈등 누적 → 반전 → 정리 → 다음 편"의 변주다.
 * 역할을 자유 문자열로 두면 모델이 매번 다른 이름을 붙여 템포를 검증할 수 없다.
 */
const toonSceneTypeSchema = z.enum(['cover', 'setup', 'conflict', 'climax', 'resolution', 'cta']);

export type ToonSceneType = z.infer<typeof toonSceneTypeSchema>;

/** 말풍선이 붙을 자리. 그림 속 화자 위치를 대략 가리킨다. */
const bubbleAnchorSchema = z.enum([
  'top-left',
  'top-right',
  'middle-left',
  'middle-right',
  'bottom-left',
  'bottom-right',
]);

export type BubbleAnchor = z.infer<typeof bubbleAnchorSchema>;

/** 말풍선 성격. 모양·꼬리·글자 굵기가 여기서 갈린다. */
const bubbleToneSchema = z.enum(['speech', 'thought', 'shout', 'whisper']);

const toonDialogueSchema = z.object({
  /** 화자. 주인공은 'main', 나머지는 배역 이름을 짧게. */
  speaker: z.string().min(1).max(16),
  /**
   * 대사. 24자 상한은 실측이다 — 4:5 캔버스에서 말풍선 폭 40%(432px)에
   * 한글 2줄이면 글자당 약 36px, 줄당 12자다. 그 이상은 그림을 덮는다.
   */
  text: z.string().min(1).max(24),
  anchor: bubbleAnchorSchema,
  tone: bubbleToneSchema.default('speech'),
});

export type ToonDialogue = z.infer<typeof toonDialogueSchema>;

/** 한 컷에 들어가는 말풍선 상한. 셋을 넘기면 어느 배치로도 그림이 남지 않는다. */
const MAX_BUBBLES_PER_CUT = 3;

export const toonCutSchema = z.object({
  /** 1부터 시작한다. 화면·파일명·대화 모두 1-based로 말하기 때문이다. */
  cutNumber: z.number().int().min(1).max(10),
  sceneType: toonSceneTypeSchema,
  /**
   * 이미지 생성 모델에 넘길 영문 프롬프트 — **장면만** 적는다.
   *
   * 주인공의 머리·옷·나이·그림체는 여기에 쓰지 않는다. 그건 캐릭터 시트가
   * 앞에 붙이고(`lib/toon/character.ts`), 컷마다 모델이 다시 묘사하면
   * 그 묘사가 조금씩 흔들려 일관성이 깨진다.
   */
  imagePrompt: z.string().min(1).max(400),
  /** 표정·감정 태그. 프롬프트 앵커와 썸네일 선택에 쓴다. */
  characterEmotion: z.string().min(1).max(40),
  /** 상·하단 나레이션(한글). 없으면 대사만 있는 컷. */
  narration: z.string().max(48).nullable().default(null),
  dialogue: z.array(toonDialogueSchema).max(MAX_BUBBLES_PER_CUT).default([]),
  /**
   * 표지 강조 문구. 1컷에서만 쓴다.
   *
   * 나레이션과 따로 두는 이유: 표지는 피드에서 이 한 덩어리만 읽히고,
   * 그래서 나레이션과 다른 크기·다른 자리에 조판된다.
   */
  visualFocus: z.string().max(20).nullable().default(null),
});

export type ToonCut = z.infer<typeof toonCutSchema>;

/** 인스타 캐러셀 상한이 10장이다. 넘게 만들면 발행 단계에서 잘린다. */
export const MAX_TOON_CUTS = 10;
/** 표지 1 + 본문 6 + 결말 2. 벤치마킹 대상들이 가장 자주 쓰는 길이다. */
export const DEFAULT_TOON_CUTS = 9;
export const MIN_TOON_CUTS = 4;

export const toonStoryboardSchema = z.object({
  /**
   * 컷 배열. **반드시 첫 필드로 둔다.**
   *
   * 필드 순서가 곧 생성 순서다. 요약을 앞에 두면 첫 컷이 화면에 뜨기까지
   * 그만큼 늦어진다 — `lib/plan/schema.ts`에서 실측으로 확인한 것과 같은 이유다.
   */
  cuts: z.array(toonCutSchema).min(MIN_TOON_CUTS).max(MAX_TOON_CUTS),
  /** 표지에 얹을 어그로 한 줄. 캡션 첫 줄로도 쓴다. */
  hook: z.string().min(1).max(60),
  /** 한 줄 줄거리. 사용자가 생성 전에 방향을 확인하는 용도다. */
  logline: z.string().min(1).max(120),
  caption: z.string().max(2000),
  hashtags: z.array(z.string().max(30)).max(30).default([]),
});

export type ToonStoryboard = z.infer<typeof toonStoryboardSchema>;

// ─── 벤치마킹 공식 ────────────────────────────────────────────

/**
 * 한 박자.
 *
 * 레퍼런스에서 **가져오는 것은 이 배열뿐이다.** 대사도, 그림도, 소재도 아니다.
 * "몇 번째 컷에서 긴장을 얼마나 올리는가"는 사실의 관찰이고,
 * 그 자리에 무슨 이야기를 넣을지는 우리가 새로 쓴다.
 */
const storyBeatSchema = z.object({
  sceneType: toonSceneTypeSchema,
  /** 이 박자가 하는 일(한글). 예: "손해 본 금액을 숫자로 던진다". */
  purpose: z.string().min(1).max(60),
  /** 1(잔잔) ~ 5(폭발). 템포 곡선을 검증할 수 있게 숫자로 둔다. */
  tension: z.number().int().min(1).max(5),
});

/**
 * 후킹 문구의 **패턴**. 문장이 아니라 골격이다.
 *
 * 40자 상한이 저작권 가드레일이다: 원문 한 줄이 그대로 들어갈 수 없는 길이로
 * 묶어 두면, 모델이 베끼려 해도 패턴으로 요약할 수밖에 없다.
 */
const hookPatternSchema = z.string().min(1).max(40);

export const storyFormulaSchema = z.object({
  beats: z.array(storyBeatSchema).min(MIN_TOON_CUTS).max(MAX_TOON_CUTS),
  hookPatterns: z.array(hookPatternSchema).min(1).max(6),
  /** 말투·분위기 태그(한글). 예: "구어체", "빈정거림", "담담한 서술". */
  toneTags: z.array(z.string().max(20)).max(8).default([]),
  /** 전개 속도. 컷당 사건 밀도를 결정한다. */
  pacing: z.enum(['slow-burn', 'steady', 'fast-cut', 'twist-heavy']).default('steady'),
  /** 무엇이 이 포맷을 굴러가게 하는지 한 문장(한글). */
  summary: z.string().min(1).max(200),
});

export type StoryFormula = z.infer<typeof storyFormulaSchema>;

/**
 * 컷 수에 맞는 기본 박자 구성.
 *
 * 공식 없이 만들 때 쓴다. 모델에게 역할을 자유롭게 고르게 하면 9컷 중 6컷이
 * conflict가 되어 사이다가 오지 않는다 — `lib/plan/schema.ts`의 ROLE_FLOWS와
 * 같은 이유로, 뼈대는 코드가 잡고 살만 모델이 붙인다.
 *
 * @param cutCount - 만들 컷 수.
 * @returns 컷 순서대로의 장면 역할.
 */
export function defaultSceneFlow(cutCount: number): ToonSceneType[] {
  const middle = Math.max(0, cutCount - 4);
  // 갈등이 절반을 넘으면 답답하기만 하고, 없으면 반전이 싱겁다. 2:1로 나눈다.
  const conflictCount = Math.ceil(middle * (2 / 3));

  return [
    'cover',
    'setup',
    ...Array.from({ length: conflictCount }, (): ToonSceneType => 'conflict'),
    ...Array.from({ length: middle - conflictCount }, (): ToonSceneType => 'climax'),
    'resolution',
    'cta',
  ];
}

/**
 * 공식이 제안하는 컷 수. 없으면 기본값을 쓴다.
 *
 * 서버(스토리보드 생성)와 클라이언트(크레딧 견적)가 같은 답을 내야 하므로
 * 여기 한 곳에 둔다. 두 곳에 두면 "9컷이라더니 10컷 값이 빠졌다"가 된다.
 *
 * @param formula - 적용할 공식. 없으면 기본 길이를 쓴다.
 * @param requested - 사용자가 직접 고른 컷 수.
 * @returns 확정된 컷 수.
 */
export function resolveCutCount(
  formula: Pick<StoryFormula, 'beats'> | null,
  requested?: number,
): number {
  if (requested !== undefined) {
    return Math.min(MAX_TOON_CUTS, Math.max(MIN_TOON_CUTS, requested));
  }

  return formula ? formula.beats.length : DEFAULT_TOON_CUTS;
}
