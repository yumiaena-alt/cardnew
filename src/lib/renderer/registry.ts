import type { SlideRole } from '@/lib/slidedoc/doc';
import { bodyCta, bodyNumbered, bodyQuote } from './bodies';
import { coverBoldType, coverBottomStack, coverCardOverlay } from './covers';
import type { Template } from './types';

/**
 * 템플릿 레지스트리 + 선택 로직.
 *
 * 선택 전략: ε-greedy 밴딧.
 *  - 대부분은 채택률(무편집 발행 비율)이 높은 템플릿을 쓴다 → 품질
 *  - ε 확률로 다른 것을 시도한다 → 탐색. 이게 없으면 초기 우연에 갇혀
 *    더 좋은 템플릿을 영원히 못 찾는다.
 *
 * 결정론성: 무작위성이 필요하지만 같은 입력에 같은 결과가 나와야 재현/디버깅이 가능하다.
 * 그래서 Math.random()을 쓰지 않고 시드(콘텐츠 id + 슬라이드 index)로 결정한다.
 */

export const TEMPLATES: readonly Template[] = [
  coverBottomStack,
  coverBoldType,
  coverCardOverlay,
  bodyNumbered,
  bodyQuote,
  bodyCta,
];

export const TEMPLATE_BY_ID: ReadonlyMap<string, Template> = new Map(
  TEMPLATES.map((t) => [t.id, t]),
);

export function findTemplate(id: string): Template | undefined {
  return TEMPLATE_BY_ID.get(id);
}

/** 이 역할에 쓸 수 있는 템플릿들. */
export function templatesForRole(role: SlideRole, hasImage: boolean): Template[] {
  const matching = TEMPLATES.filter(
    (t) => t.roles.includes(role) && (hasImage || !t.requiresImage),
  );
  if (matching.length > 0) {
    return matching;
  }

  // 역할에 맞는 게 없으면 이미지 요구를 만족하는 범용 본문으로 폴백한다.
  // 빈 배열을 반환하면 슬라이드가 아예 안 만들어져 사용자에게 구멍이 보인다.
  return TEMPLATES.filter((t) => hasImage || !t.requiresImage);
}

export type SelectOptions = {
  role: SlideRole;
  hasImage: boolean;
  /** LLM이 제안한 템플릿 id */
  hint?: string | null;
  /** 브랜드킷의 채택률 가중치 {templateId: 0~1} */
  weights?: Record<string, number>;
  /** 탐색 확률. 0이면 항상 최고 가중치만 쓴다. */
  epsilon?: number;
  /** 결정론적 선택을 위한 시드 문자열 */
  seed: string;
};

export const DEFAULT_EPSILON = 0.15;

/**
 * 템플릿을 고른다.
 *
 * 우선순위:
 *  1) hint가 유효하고 역할에 맞으면 그것을 쓴다 (LLM 의도 존중)
 *  2) 탐색 구간이면 시드로 균등 선택
 *  3) 아니면 가중치 최댓값
 */
export function selectTemplate(options: SelectOptions): Template {
  const candidates = templatesForRole(options.role, options.hasImage);

  // 후보가 없을 수는 없지만(폴백이 있음), 타입 안전을 위해 방어한다.
  const first = candidates[0];
  if (!first) {
    throw new Error(`템플릿 후보가 없습니다: role=${options.role}`);
  }

  if (options.hint) {
    const hinted = candidates.find((t) => t.id === options.hint);
    if (hinted) {
      return hinted;
    }
  }

  if (candidates.length === 1) {
    return first;
  }

  const epsilon = options.epsilon ?? DEFAULT_EPSILON;
  const roll = seededUnit(options.seed);

  if (roll < epsilon) {
    // 탐색: 시드의 다른 부분을 써서 균등 선택 (roll을 재사용하면 항상 첫 후보가 나온다)
    const index = seededInt(`${options.seed}:explore`, candidates.length);
    return candidates[index] ?? first;
  }

  const weights = options.weights ?? {};
  return candidates.reduce((best, current) => {
    const bestWeight = weights[best.id] ?? 0.5;
    const currentWeight = weights[current.id] ?? 0.5;
    if (currentWeight > bestWeight) {
      return current;
    }
    // 동점이면 id 순으로 고정해 결과를 결정론적으로 만든다.
    if (currentWeight === bestWeight && current.id < best.id) {
      return current;
    }
    return best;
  }, first);
}

/**
 * 문자열 시드 → 0~1 실수.
 * FNV-1a 해시. 암호학적 강도는 필요 없고, 고르게 퍼지고 재현 가능하면 충분하다.
 */
export function seededUnit(seed: string): number {
  let hash = 0x81_1c_9d_c5;
  for (let i = 0; i < seed.length; i += 1) {
    // charCodeAt, not codePointAt: the hash must stay identical to the source
    // implementation, and the two disagree on surrogate pairs.
    // oxlint-disable-next-line unicorn/prefer-code-point
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01_00_01_93);
  }
  // >>> 0 으로 부호 없는 32비트로 만든 뒤 정규화
  return (hash >>> 0) / 0xff_ff_ff_ff;
}

export function seededInt(seed: string, exclusiveMax: number): number {
  if (exclusiveMax <= 0) {
    return 0;
  }
  return Math.floor(seededUnit(seed) * exclusiveMax) % exclusiveMax;
}

/**
 * 밴딧 가중치 갱신.
 *
 * 무편집 발행(사용자가 손대지 않고 발행)을 성공 신호로 본다 —
 * 이게 "AI가 잘 만들었다"의 가장 정직한 지표다. 좋아요 수는 콘텐츠 주제에 좌우되어
 * 템플릿 품질 신호로 쓸 수 없다.
 *
 * 지수 이동평균을 쓴다: 최근 결과에 더 무게를 두되 한 번의 우연으로 뒤집히지 않는다.
 */
export const WEIGHT_LEARNING_RATE = 0.2;

export function updateWeight(
  currentWeight: number | undefined,
  publishedWithoutEdit: boolean,
): number {
  const prior = currentWeight ?? 0.5;
  const signal = publishedWithoutEdit ? 1 : 0;
  const next = prior + WEIGHT_LEARNING_RATE * (signal - prior);
  // 0/1로 완전히 붙으면 탐색이 무의미해지므로 양끝을 남긴다.
  return Math.min(0.95, Math.max(0.05, Math.round(next * 1000) / 1000));
}
