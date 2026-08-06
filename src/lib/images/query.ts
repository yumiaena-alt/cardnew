import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

/**
 * 검색어를 사진 라이브러리가 알아듣는 말로 바꾼다.
 *
 * Unsplash는 영어로 색인돼 있다. "아이스 아메리카노"는 2건, "iced americano"는
 * 5천 건이 나온다 — 한글로 검색하면 라이브러리가 빈 것처럼 보인다.
 *
 * 무조건 번역하지는 않는다. 결과가 실제로 얕을 때만 한 번 더 묻는다.
 * 잘 나오는 검색에까지 모델 호출을 얹을 이유가 없다.
 */

/** 이 아래면 "찾은 게 없다"에 가깝다. 3열 그리드 한 줄도 못 채운다. */
const THIN_RESULT_COUNT = 3;

/** 번역은 짧은 명사구 하나면 된다. 문장이 오면 검색이 다시 좁아진다. */
const MODEL = 'claude-haiku-4-5-20251001';

/**
 * 한글이 섞인 검색어인지.
 *
 * @param query - 사용자가 친 검색어.
 * @returns 한글 음절이 하나라도 있으면 true.
 */
export function hasKorean(query: string): boolean {
  return /[가-힣]/u.test(query);
}

/**
 * 다시 찾아볼 값어치가 있는지.
 *
 * @param input - 첫 검색의 결과 수와 검색어.
 * @returns 번역해서 재검색할지 여부.
 */
export function shouldRetranslate(input: { query: string; resultCount: number }): boolean {
  return input.resultCount < THIN_RESULT_COUNT && hasKorean(input.query);
}

/**
 * 한글 검색어를 영어 명사구로 옮긴다.
 *
 * @param query - 원래 검색어.
 * @returns 영어 검색어. 모델이 답하지 않으면 원래 값 그대로.
 */
export async function toEnglishQuery(query: string): Promise<string> {
  const result = await generateText({
    model: anthropic(MODEL),
    prompt: [
      'Translate this Korean photo search into an English stock-photo query.',
      'Two or three words, nouns only, no punctuation, no explanation.',
      `Korean: ${query}`,
    ].join('\n'),
  });

  const translated = result.text.trim().split('\n')[0]?.trim() ?? '';

  return translated === '' ? query : translated;
}
