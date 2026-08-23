import { anthropic } from '@ai-sdk/anthropic';
import { generateText, Output } from 'ai';
import { logger } from '@/libs/Logger';
import { findIdentityDrift } from './character';
import { buildStoryboardPrompt, STORYBOARD_SYSTEM_PROMPT } from './prompts/storyboard-prompt';
import { resolveCutCount, toonStoryboardSchema } from './schema';
import type { StoryFormula, ToonStoryboard } from './schema';

/**
 * 2단계 — 컷별 스토리보드.
 *
 * 카드뉴스 기획(`lib/plan/planner.ts`)과 같은 자리에 있는 단계이고, 같은 이유로
 * 스키마를 강제한다. 다른 점은 출력이 카피가 아니라 **그림 지시 + 대사**라는 것,
 * 그래서 검증이 하나 더 붙는다는 것이다: 장면 프롬프트가 인물의 외모를 다시
 * 묘사하려 들면 잡아낸다.
 *
 * 스트리밍을 쓰지 않는다. 카드뉴스와 달리 컷 하나를 먼저 보여줘도 할 게 없다 —
 * 그림이 나오기 전까지는 어차피 기다려야 하고, 그 시간은 이미지 생성이 지배한다.
 */

const MODEL = 'claude-sonnet-4-5';

/** 스키마 위반은 한 번만 다시 시도한다. 두 번 실패하면 주제나 공식에 문제가 있다. */
const MAX_RETRIES = 1;

export type StoryboardInput = {
  topic: string;
  characterName: string;
  formula: StoryFormula | null;
  /** 사용자가 컷 수를 직접 골랐을 때. 없으면 공식이 정한다. */
  cutCount?: number;
  voice?: string | null;
  priorTopics?: string[];
};

export type StoryboardResult = {
  storyboard: ToonStoryboard;
  usage: { inputTokens: number; outputTokens: number };
  /** 인물 외모를 다시 지정하려 한 컷. 일관성이 흔들릴 자리다. */
  warnings: string[];
};

class StoryboardGenerationError extends Error {
  constructor(message: string, options: { cause?: unknown } = {}) {
    super(`스토리보드 생성 실패: ${message}`);
    this.name = 'StoryboardGenerationError';

    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

/**
 * 컷 수를 요청값에 맞춘다.
 *
 * 많으면 자른다. 적으면 그대로 둔다 — 없는 이야기를 코드가 만들어 낼 수는 없고,
 * 억지로 채우면 빈 컷이 하나 생긴다. 대신 호출부가 개수를 보고 알 수 있다.
 *
 * @param storyboard - 모델이 만든 스토리보드.
 * @param requested - 요청한 컷 수.
 * @returns 컷 수가 맞춰진 스토리보드.
 */
function enforceCutCount(storyboard: ToonStoryboard, requested: number): ToonStoryboard {
  if (storyboard.cuts.length <= requested) {
    return storyboard;
  }

  return { ...storyboard, cuts: storyboard.cuts.slice(0, requested) };
}

/**
 * 컷 번호를 1부터 다시 매긴다.
 *
 * 모델이 번호를 건너뛰거나 0부터 시작하는 경우가 있다. 번호는 조판·파일 경로·
 * 발행 순서가 전부 쓰는 값이라 배열 순서와 어긋나면 안 된다.
 *
 * @param storyboard - 스토리보드.
 * @returns 번호가 배열 순서와 일치하는 스토리보드.
 */
function renumber(storyboard: ToonStoryboard): ToonStoryboard {
  return {
    ...storyboard,
    cuts: storyboard.cuts.map((cut, index) => ({ ...cut, cutNumber: index + 1 })),
  };
}

/**
 * 주제와 공식으로 스토리보드를 만든다.
 *
 * @param input - 주제, 주인공 이름, 공식, 컷 수, 말투.
 * @returns 스토리보드, 토큰 사용량, 일관성 경고.
 * @throws StoryboardGenerationError when the model cannot produce a valid storyboard.
 */
export async function generateStoryboard(input: StoryboardInput): Promise<StoryboardResult> {
  const cutCount = resolveCutCount(input.formula, input.cutCount);

  const prompt = buildStoryboardPrompt({
    topic: input.topic,
    cutCount,
    formula: input.formula,
    characterName: input.characterName,
    voice: input.voice ?? null,
    ...(input.priorTopics ? { priorTopics: input.priorTopics } : {}),
  });

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const result = await generateText({
        model: anthropic(MODEL),
        output: Output.object({ schema: toonStoryboardSchema }),
        system: STORYBOARD_SYSTEM_PROMPT,
        prompt,
        // 이야기는 다양성이 필요하지만 스키마 준수가 더 중요하다.
        temperature: 0.8,
        maxRetries: 0,
      });

      const storyboard = renumber(enforceCutCount(result.output, cutCount));

      const warnings = storyboard.cuts.flatMap((cut) =>
        findIdentityDrift(cut.imagePrompt).map((term) => `identity_drift:${cut.cutNumber}:${term}`),
      );

      logger.info('Storyboard generated', {
        cuts: storyboard.cuts.length,
        warnings: warnings.length,
        attempt,
      });

      return {
        storyboard,
        usage: {
          inputTokens: result.usage.inputTokens ?? 0,
          outputTokens: result.usage.outputTokens ?? 0,
        },
        warnings,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw new StoryboardGenerationError(
    lastError instanceof Error ? lastError.message : '알 수 없는 오류',
    { cause: lastError },
  );
}
