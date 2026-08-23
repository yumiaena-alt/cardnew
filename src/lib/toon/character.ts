import * as z from 'zod';
import { seededUnit } from '@/lib/renderer/registry';

/**
 * 캐릭터 일관성.
 *
 * 인스타툰이 카드뉴스와 갈라지는 지점은 여기 하나다: 1컷과 9컷의 주인공이
 * 같은 사람으로 보여야 한다. 이미지 모델은 같은 프롬프트에도 매번 다른 얼굴을
 * 만들므로, "일관성"은 모델에게 부탁할 게 아니라 **입력을 고정해서** 얻는다.
 *
 * 세 겹으로 고정한다. 위에서부터 강한 순이고, 아래 두 겹은 위가 없어도 동작한다.
 *
 *  1. **참고 이미지 (image-to-image)** — 캐릭터 시트 한 장을 매 컷에 함께 넣는다.
 *     가장 강하지만 사용자가 시트를 만들어야 한다.
 *  2. **앵커 프롬프트** — 생김새 문장을 *한 번* 만들어 저장하고, 매 컷 프롬프트
 *     맨 앞에 **글자 그대로** 붙인다. 컷마다 모델이 외모를 다시 묘사하게 두면
 *     그 묘사가 조금씩 흔들리고, 흔들린 만큼 얼굴이 바뀐다.
 *  3. **고정 시드** — 같은 캐릭터의 모든 컷이 같은 시드를 쓴다. 장면만 바뀌므로
 *     구도는 달라지되 화풍과 인상이 남는다.
 */

/**
 * 캐릭터의 생김새. 자유 문장이 아니라 항목으로 쪼갠다.
 *
 * 쪼개는 이유: 사용자가 "귀여운 20대 여자"라고만 쓰면 모델이 나머지를 매번
 * 새로 지어낸다. 항목을 비워 둘 수 없게 만들면, 비어서 흔들릴 자리가 없다.
 */
export const characterAppearanceSchema = z.object({
  /** 예: "20s", "early 30s". 영문으로 받는다 — 그대로 프롬프트에 들어간다. */
  ageRange: z.string().min(1).max(24),
  /** 예: "short black bob with blunt bangs". */
  hair: z.string().min(1).max(60),
  /** 예: "oversized beige knit, dark jeans". 매 컷 같은 옷을 입는다. */
  outfit: z.string().min(1).max(80),
  /** 예: "round face, small eyes, light freckles". */
  face: z.string().min(1).max(80),
  /**
   * 딱 알아보게 하는 표식. 안경·점·머리끈처럼 작고 반복 가능한 것.
   * 이게 있으면 얼굴이 조금 흔들려도 같은 인물로 읽힌다.
   */
  distinctive: z.array(z.string().max(40)).max(3).default([]),
});

export type CharacterAppearance = z.infer<typeof characterAppearanceSchema>;

/**
 * 그림체. 캐릭터가 아니라 작품 전체에 걸린다.
 *
 * 캐릭터와 분리한 이유: 같은 주인공으로 다른 화풍의 시리즈를 만들 수 있어야 하고,
 * 반대로 화풍만 바꿔 A/B를 볼 수도 있어야 한다.
 */
export const artStyleSchema = z.enum([
  'soft-webtoon',
  'bold-comic',
  'sketch-diary',
  'minimal-line',
]);

export type ArtStyleKey = z.infer<typeof artStyleSchema>;

/** 선택 가능한 그림체. 화면에 뿌리는 순서이자 스키마와 같은 목록이다. */
export const ART_STYLE_KEYS = artStyleSchema.options;

const ART_STYLES: Record<ArtStyleKey, string> = {
  'soft-webtoon': 'soft korean webtoon style, clean lineart, flat pastel colors, gentle shading',
  'bold-comic': 'bold korean instatoon style, thick outlines, high contrast flat colors',
  'sketch-diary': 'loose hand-drawn diary comic style, pencil texture, muted warm palette',
  'minimal-line': 'minimal line art, two-tone palette, generous negative space',
};

/**
 * 이미지에 절대 나오면 안 되는 것.
 *
 * 맨 앞의 세 항목이 이 파이프라인의 전제다: **글자는 모델이 그리지 않는다.**
 * 한글은 어떤 이미지 모델도 제대로 못 쓰고, 말풍선을 모델이 그려 버리면 그 위에
 * 우리 말풍선을 또 얹게 된다. 글자와 말풍선은 렌더 단계에서 합성한다.
 */
export const BASE_NEGATIVE_PROMPT = [
  'text',
  'letters',
  'korean characters',
  'speech bubble',
  'watermark',
  'signature',
  'logo',
  'extra fingers',
  'deformed hands',
  'extra limbs',
  'blurry',
  'photorealistic',
  'nsfw',
].join(', ');

/** 제공사 대부분이 받는 시드 상한. */
const MAX_SEED = 2_147_483_647;

/**
 * 재시도마다 시드를 옮기는 보폭.
 *
 * 소수를 쓰는 이유는 상한과 약수를 공유하지 않아 짧은 주기로 같은 값에
 * 돌아오지 않기 때문이다 — 재시도가 아까 그 그림을 다시 뽑으면 의미가 없다.
 */
const RETRY_STRIDE = 7919;

export type CharacterSheet = {
  name: string;
  appearance: CharacterAppearance;
  artStyle: ArtStyleKey;
  /** 이미지 생성 시드. 이 캐릭터의 모든 컷이 공유한다. */
  seed: number;
  /** 캐릭터 시트 이미지. 있으면 image-to-image로 매 컷에 함께 넣는다. */
  referenceUrl?: string | null;
};

/**
 * 앵커 문장을 만든다. **한 번만 만들고 저장해서 재사용한다.**
 *
 * 매 생성마다 다시 조립하면 항목 하나만 편집돼도 모든 컷의 인물이 바뀐다.
 * 저장해 두면 "이 캐릭터를 고쳤다"가 명시적인 행동이 된다.
 *
 * @param input - 이름, 생김새, 그림체.
 * @returns 컷 프롬프트 맨 앞에 붙일 영문 앵커.
 */
export function buildCharacterAnchor(input: {
  name: string;
  appearance: CharacterAppearance;
  artStyle: ArtStyleKey;
}): string {
  const { appearance } = input;
  const marks = appearance.distinctive.filter((mark) => mark.trim() !== '');

  return [
    `${ART_STYLES[input.artStyle]}.`,
    `Always the same single character named ${input.name}:`,
    `${appearance.ageRange}, ${appearance.face}, ${appearance.hair}.`,
    `Always wearing ${appearance.outfit}.`,
    marks.length > 0 ? `Recognisable by ${marks.join(' and ')}.` : '',
    'Keep the face, hairstyle, outfit and proportions identical in every panel.',
  ]
    .filter((line) => line !== '')
    .join(' ');
}

/**
 * 한 컷의 최종 이미지 프롬프트.
 *
 * 순서가 중요하다: 앵커가 먼저, 장면이 나중이다. 이미지 모델은 앞쪽 토큰에
 * 더 큰 가중치를 주므로, 장면을 앞에 두면 컷마다 인물이 장면에 끌려간다.
 *
 * @param sheet - 캐릭터 시트.
 * @param cut - 장면 프롬프트와 감정 태그.
 * @returns 이미지 모델에 넘길 프롬프트.
 */
export function buildCutPrompt(
  sheet: Pick<CharacterSheet, 'name' | 'appearance' | 'artStyle'>,
  cut: { imagePrompt: string; characterEmotion: string },
): string {
  const anchor = buildCharacterAnchor(sheet);

  return [
    anchor,
    `Scene: ${cut.imagePrompt}`,
    `Expression: ${cut.characterEmotion}.`,
    // 다시 한 번 못 박는다. 장면 묘사에 "간판", "메뉴판" 같은 말이 섞이면
    // 모델이 글자를 그리려 들고, 그 위에 말풍선을 얹으면 둘 다 안 읽힌다.
    'No text, no lettering, no speech bubbles anywhere in the image.',
    // 말풍선이 얹힐 자리를 미리 비워 둔다. 조판이 아무리 잘 피해도 인물이
    // 프레임을 꽉 채우면 가릴 곳밖에 남지 않는다.
    'Leave uncluttered negative space in the upper third for later captioning.',
  ].join(' ');
}

/**
 * 컷에 쓸 시드.
 *
 * 기본은 캐릭터 시드 그대로다 — 같은 시드가 화풍과 인상을 붙잡아 준다.
 * 재시도(attempt > 0)일 때만 값을 흔든다. 같은 시드로 다시 뽑으면 마음에
 * 안 들었던 그 그림이 그대로 또 나오기 때문이다.
 *
 * @param baseSeed - 캐릭터 시드.
 * @param attempt - 이 컷을 몇 번째로 그리는지. 첫 시도는 0.
 * @returns 이미지 모델에 넘길 시드.
 */
export function cutSeed(baseSeed: number, attempt = 0): number {
  if (attempt === 0) {
    return baseSeed;
  }

  // 32비트 안에 머물러야 한다. 제공사 대부분이 그 밖의 값을 거절한다.
  return (baseSeed + attempt * RETRY_STRIDE) % MAX_SEED;
}

/**
 * 사용자가 시드를 고르지 않았을 때 쓸 값.
 *
 * 이름에서 유도한다. 무작위로 뽑으면 같은 캐릭터를 다시 만들 방법이 없고,
 * 마이그레이션이나 재현 테스트에서 "그때 그 그림"으로 돌아갈 수 없다.
 *
 * @param name - 캐릭터 이름.
 * @returns 32비트 양의 정수 시드.
 */
export function seedFromName(name: string): number {
  // 조판 엔진이 템플릿을 고를 때 쓰는 것과 같은 해시다. 필요한 성질이 같고
  // (고르게 퍼지고 재현 가능하면 충분), 두 벌을 둘 이유가 없다.
  return Math.floor(seededUnit(name) * MAX_SEED);
}

/**
 * 외모를 다시 묘사하려 드는 장면 프롬프트를 잡아낸다.
 *
 * 하드 실패로 두지 않는 이유: 걸러 낸 단어가 정말 인물 묘사인지("her red hair"
 * 대 "a red door")를 문자열만으로는 알 수 없다. 대신 경고로 올려 두면,
 * 인물이 흔들린 덱을 열었을 때 왜 흔들렸는지가 기록으로 남는다.
 *
 * @param imagePrompt - 모델이 만든 장면 프롬프트.
 * @returns 외모를 다시 지정하려 한 단어들. 비어 있으면 깨끗하다.
 */
export function findIdentityDrift(imagePrompt: string): string[] {
  const banned = [
    'hair',
    'wearing',
    'dressed',
    'outfit',
    'years old',
    'age ',
    'blonde',
    'brunette',
    'freckle',
  ];
  const lowered = imagePrompt.toLowerCase();

  return banned.filter((term) => lowered.includes(term));
}
