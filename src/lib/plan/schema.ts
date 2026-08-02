import { z } from 'zod';
import { slideRoleSchema } from '@/lib/slidedoc/doc';
import { aspectRatioSchema } from '@/lib/slidedoc/primitives';

/**
 * 카드뉴스 기획(Plan) — Stage 1 LLM의 출력 계약.
 *
 * 핵심 설계 원칙: LLM은 "무엇을 말할지"만 결정한다.
 * 좌표·크기·색은 절대 LLM에게 맡기지 않는다 — 매번 다른 값을 뱉어 레이아웃이 깨진다.
 * 그래서 이 스키마에는 위치나 픽셀 값이 하나도 없다.
 *
 * 글자 수 상한은 조판 실패를 줄이기 위한 것이다.
 * 상한이 없으면 LLM이 3배 긴 카피를 만들고 autoFit이 최소 크기까지 줄여도 안 들어간다.
 */

/** 이미지 무드 — 스톡 검색 재랭킹과 AI 생성 프롬프트에 쓴다. */
export const imageMoodSchema = z.enum(['warm', 'cool', 'neutral', 'dark', 'bright']);
export type ImageMood = z.infer<typeof imageMoodSchema>;

export const slidePlanSchema = z.object({
  role: slideRoleSchema,
  /**
   * 제목. 28자 상한은 실측 근거가 있다:
   * 4:5 캔버스 폭 80%(864px)에 한글 2줄이면 글자당 약 60px → 줄당 14자.
   */
  headline: z.string().min(1).max(28),
  /** 본문. null이면 제목만 있는 슬라이드. */
  body: z.string().max(90).nullable().default(null),
  /** 상단 라벨 (NEW ARRIVAL, STEP 01 등). 선택. */
  eyebrow: z.string().max(20).nullable().default(null),
  /**
   * 이미지 검색어 — 반드시 영어.
   * 스톡 API(Unsplash/Pexels)는 한국어 검색 품질이 크게 떨어진다.
   */
  imageQuery: z.string().min(1).max(120),
  imageMood: imageMoodSchema.default('neutral'),
  /** 템플릿 힌트. 조판 엔진이 이걸 참고하되 최종 선택은 밴딧 가중치가 한다. */
  templateHint: z.string().nullable().default(null),
});

export type SlidePlan = z.infer<typeof slidePlanSchema>;

export const cardnewsPlanSchema = z.object({
  /**
   * 슬라이드 배열. **반드시 첫 필드로 둔다.**
   *
   * 필드 순서가 곧 LLM의 생성 순서다. hook을 앞에 두었을 때 첫 슬라이드가
   * 화면에 나타나기까지 14.6초가 걸렸다 — 사용자가 그동안 빈 화면을 본다.
   * slides를 앞으로 옮기는 것만으로 이 시간이 줄어든다 (measure:stream으로 실측).
   *
   * 상한 10장: Instagram 캐러셀 한도가 10장이다. 넘게 만들면 발행 단계에서 잘린다.
   */
  slides: z.array(slidePlanSchema).min(2).max(10),
  /** 전체를 관통하는 후킹 문구 — 캡션 첫 줄에 쓴다. */
  hook: z.string().min(1).max(120),
  targetAudience: z.string().max(80).nullable().default(null),
  /** SNS 캡션 본문 */
  caption: z.string().max(2000),
  /** 해시태그 (# 없이 단어만) */
  hashtags: z.array(z.string().max(30)).max(30).default([]),
});

export type CardnewsPlan = z.infer<typeof cardnewsPlanSchema>;

/** 생성 요청 — 위저드 UI가 만들어 파이프라인에 넘긴다. */
export const generateRequestSchema = z.object({
  /** 주제 원문. URL이면 Stage 0에서 스크래핑한다. */
  topic: z.string().min(1).max(4000),
  ratio: aspectRatioSchema.default('4:5'),
  /** 'auto'면 LLM이 정한다 */
  slideCount: z.union([z.literal('auto'), z.number().int().min(2).max(10)]).default('auto'),
  language: z.string().default('ko'),
  imageSource: z.enum(['stock', 'ai', 'upload']).default('stock'),
  /** 스톡 검색 범위 — 'safe'는 상업 이용 가능 소스만 */
  imageScope: z.enum(['safe', 'web']).default('safe'),
  /** 만들기 전 기획을 사용자에게 보여줄지 */
  reviewPlanFirst: z.boolean().default(false),
  brandKitId: z.string().nullable().default(null),
});

export type GenerateRequest = z.infer<typeof generateRequestSchema>;

/**
 * 슬라이드 역할별 기본 구성.
 *
 * LLM이 자유롭게 역할을 고르면 5장 중 4장이 'point'가 되는 식으로 단조로워진다.
 * 장수에 따른 권장 흐름을 프롬프트에 넣어 구조를 잡는다.
 */
export const ROLE_FLOWS: Record<number, readonly string[]> = {
  2: ['cover', 'cta'],
  3: ['cover', 'point', 'cta'],
  4: ['cover', 'problem', 'point', 'cta'],
  5: ['cover', 'problem', 'point', 'example', 'cta'],
  6: ['cover', 'problem', 'point', 'point', 'example', 'cta'],
  7: ['cover', 'problem', 'point', 'point', 'example', 'quote', 'cta'],
} as const;

/**
 * 요청의 장수를 확정한다. 'auto'면 주제 길이로 추정한다.
 *
 * shared에 두는 이유: 서버(기획 LLM)와 클라이언트(크레딧 견적 표시)가 같은 답을 내야 한다.
 * 두 곳에 따로 두면 "12 크레딧이라더니 15가 빠졌다"는 신뢰 문제가 생긴다.
 */
export function resolveSlideCount(request: Pick<GenerateRequest, 'slideCount' | 'topic'>): number {
  if (request.slideCount !== 'auto') {
    return request.slideCount;
  }

  // 긴 주제(링크 본문 등)는 담을 내용이 많으므로 장수를 늘린다.
  const { length } = request.topic;
  if (length < 40) {
    return 5;
  }
  if (length < 200) {
    return 6;
  }
  return 7;
}

/** 장수에 맞는 권장 역할 흐름. 표에 없으면 앞뒤를 고정하고 중간을 point로 채운다. */
export function suggestRoleFlow(slideCount: number): string[] {
  const preset = ROLE_FLOWS[slideCount];
  if (preset) {
    return [...preset];
  }

  const middle = Array.from({ length: Math.max(0, slideCount - 2) }, () => 'point');
  return ['cover', ...middle, 'cta'];
}
