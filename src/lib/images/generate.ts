import sharp from 'sharp';
import { canvasSize } from '@/lib/slidedoc/primitives';
import type { AspectRatio } from '@/lib/slidedoc/primitives';
import { analyzeLuma } from './analyze';
import type { LumaAnalysis } from './analyze';
import { generateImage, ImageGenerationError } from './providers/fal';
import type { ProvenanceRecord } from './providers/types';

/**
 * 생성 이미지 조달.
 *
 * `source.ts`가 스톡 검색에 하는 일을 생성에 대해 한다: 받아 오고, 카드 크기로
 * 맞추고, 휘도를 재고, 출처를 남긴다. 두 파일을 하나로 합치지 않는 이유는
 * 앞단이 완전히 다르기 때문이다 — 한쪽은 후보를 골라야 하고 다른 쪽은
 * 시드를 고정해야 한다. 뒷단(전처리·휘도·출처)만 모양이 같다.
 *
 * 실패가 전체 생성을 막지 않는다. 한 컷의 그림이 없어도 대사와 나레이션은
 * 남고, 사용자는 그 컷만 다시 그리면 된다.
 */

/** 다운로드 상한. 생성 이미지는 보통 1~2MB다. */
const DOWNLOAD_TIMEOUT_MS = 30_000;

export type GeneratedPanelImage = {
  buffer: Buffer;
  /** data URI. 렌더 서비스가 다른 호스트에 있어 링크 대신 바이트를 넘긴다. */
  dataUri: string;
  width: number;
  height: number;
  bytes: number;
  analysis: LumaAnalysis;
  provenance: ProvenanceRecord;
  /** 실제로 쓰인 시드. 같은 그림을 다시 만들려면 이 값이 필요하다. */
  seed: number;
};

export type GeneratePanelInput = {
  prompt: string;
  negativePrompt: string;
  seed: number;
  ratio: AspectRatio;
  referenceUrl?: string | null;
};

export type GeneratePanelResult =
  | { ok: true; image: GeneratedPanelImage }
  | { ok: false; reason: string; stage: string };

/**
 * 생성된 이미지를 받아 카드 크기로 맞춘다.
 *
 * 휘도는 전처리 **전** 원본으로 잰다. 리사이즈 후에 재면 실제 렌더될 영역과
 * 어긋난다 — `source.ts`가 같은 이유로 같은 순서를 쓴다.
 *
 * @param url - 제공사가 준 임시 이미지 URL.
 * @param ratio - 캔버스 비율.
 * @returns 전처리된 바이트와 휘도 분석.
 * @throws ImageGenerationError when the download fails.
 */
async function downloadAndProcess(
  url: string,
  ratio: AspectRatio,
): Promise<{ buffer: Buffer; width: number; height: number; analysis: LumaAnalysis }> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, DOWNLOAD_TIMEOUT_MS);

  let raw: ArrayBuffer;

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new ImageGenerationError(`생성 이미지 다운로드 ${response.status}`, 'response');
    }

    raw = await response.arrayBuffer();
  } finally {
    clearTimeout(timer);
  }

  const input = Buffer.from(raw);
  const analysis = await analyzeLuma(input);
  const canvas = canvasSize(ratio);

  /**
   * 'attention' 크롭을 쓰지 않는다.
   *
   * 스톡 사진은 피사체를 찾아 잘라 주는 편이 낫지만, 인스타툰 컷은 이미 그
   * 비율로 그려졌고 여백 위치까지 프롬프트가 지정한 것이다. 흥미로운 쪽을
   * 찾아 자르면 말풍선을 놓으려고 비워 둔 자리가 잘려 나간다.
   */
  const processed = await sharp(input)
    .resize(canvas.width, canvas.height, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: processed.data,
    width: processed.info.width,
    height: processed.info.height,
    analysis,
  };
}

/**
 * 컷 그림 한 장을 생성하고 카드에 쓸 수 있게 만든다.
 *
 * 던지지 않고 결과로 실패를 돌려준다. 호출부가 컷 하나의 실패와 실행 전체의
 * 실패를 구분해야 하는데, 예외로는 그 구분이 호출부까지 오지 않는다.
 *
 * @param input - 프롬프트, 네거티브, 시드, 비율, 참고 이미지.
 * @returns 전처리된 이미지, 또는 실패 사유.
 */
export async function generatePanelImage(input: GeneratePanelInput): Promise<GeneratePanelResult> {
  try {
    const generated = await generateImage({
      prompt: input.prompt,
      negativePrompt: input.negativePrompt,
      seed: input.seed,
      ratio: input.ratio,
      referenceUrl: input.referenceUrl ?? null,
    });

    const processed = await downloadAndProcess(generated.url, input.ratio);

    return {
      ok: true,
      image: {
        buffer: processed.buffer,
        dataUri: `data:image/jpeg;base64,${processed.buffer.toString('base64')}`,
        width: processed.width,
        height: processed.height,
        bytes: processed.buffer.byteLength,
        analysis: processed.analysis,
        provenance: generated.provenance,
        seed: generated.seed,
      },
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : '알 수 없는 오류',
      stage: error instanceof ImageGenerationError ? error.stage : 'process',
    };
  }
}
