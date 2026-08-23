import { anthropic } from '@ai-sdk/anthropic';
import { generateText, Output } from 'ai';
import { logger } from '@/libs/Logger';
import { buildFormulaPrompt, FORMULA_SYSTEM_PROMPT } from './prompts/storyboard-prompt';
import { storyFormulaSchema } from './schema';
import type { StoryFormula } from './schema';

/**
 * 1단계 — 벤치마킹 분석.
 *
 * 나오는 것은 그림이 아니라 **공식**이다. 디자인 학습(`features/template/learn.ts`)이
 * 참고 이미지에서 레이아웃 골격만 읽어 오는 것과 정확히 같은 형태를 쓴다:
 * 구조는 재사용할 수 있고, 표현은 남의 것이다.
 *
 * 분석 결과를 컷 프롬프트에 그대로 넘기지 않는다는 점이 중요하다. 공식은
 * "몇 번째 컷에서 긴장을 얼마나 올리는가"까지만 말하고, 그 자리에 들어갈
 * 이야기는 2단계가 이번 주제로 새로 쓴다.
 */

const MODEL = 'claude-sonnet-4-5';

/** 제공사가 한 요청에 받는 이미지 상한이자, 포맷을 읽어 내기에 충분한 수. */
export const MAX_FORMULA_REFERENCES = 10;

export type AnalyzeFormulaInput = {
  /** 레퍼런스 이미지. data URL 또는 모델이 읽을 수 있는 공개 URL. */
  images: string[];
  /** 캡션처럼 이미지에 딸린 텍스트. 없으면 이미지만 본다. */
  notes: string | null;
  /** 사용자가 덧붙인 방향. */
  instruction: string | null;
};

export type AnalyzedFormula = {
  formula: StoryFormula;
  usage: { inputTokens: number; outputTokens: number; imageCount: number };
  /** 표현을 옮겨 온 것으로 의심되는 항목. 실패는 아니지만 사람이 봐야 한다. */
  warnings: string[];
};

/**
 * 원문을 그대로 옮겨 왔을 가능성이 있는 항목을 찾는다.
 *
 * 길이 상한(40자)이 1차 방어이고 이건 2차다. 상한 안에서도 캡션 한 줄이
 * 그대로 들어올 수 있는데, 그럴 때는 대개 **패턴 서술이 아니라 완결된 문장**이라
 * 종결어미로 끝난다. 완벽한 판별은 아니지만, 사람이 확인할 자리를 만들어 준다.
 *
 * @param formula - 모델이 만든 공식.
 * @returns 사람이 확인해야 할 항목 설명. 비어 있으면 깨끗하다.
 */
function findVerbatimRisk(formula: StoryFormula): string[] {
  const sentenceEnding = /(?:다|요|죠|까|네|음)[.!?]?$/u;

  return formula.hookPatterns
    .filter((pattern) => sentenceEnding.test(pattern.trim()))
    .map((pattern) => `hook_pattern_reads_as_sentence:${pattern}`);
}

/**
 * 레퍼런스에서 전개 공식을 뽑는다.
 *
 * @param input - 레퍼런스 이미지, 메모, 사용자 방향.
 * @returns 공식, 호출 비용, 사람이 확인할 경고.
 * @throws Error when the reference count is outside what the provider accepts.
 */
export async function analyzeToonFormula(input: AnalyzeFormulaInput): Promise<AnalyzedFormula> {
  if (input.images.length === 0 || input.images.length > MAX_FORMULA_REFERENCES) {
    throw new Error(`Reference images must be between 1 and ${MAX_FORMULA_REFERENCES}`);
  }

  const result = await generateText({
    model: anthropic(MODEL),
    output: Output.object({ schema: storyFormulaSchema }),
    system: FORMULA_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: buildFormulaPrompt({ instruction: input.instruction, notes: input.notes }),
          },
          ...input.images.map((image) => ({ type: 'image' as const, image })),
        ],
      },
    ],
  });

  const formula = result.output;
  const warnings = findVerbatimRisk(formula);

  logger.info('Toon formula analyzed', {
    beats: formula.beats.length,
    images: input.images.length,
    warnings: warnings.length,
  });

  return {
    formula,
    usage: {
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
      imageCount: input.images.length,
    },
    warnings,
  };
}
