import { anthropic } from '@ai-sdk/anthropic';
import { generateObject, streamText, NoObjectGeneratedError } from 'ai';
import { PlanLineParser, PlanParseError } from './plan-parser';
import type { ParseWarning, PlanStreamEvent } from './plan-parser';
import { buildPlanPrompt, PLAN_JSONL_FORMAT, PLAN_SYSTEM_PROMPT } from './prompts/plan-prompt';
import type { PlanPromptInput } from './prompts/plan-prompt';
import { cardnewsPlanSchema, resolveSlideCount, suggestRoleFlow } from './schema';
import type { CardnewsPlan, GenerateRequest } from './schema';

/**
 * Stage 1 — 기획 생성.
 *
 * 어댑터로 분리한 이유: 실제 LLM 호출과 fixture를 같은 인터페이스로 두면
 * ① 키 없이도 파이프라인 전체를 테스트할 수 있고
 * ② 프롬프트 회귀를 골든셋으로 검증할 수 있고
 * ③ 비용이 드는 호출을 개발 중에 피할 수 있다.
 */

export type PlannerOptions = {
  request: GenerateRequest;
  brandVoice?: string | null;
  bannedTerms?: string[];
  examples?: { headline: string; body: string | null }[];
  sourceText?: string | null;
  /** 기본값: claude-sonnet-4-5. 기획은 추론보다 문장력이 중요하다. */
  model?: string;
  /** 슬라이드가 하나씩 완성될 때 호출된다 (스트리밍 UX) */
  onPartialSlide?: (index: number, total: number) => void;
};

export type PlanResult = {
  plan: CardnewsPlan;
  usage: { inputTokens: number; outputTokens: number };
  /** 스키마 위반으로 재시도한 횟수 */
  retries: number;
  durationMs: number;
};

export type Planner = {
  generate(options: PlannerOptions): Promise<PlanResult>;
};

export const DEFAULT_PLAN_MODEL = 'claude-sonnet-4-5';

// ─── 실제 LLM 어댑터 ─────────────────────────────────────────

export class AnthropicPlanner implements Planner {
  readonly #maxRetries: number;

  constructor(options: { maxRetries?: number } = {}) {
    // 1회만 재시도한다. 두 번 실패하면 프롬프트나 주제에 구조적 문제가 있어
    // 더 시도해도 같은 결과가 나오고 비용만 든다.
    this.#maxRetries = options.maxRetries ?? 1;
  }

  async generate(options: PlannerOptions): Promise<PlanResult> {
    const startedAt = Date.now();
    const slideCount = resolveSlideCount(options.request);

    const promptInput: PlanPromptInput = {
      topic: options.request.topic,
      slideCount,
      language: options.request.language,
      brandVoice: options.brandVoice ?? null,
      ...(options.bannedTerms ? { bannedTerms: options.bannedTerms } : {}),
      ...(options.examples ? { examples: options.examples } : {}),
      sourceText: options.sourceText ?? null,
    };

    const prompt = buildPlanPrompt(promptInput);
    const model = anthropic(options.model ?? DEFAULT_PLAN_MODEL);

    let retries = 0;
    let lastError: unknown = null;

    while (retries <= this.#maxRetries) {
      try {
        // This is the non-streaming fallback — the very path the source project
        // measured at 14.6s to first slide against 2.8s for the JSONL stream below.
        // Migrate it to `generateText` with `output`, or drop it, once the planner is
        // wired to a route and the fallback earns its place.
        // oxlint-disable-next-line typescript/no-deprecated
        const result = await generateObject({
          model,
          schema: cardnewsPlanSchema,
          system: PLAN_SYSTEM_PROMPT,
          prompt,
          // 카피는 다양성이 필요하지만 스키마 준수가 더 중요하다.
          temperature: 0.7,
          maxRetries: 0, // 재시도는 이 루프가 관리한다
        });

        const plan = enforceSlideCount(result.object, slideCount);
        options.onPartialSlide?.(plan.slides.length, plan.slides.length);

        return {
          plan,
          usage: {
            inputTokens: result.usage.inputTokens ?? 0,
            outputTokens: result.usage.outputTokens ?? 0,
          },
          retries,
          durationMs: Date.now() - startedAt,
        };
      } catch (error) {
        lastError = error;
        retries += 1;

        // 스키마 위반이면 재시도할 가치가 있다. 인증·쿼터 오류는 재시도해도 같다.
        if (!NoObjectGeneratedError.isInstance(error)) {
          break;
        }
      }
    }

    throw new PlanGenerationError(
      lastError instanceof Error ? lastError.message : '알 수 없는 오류',
      { cause: lastError, retries },
    );
  }
}

export class PlanGenerationError extends Error {
  readonly retries: number;

  constructor(message: string, options: { cause?: unknown; retries: number }) {
    super(`기획 생성 실패: ${message}`);
    this.name = 'PlanGenerationError';
    this.retries = options.retries;
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

/**
 * 스트리밍 기획 생성 (JSONL 텍스트).
 *
 * ⚠️ 도구(structured output) 스트리밍을 쓰지 않는 이유 — 실측 근거:
 *    Anthropic API는 도구 호출의 JSON 델타를 12~14초 묶어뒀다가 한 번에 flush한다.
 *    같은 회선·같은 시각에 텍스트 스트림은 최대 공백 0.6초로 매끄러웠다.
 *    그래서 "첫 슬라이드까지 13초"는 스키마 필드 순서를 바꿔도 줄지 않았다.
 *    (재현: packages/ai `pnpm measure:stream`)
 *
 * 반환 계약: `events`를 끝까지 소비해야 `final`이 확정된다.
 * 중간에 break하면(클라이언트 이탈) final은 영원히 대기하므로 함께 버려야 한다.
 */
export async function streamPlan(options: PlannerOptions): Promise<PlanStreamHandle> {
  const startedAt = Date.now();
  const slideCount = resolveSlideCount(options.request);

  const prompt = buildPlanPrompt({
    topic: options.request.topic,
    slideCount,
    language: options.request.language,
    brandVoice: options.brandVoice ?? null,
    ...(options.bannedTerms ? { bannedTerms: options.bannedTerms } : {}),
    ...(options.examples ? { examples: options.examples } : {}),
    sourceText: options.sourceText ?? null,
  });

  const result = streamText({
    model: anthropic(options.model ?? DEFAULT_PLAN_MODEL),
    system: `${PLAN_SYSTEM_PROMPT}\n\n${PLAN_JSONL_FORMAT}`,
    prompt,
    temperature: 0.7,
  });

  let settle: (value: PlanResult) => void = () => {};
  let fail: (reason: unknown) => void = () => {};
  const final = new Promise<PlanResult>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });
  // 소비자가 final을 안 기다리는 경로(취소 등)에서 unhandled rejection이 되지 않게 한다.
  void final.catch(() => {});

  const parser = new PlanLineParser();

  async function* events(): AsyncGenerator<PlanStreamEvent> {
    try {
      for await (const delta of result.textStream) {
        for (const event of parser.push(delta)) {
          // 요청한 장수를 넘긴 슬라이드는 흘리지 않는다 — 화면과 최종본이 어긋난다.
          if (event.type === 'slide' && event.index >= slideCount) {
            continue;
          }
          yield event;
        }
      }
      for (const event of parser.flush()) {
        if (event.type === 'slide' && event.index >= slideCount) {
          continue;
        }
        yield event;
      }

      const usage = await result.usage;
      settle({
        plan: enforceSlideCount(parser.buildPlan(), slideCount),
        usage: {
          inputTokens: usage.inputTokens ?? 0,
          outputTokens: usage.outputTokens ?? 0,
        },
        retries: 0,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      fail(
        error instanceof PlanParseError
          ? error
          : new PlanGenerationError(error instanceof Error ? error.message : '알 수 없는 오류', {
              cause: error,
              retries: 0,
            }),
      );
      throw error;
    }
  }

  return { events: events(), final, warnings: () => parser.warnings };
}

export type PlanStreamHandle = {
  events: AsyncIterable<PlanStreamEvent>;
  /** events를 끝까지 소비한 뒤에 확정된다. */
  final: Promise<PlanResult>;
  /** 카피 잘림·무시된 줄. 프롬프트 회귀 신호. */
  warnings: () => readonly ParseWarning[];
};

/**
 * 장수를 요청값에 맞춘다.
 *
 * LLM은 "5장"이라고 지시해도 4장이나 6장을 만드는 경우가 있다.
 * 많으면 자르고, 적으면 그대로 둔다 — 없는 카피를 코드가 만들어낼 수는 없고,
 * 억지로 채우면 품질이 떨어진 슬라이드가 생긴다. 대신 호출부가 알 수 있게 한다.
 */
function enforceSlideCount(plan: CardnewsPlan, requested: number): CardnewsPlan {
  if (plan.slides.length <= requested) {
    return plan;
  }
  return { ...plan, slides: plan.slides.slice(0, requested) };
}

// ─── Fixture 어댑터 (키 없이 테스트용) ───────────────────────

/**
 * 고정 응답을 돌려주는 어댑터.
 *
 * 파이프라인 전체(기획 → 조판 → 렌더)를 API 호출 없이 테스트할 때 쓴다.
 * 실제 LLM 응답과 같은 스키마를 통과하므로 계약 위반을 잡아낸다.
 */
export class FixturePlanner implements Planner {
  constructor(private readonly fixture?: CardnewsPlan) {}

  async generate(options: PlannerOptions): Promise<PlanResult> {
    const slideCount = resolveSlideCount(options.request);
    const plan = this.fixture ?? buildFixturePlan(options.request.topic, slideCount);

    // 스키마를 실제로 통과시켜 fixture가 계약을 어기지 않는지 확인한다.
    const validated = cardnewsPlanSchema.parse(plan);

    return {
      plan: validated,
      usage: { inputTokens: 0, outputTokens: 0 },
      retries: 0,
      durationMs: 0,
    };
  }
}

/** 주제에서 그럴듯한 fixture를 만든다. 렌더 파이프라인 검증용. */
export function buildFixturePlan(topic: string, slideCount: number): CardnewsPlan {
  const roles = suggestRoleFlow(slideCount);
  const subject = topic.slice(0, 12);

  return {
    hook: `${subject}에 대해 알아야 할 것`,
    targetAudience: '관심 있는 고객',
    slides: roles.map((role, index) => ({
      role: role as CardnewsPlan['slides'][number]['role'],
      headline: fixtureHeadline(role, subject, index),
      body: fixtureBody(role),
      eyebrow: role === 'cover' ? 'NEW' : role === 'cta' ? '지금 확인' : `STEP ${index}`,
      imageQuery: `${role} scene, natural light, no text`,
      imageMood: index % 2 === 0 ? 'warm' : 'cool',
      templateHint: null,
    })),
    caption: `${subject} 관련 안내입니다.`,
    hashtags: ['카드뉴스', '안내'],
  };
}

function fixtureHeadline(role: string, subject: string, index: number): string {
  const map: Record<string, string> = {
    cover: `${subject}, 이렇게 달라집니다`,
    problem: '이런 고민 있으셨나요',
    point: `핵심은 ${index}번째입니다`,
    example: '실제로 이렇게 씁니다',
    quote: '결국 기본이 답입니다',
    cta: '지금 확인해보세요',
  };
  return (map[role] ?? `${subject} 안내`).slice(0, 28);
}

function fixtureBody(role: string): string | null {
  if (role === 'quote') {
    return '― 담당자';
  }
  return '구체적인 설명을 여기에 담습니다. 짧고 명확하게 씁니다.';
}
