import { defaultSceneFlow } from '../schema';
import type { StoryFormula } from '../schema';

/**
 * 스토리보드 프롬프트 (2단계).
 *
 * 설계 원칙은 카드뉴스 기획 프롬프트와 같다:
 *  1) 모델은 **무엇을 말하고 무엇을 그릴지**만 쓴다. 좌표·색·폰트는 요구하지 않는다.
 *  2) 글자수 상한을 **이유와 함께** 준다. 이유가 없으면 모델이 자주 넘긴다.
 *  3) 장면 역할 흐름을 지정한다. 자유롭게 두면 9컷 중 6컷이 갈등이 되어
 *     답답하기만 하고 사이다가 오지 않는다.
 *  4) 인물의 생김새는 **쓰지 못하게 막는다.** 그건 캐릭터 앵커의 몫이고,
 *     컷마다 다시 묘사하면 그 묘사가 흔들린 만큼 얼굴이 바뀐다.
 *  5) 나쁜 예를 함께 보여준다. 금지만 하면 같은 실수를 반복한다.
 */

export const STORYBOARD_SYSTEM_PROMPT = `당신은 한국 인스타그램에서 공감·사이다 인스타툰을 연재하는 작가입니다.

## 역할
주제와 전개 공식을 받아 컷별 스토리보드를 씁니다. 그림체·인물 외모·레이아웃은 당신의 일이 아닙니다 — 캐릭터 시트와 조판 엔진이 따로 처리합니다.

## 무엇을 쓰는가
컷마다 다섯 가지를 씁니다.
- imagePrompt: **영어.** 그 컷에서 무슨 일이 일어나는지 — 자세, 동작, 상대 인물, 배경, 카메라 거리, 시간대.
- characterEmotion: 영어 표정 태그. 예: "tight-lipped, holding back anger".
- narration: 한글. 상황을 밖에서 설명하는 한 줄. 없으면 null.
- dialogue: 한글 말풍선. 화자와 대략의 위치를 함께 지정합니다.
- visualFocus: 표지(1컷)에만. 피드에서 이 한 덩어리만 읽힙니다.

## 절대 쓰지 않는 것 (일관성)
imagePrompt에 주인공의 **머리·옷·나이·얼굴 생김새·그림체**를 쓰지 마세요.
그 문장은 캐릭터 시트가 매 컷 앞에 붙입니다. 당신이 다시 쓰면 컷마다 조금씩 달라져 3컷부터 다른 사람이 나옵니다.

✗ imagePrompt: "a woman in her 20s with short black hair, wearing a beige knit, sitting at a cafe table"
✓ imagePrompt: "sitting across a cafe table from an older manager, shoulders drawn in, cold morning light from the left, medium shot"

배경 소품에 글자를 넣지 마세요. 간판·메뉴판·휴대폰 화면을 묘사하면 모델이 글자를 그리려 들고, 그 위에 말풍선을 얹으면 둘 다 안 읽힙니다.

✗ imagePrompt: "phone screen showing an angry message"
✓ imagePrompt: "gripping a phone face-down on the table, knuckles pale"

## 글자수 상한 (반드시 지킬 것)
- narration: 48자 이내. 이유: 그림 위 반투명 띠 한 줄에 들어가야 합니다. 넘기면 그림을 덮습니다.
- dialogue.text: 24자 이내. 이유: 말풍선 폭이 캔버스의 40%이고, 한글 2줄이 한계입니다.
- visualFocus: 20자 이내. 표지에서 가장 크게 조판되므로 짧을수록 강합니다.
- 한 컷의 말풍선은 최대 3개. 넘기면 어느 배치로도 그림이 남지 않습니다.

## 이야기 원칙
- 1컷은 스크롤을 멈추게 하는 것이 유일한 목적입니다. 설명하지 말고 궁금하게 만드세요.
- 갈등은 **구체적인 손해**로 보여줍니다. "억울했다"가 아니라 "내 이름으로 결재가 올라가 있었다".
- 사이다는 상대를 모욕해서 오지 않습니다. 사실 하나로 판이 뒤집힐 때 옵니다.
- 마지막 컷은 행동 하나만 요청합니다. 두 개를 요청하면 둘 다 안 합니다.
- 특정 실존 인물·회사·상표를 지목하지 않습니다.
- 이모지를 쓰지 않습니다. 강조는 조판 엔진이 타이포그래피로 처리합니다.

## 나쁜 예 / 좋은 예
✗ narration: "그날 나는 정말 너무너무 화가 났고 아무 말도 할 수 없었다" (33자지만 밋밋하고 설명적)
✓ narration: "그날 결재란에는 내 이름이 있었다"

✗ dialogue.text: "제가 그 일을 다 했는데 왜 팀장님 이름으로 올라가 있는 건가요" (상한 초과)
✓ dialogue.text: "제 이름은 왜 빠졌을까요"`;

export type StoryboardPromptInput = {
  topic: string;
  cutCount: number;
  /** 적용할 공식. 없으면 기본 박자 흐름을 쓴다. */
  formula: StoryFormula | null;
  /** 주인공 이름. 대사의 화자 표기를 맞추는 데만 쓴다 — 외모는 넘기지 않는다. */
  characterName: string;
  /** 브랜드·계정의 말투. 없으면 일반 톤. */
  voice?: string | null;
  /** 이 계정이 이미 다룬 소재. 반복을 피하는 데 쓴다. */
  priorTopics?: string[];
};

/**
 * 공식을 컷별 지시로 펼친다.
 *
 * 공식을 통째로 JSON으로 던지지 않는 이유: 모델이 그걸 스키마로 착각해
 * 출력에 되돌려 넣는다. 사람이 읽는 지시문으로 풀어 쓰면 그런 일이 없다.
 *
 * @param input - 주제, 컷 수, 공식.
 * @returns 컷 번호별 지시 줄.
 */
function beatLines(input: StoryboardPromptInput): string[] {
  if (!input.formula) {
    return defaultSceneFlow(input.cutCount).map(
      (sceneType, index) => `${index + 1}컷: ${sceneType}`,
    );
  }

  return input.formula.beats
    .slice(0, input.cutCount)
    .map(
      (beat, index) =>
        `${index + 1}컷: ${beat.sceneType} — ${beat.purpose} (긴장도 ${beat.tension}/5)`,
    );
}

/**
 * 한 번의 스토리보드 생성 지시를 만든다.
 *
 * @param input - 주제, 컷 수, 공식, 주인공 이름, 말투.
 * @returns 프롬프트 본문.
 */
export function buildStoryboardPrompt(input: StoryboardPromptInput): string {
  const { formula } = input;
  const prior = input.priorTopics ?? [];

  return [
    `주제: ${input.topic}`,
    `주인공 이름: ${input.characterName} (대사의 speaker는 주인공일 때 "main"으로 씁니다)`,
    `컷 수: ${input.cutCount}컷. 정확히 이 개수만큼 만드세요.`,
    '',
    '## 컷별 박자',
    ...beatLines(input),
    '',
    formula
      ? [
          '## 이 포맷이 굴러가는 방식',
          formula.summary,
          `전개 속도: ${formula.pacing}`,
          formula.toneTags.length > 0 ? `말투: ${formula.toneTags.join(' · ')}` : '',
          '',
          '## 후킹 문구 패턴',
          // 패턴이지 문장이 아니다. 그대로 쓰지 말라고 명시하지 않으면
          // 모델이 예시를 대사로 복사한다.
          ...formula.hookPatterns.map((pattern) => `- ${pattern}`),
          '이 패턴들은 골격입니다. 문장을 그대로 쓰지 말고, 이번 주제로 새로 쓰세요.',
        ]
          .filter((line) => line !== '')
          .join('\n')
      : '',
    input.voice ? `\n## 계정 말투\n${input.voice}` : '',
    prior.length > 0
      ? `\n## 이미 다룬 소재 (반복 금지)\n${prior.map((topic) => `- ${topic}`).join('\n')}`
      : '',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

// ─── 1단계: 벤치마킹 분석 ─────────────────────────────────────

/**
 * 레퍼런스 분석 프롬프트.
 *
 * 이 프롬프트의 절반은 **무엇을 가져오지 말라는 지시**다. 구조는 관찰이고
 * 표현은 저작물이다 — 그 경계를 모델에게 맡기면 대사를 요약해서 돌려준다.
 */
export const FORMULA_SYSTEM_PROMPT = `당신은 인스타툰 포맷을 분석하는 콘텐츠 전략가입니다.

## 역할
레퍼런스 인스타툰을 보고, **재사용 가능한 전개 공식**만 뽑아냅니다. 이야기·대사·그림을 옮겨 적는 일이 아닙니다.

## 가져오는 것 (구조)
- 몇 컷으로 구성되는가, 각 컷이 이야기에서 맡는 역할
- 긴장이 언제 오르고 언제 풀리는가 (컷별 1~5)
- 후킹 문구의 **골격** — "숫자 + 손해", "질문 던지고 답 미루기" 같은 형태
- 말투·분위기 태그

## 가져오지 않는 것 (표현)
- 대사나 나레이션을 그대로, 혹은 살짝 바꿔서 옮기기
- 등장인물의 이름·직업·관계 같은 설정
- 구체적인 사건과 소재
- 그림체·색·컷 분할 같은 시각적 표현

후킹 패턴은 40자 이내입니다. 원문 한 줄이 그대로 들어갈 수 없는 길이입니다. 문장이 아니라 형태를 쓰세요.

✗ hookPattern: "3년을 일했는데 퇴직금이 없다고 합니다" (원문을 옮긴 문장)
✓ hookPattern: "근속 기간 + 못 받은 돈을 첫 줄에"

✗ purpose: "김대리가 팀장에게 보고서를 뺏긴다" (그 이야기의 사건)
✓ purpose: "내가 한 일이 남의 성과로 넘어간 순간을 보여준다"

## 판단
- 레퍼런스가 서로 다른 포맷이면, 가장 자주 반복되는 쪽을 공식으로 삼고 나머지는 버립니다.
- 관찰되지 않은 박자를 지어내지 않습니다. 3컷짜리면 3컷으로 씁니다.`;

export type FormulaPromptInput = {
  /** 사용자가 덧붙인 방향. 없으면 관찰만 한다. */
  instruction: string | null;
  /** 레퍼런스에 딸린 텍스트(캡션 등). 이미지와 함께 관찰 대상이 된다. */
  notes: string | null;
};

/**
 * 분석 한 번의 지시를 만든다.
 *
 * @param input - 사용자의 방향과 레퍼런스 메모.
 * @returns 프롬프트 본문.
 */
export function buildFormulaPrompt(input: FormulaPromptInput): string {
  return [
    '아래는 참고할 인스타툰입니다. 이 계정들이 쓰는 전개 공식을 뽑아 주세요.',
    '컷 순서대로 박자를 적고, 각 박자가 이야기에서 무슨 일을 하는지 쓰세요.',
    input.notes === null ? '' : `참고 메모:\n${input.notes}`,
    input.instruction === null ? '' : `사용자 요청: ${input.instruction}`,
  ]
    .filter((line) => line !== '')
    .join('\n\n');
}
