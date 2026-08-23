import { Env } from '@/libs/Env';
import type { ProvenanceRecord } from './types';

/**
 * fal.ai 이미지 생성.
 *
 * `ImageProvider`(검색 계약)를 구현하지 않는다. 생성은 검색과 다른 일이다 —
 * 후보를 재랭킹할 일도, 다운로드 트리거를 보고할 일도 없고, 대신 시드와 참고
 * 이미지라는 입력이 있다. 억지로 같은 인터페이스에 넣으면 양쪽 다 어색해진다.
 * 공유하는 것은 `ProvenanceRecord` 하나이고, 그거면 충분하다.
 *
 * SDK 대신 fetch를 쓴다. 쓰는 것은 엔드포인트 하나이고, 이미 리포에 있는
 * 다른 외부 연동(Unsplash·Meta Graph)도 전부 fetch다.
 */

const FAL_ENDPOINT = 'https://fal.run';

/**
 * 모델 두 개를 쓴다.
 *
 * 참고 이미지가 없으면 텍스트만으로 그리고, 있으면 image-to-image로 그린다.
 * 후자가 캐릭터 일관성의 가장 강한 장치다 — 앵커 문장이 "같은 사람으로 써 달라"고
 * 부탁하는 것이라면, 참고 이미지는 같은 사람을 실제로 보여 주는 것이다.
 */
const MODELS = {
  text: 'fal-ai/flux/dev',
  reference: 'fal-ai/flux/dev/image-to-image',
} as const;

/**
 * 참고 이미지를 얼마나 따를지.
 *
 * 낮을수록 참고 이미지에 가깝다. 0.65는 "같은 인물, 다른 장면"이 나오는 값이다.
 * 더 낮추면 컷마다 같은 포즈가 나오고, 더 올리면 얼굴이 흔들리기 시작한다.
 */
const REFERENCE_STRENGTH = 0.65;

/** 한 장이 이보다 오래 걸리면 큐가 밀린 것이다. 9컷이 그만큼 기다릴 수는 없다. */
const GENERATE_TIMEOUT_MS = 90_000;

export type GenerateImageInput = {
  prompt: string;
  negativePrompt: string;
  /** 같은 캐릭터의 모든 컷이 공유하는 시드. */
  seed: number;
  /** 캔버스 비율. 생성 크기를 여기에 맞춰야 조판에서 크게 잘리지 않는다. */
  ratio: string;
  /** 캐릭터 시트 이미지 URL. 있으면 image-to-image 경로를 탄다. */
  referenceUrl?: string | null;
};

export type GeneratedImage = {
  /** 생성된 이미지 URL. 제공사가 임시로 호스팅하므로 바로 받아 와야 한다. */
  url: string;
  width: number;
  height: number;
  /** 제공사가 실제로 쓴 시드. 요청값과 다를 수 있어 그대로 기록한다. */
  seed: number;
  provenance: ProvenanceRecord;
};

export class ImageGenerationError extends Error {
  constructor(
    message: string,
    readonly stage: 'config' | 'request' | 'response',
  ) {
    super(message);
    this.name = 'ImageGenerationError';
  }
}

/**
 * 생성 이미지를 쓸 수 있는 상태인지.
 *
 * @returns fal 키가 설정돼 있으면 true.
 */
export function isImageGenerationConfigured(): boolean {
  return Boolean(Env.FAL_KEY);
}

/**
 * 비율 → 생성 크기.
 *
 * 제공사가 임의 크기를 받긴 하지만, 학습 해상도에서 멀어질수록 인물이 무너진다.
 * 1024 언저리 값으로 고정하고, 최종 크기는 조판이 맞춘다.
 *
 * @param ratio - 캔버스 비율.
 * @returns 생성 요청에 넣을 픽셀 크기.
 */
export function generationSize(ratio: string): { width: number; height: number } {
  switch (ratio) {
    case '1:1': {
      return { width: 1024, height: 1024 };
    }
    case '9:16': {
      return { width: 768, height: 1344 };
    }
    case '16:9': {
      return { width: 1344, height: 768 };
    }
    case '3:4': {
      return { width: 896, height: 1152 };
    }
    default: {
      // 4:5. 인스타 캐러셀의 기본이자 이 제품의 기본값.
      return { width: 896, height: 1120 };
    }
  }
}

/**
 * 생성 이미지의 출처 기록.
 *
 * 저작자가 없다는 것 자체가 기록해야 할 사실이다. 스톡 사진과 같은 컬럼에
 * 저장되므로, "표기 의무 없음"을 비워 두는 대신 명시해야 발행 파이프라인이
 * 판단할 수 있다.
 *
 * @param seed - 실제로 쓰인 시드. 같은 그림을 다시 만들 수 있게 남긴다.
 * @param model - 쓴 모델 id.
 * @returns 출처 레코드.
 */
function generatedProvenance(seed: number, model: string): ProvenanceRecord {
  return {
    source: 'fal_flux',
    sourceId: `${model}:${seed}`,
    sourceUrl: null,
    authorName: null,
    authorUrl: null,
    license: 'generated',
    attributionRequired: false,
    commercialSafe: true,
  };
}

/**
 * 응답에서 첫 이미지를 읽는다.
 *
 * 제공사 응답을 통째로 신뢰하지 않는다. 필드가 하나라도 없으면 조용히
 * undefined가 흘러가 빈 카드가 되는데, 그때는 원인을 찾기 어렵다.
 *
 * @param payload - 파싱된 응답 본문.
 * @param fallbackSeed - 응답에 시드가 없을 때 쓸 요청값.
 * @param model - 쓴 모델 id.
 * @returns 생성 이미지.
 * @throws ImageGenerationError when the response carries no usable image.
 */
function readFirstImage(payload: unknown, fallbackSeed: number, model: string): GeneratedImage {
  if (typeof payload !== 'object' || payload === null) {
    throw new ImageGenerationError('생성 응답이 객체가 아닙니다', 'response');
  }

  const body = payload as { images?: unknown; seed?: unknown };
  const first = Array.isArray(body.images) ? body.images[0] : null;

  if (typeof first !== 'object' || first === null) {
    throw new ImageGenerationError('생성 응답에 이미지가 없습니다', 'response');
  }

  const image = first as { url?: unknown; width?: unknown; height?: unknown };

  if (typeof image.url !== 'string' || image.url === '') {
    throw new ImageGenerationError('생성 응답에 이미지 URL이 없습니다', 'response');
  }

  const seed = typeof body.seed === 'number' ? body.seed : fallbackSeed;

  return {
    url: image.url,
    width: typeof image.width === 'number' ? image.width : 0,
    height: typeof image.height === 'number' ? image.height : 0,
    seed,
    provenance: generatedProvenance(seed, model),
  };
}

/**
 * 컷 그림 한 장을 생성한다.
 *
 * @param input - 프롬프트, 네거티브, 시드, 비율, 참고 이미지.
 * @returns 생성된 이미지의 URL과 출처.
 * @throws ImageGenerationError when the key is missing or the provider refuses.
 */
export async function generateImage(input: GenerateImageInput): Promise<GeneratedImage> {
  const key = Env.FAL_KEY;

  if (!key) {
    throw new ImageGenerationError('FAL_KEY가 설정되지 않았습니다', 'config');
  }

  const size = generationSize(input.ratio);
  const useReference = Boolean(input.referenceUrl);
  const model = useReference ? MODELS.reference : MODELS.text;

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, GENERATE_TIMEOUT_MS);

  try {
    const response = await fetch(`${FAL_ENDPOINT}/${model}`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: input.prompt,
        negative_prompt: input.negativePrompt,
        seed: input.seed,
        num_images: 1,
        // 안전 검사기를 끄지 않는다. 인스타툰은 갈등을 다루므로 경계에 가까운
        // 장면이 나올 수 있고, 그 결과가 발행되는 계정은 사용자의 것이다.
        enable_safety_checker: true,
        ...(useReference
          ? { image_url: input.referenceUrl, strength: REFERENCE_STRENGTH }
          : { image_size: { width: size.width, height: size.height } }),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      // 본문을 그대로 올리지 않는다. 제공사 오류에 요청 프롬프트가 통째로
      // 담겨 오는 경우가 있고, 그건 로그에 남길 이유가 없다.
      throw new ImageGenerationError(`이미지 생성 ${response.status}`, 'request');
    }

    return readFirstImage(await response.json(), input.seed, model);
  } finally {
    clearTimeout(timer);
  }
}
