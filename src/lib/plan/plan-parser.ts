import { cardnewsPlanSchema, slidePlanSchema } from './schema';
import type { CardnewsPlan, SlidePlan } from './schema';

/**
 * JSONL 기획 스트림의 점진 파서.
 *
 * 순수 함수 모듈로 분리한 이유: LLM 호출 없이 "모델이 형식을 어겼을 때"를
 * 전부 테스트할 수 있어야 한다. 스트리밍 파서의 결함은 재현이 어렵고,
 * 실제 호출로 검증하려면 매번 비용과 무작위성이 따라온다.
 *
 * 관용 원칙: 한 줄이 깨져도 나머지 슬라이드는 살린다.
 * 기획 전체를 버리고 재생성하면 사용자는 20초를 다시 기다린다.
 */

export type PlanStreamEvent =
  | { type: 'slide'; index: number; slide: SlidePlan }
  | { type: 'meta'; meta: PlanMeta };

export type PlanMeta = {
  hook: string;
  targetAudience: string | null;
  caption: string;
  hashtags: string[];
};

/** 상한 초과 카피를 잘라낸 기록. 프롬프트 회귀 신호로 쓴다. */
export type ParseWarning =
  | { kind: 'clipped'; index: number; field: string; from: number; to: number }
  | { kind: 'dropped_line'; reason: string; sample: string };

const LIMITS = { headline: 28, body: 90, eyebrow: 20, imageQuery: 120 } as const;
const MOODS = new Set(['warm', 'cool', 'neutral', 'dark', 'bright']);

export class PlanLineParser {
  #buffer = '';
  readonly #slides: SlidePlan[] = [];
  #meta: PlanMeta | null = null;
  readonly #warnings: ParseWarning[] = [];

  get slides(): readonly SlidePlan[] {
    return this.#slides;
  }

  get meta(): PlanMeta | null {
    return this.#meta;
  }

  get warnings(): readonly ParseWarning[] {
    return this.#warnings;
  }

  /** 텍스트 조각을 넣고, 완성된 줄에서 나온 이벤트를 받는다. */
  push(chunk: string): PlanStreamEvent[] {
    this.#buffer += chunk;

    const events: PlanStreamEvent[] = [];
    const lines = this.#buffer.split('\n');
    // 마지막 조각은 아직 완성되지 않았을 수 있으므로 버퍼에 되돌린다.
    this.#buffer = lines.pop() ?? '';

    for (const line of lines) {
      const event = this.#consumeLine(line);
      if (event) {
        events.push(event);
      }
    }

    return events;
  }

  /** 스트림 종료 — 버퍼에 남은 마지막 줄을 처리한다. */
  flush(): PlanStreamEvent[] {
    const rest = this.#buffer;
    this.#buffer = '';
    const event = this.#consumeLine(rest);
    return event ? [event] : [];
  }

  /**
   * 최종 기획 조립 + 스키마 검증.
   *
   * 슬라이드가 2장 미만이면 조판할 것이 없으므로 실패시킨다.
   * 메타가 없으면 슬라이드에서 최소한의 값을 만들어낸다 — 캡션이 없다고
   * 이미 만들어진 5장을 버릴 이유는 없다.
   */
  buildPlan(): CardnewsPlan {
    if (this.#slides.length < 2) {
      throw new PlanParseError(
        `슬라이드를 ${this.#slides.length}장만 읽었습니다 (최소 2장)`,
        this.#warnings,
      );
    }

    const meta = this.#meta ?? this.#synthesizeMeta();

    return cardnewsPlanSchema.parse({
      slides: this.#slides,
      hook: meta.hook,
      targetAudience: meta.targetAudience,
      caption: meta.caption,
      hashtags: meta.hashtags,
    });
  }

  #synthesizeMeta(): PlanMeta {
    const cover = this.#slides[0];
    return {
      hook: cover?.headline ?? '카드뉴스',
      targetAudience: null,
      caption: this.#slides.map((slide) => slide.headline).join('\n'),
      hashtags: [],
    };
  }

  #consumeLine(rawLine: string): PlanStreamEvent | null {
    const line = stripFence(rawLine);
    if (line.length === 0) {
      return null;
    }

    // 모델이 머리말("아래와 같이 작성했습니다")을 붙이는 경우가 있다.
    if (!line.startsWith('{')) {
      this.#warnings.push({
        kind: 'dropped_line',
        reason: 'JSON이 아님',
        sample: line.slice(0, 60),
      });
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      this.#warnings.push({
        kind: 'dropped_line',
        reason: 'JSON 파싱 실패',
        sample: line.slice(0, 60),
      });
      return null;
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    const record = parsed as Record<string, unknown>;

    if (typeof record.headline === 'string') {
      return this.#consumeSlide(record);
    }
    if (typeof record.hook === 'string' || typeof record.caption === 'string') {
      return this.#consumeMeta(record);
    }

    this.#warnings.push({
      kind: 'dropped_line',
      reason: '알 수 없는 형태',
      sample: line.slice(0, 60),
    });
    return null;
  }

  #consumeSlide(record: Record<string, unknown>): PlanStreamEvent | null {
    const index = this.#slides.length;

    const candidate = {
      role: typeof record.role === 'string' ? record.role : 'point',
      headline: this.#clip(
        index,
        'headline',
        typeof record.headline === 'string' ? record.headline : '',
      ),
      body: this.#nullableText(index, 'body', record.body),
      eyebrow: this.#nullableText(index, 'eyebrow', record.eyebrow),
      imageQuery: this.#clip(
        index,
        'imageQuery',
        typeof record.imageQuery === 'string' && record.imageQuery.length > 0
          ? record.imageQuery
          : 'minimal clean background, soft natural light, no text',
      ),
      imageMood:
        typeof record.imageMood === 'string' && MOODS.has(record.imageMood)
          ? record.imageMood
          : 'neutral',
      templateHint: null,
    };

    const result = slidePlanSchema.safeParse(candidate);
    if (!result.success) {
      this.#warnings.push({
        kind: 'dropped_line',
        reason: `슬라이드 검증 실패: ${result.error.issues[0]?.message ?? '알 수 없음'}`,
        sample: candidate.headline.slice(0, 40),
      });
      return null;
    }

    this.#slides.push(result.data);
    return { type: 'slide', index, slide: result.data };
  }

  #consumeMeta(record: Record<string, unknown>): PlanStreamEvent {
    const hashtags = Array.isArray(record.hashtags)
      ? record.hashtags
          .filter((tag): tag is string => typeof tag === 'string')
          .map((tag) => tag.replace(/^#/, '').slice(0, 30))
          .slice(0, 30)
      : [];

    const meta: PlanMeta = {
      hook: (typeof record.hook === 'string' ? record.hook : '').slice(0, 120) || '카드뉴스',
      targetAudience:
        typeof record.targetAudience === 'string' && record.targetAudience.length > 0
          ? record.targetAudience.slice(0, 80)
          : null,
      caption: (typeof record.caption === 'string' ? record.caption : '').slice(0, 2000),
      hashtags,
    };

    this.#meta = meta;
    return { type: 'meta', meta };
  }

  #nullableText(index: number, field: 'body' | 'eyebrow', value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    if (trimmed.length === 0 || trimmed === 'null') {
      return null;
    }
    return this.#clip(index, field, trimmed);
  }

  /**
   * 상한 초과 카피를 잘라낸다.
   *
   * 왜 재생성하지 않는가: 재생성은 20초를 다시 쓴다. 28자 상한을 2~3자 넘긴 것이
   * 대부분이라 잘라도 의미가 거의 보존된다. 대신 경고로 남겨 프롬프트를 고칠 근거로 쓴다.
   */
  #clip(index: number, field: keyof typeof LIMITS, value: string): string {
    const limit = LIMITS[field];
    const trimmed = value.trim();
    if (trimmed.length <= limit) {
      return trimmed;
    }

    this.#warnings.push({ kind: 'clipped', index, field, from: trimmed.length, to: limit });
    return trimmed.slice(0, limit).trimEnd();
  }
}

export class PlanParseError extends Error {
  constructor(
    message: string,
    readonly warnings: readonly ParseWarning[],
  ) {
    super(`기획 파싱 실패: ${message}`);
    this.name = 'PlanParseError';
  }
}

/** 모델이 코드블록으로 감싸는 경우를 벗겨낸다. */
function stripFence(line: string): string {
  const trimmed = line.trim();
  if (trimmed.startsWith('```')) {
    return '';
  }
  return trimmed;
}
