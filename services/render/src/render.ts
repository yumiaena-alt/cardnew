import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { typesetSlide } from '../../../src/lib/renderer/typeset';
import { docCanvasSize } from '../../../src/lib/slidedoc/doc';
import type { SlideDoc } from '../../../src/lib/slidedoc/doc';
import type { BrowserPool } from './browser-pool';
import { buildSlideHtml, SLIDE_ROOT_ID } from './html';

/**
 * SlideDoc → 이미지 렌더.
 *
 * 파이프라인: SlideRenderer SSR → Playwright 스크린샷 → sharp 포맷 변환.
 *
 * 포맷 판단: Instagram은 JPEG를 요구하므로 발행용은 JPEG,
 * 편집 썸네일은 파일이 작은 WebP, 다운로드는 사용자가 고른 포맷을 쓴다.
 */

export type RenderFormat = 'png' | 'jpeg' | 'webp';

export type RenderRequest = {
  doc: SlideDoc;
  format?: RenderFormat;
  /** 렌더 배수. 1 = 논리 크기(1080 기준) */
  scale?: number;
  quality?: number;
  fittedSizes?: Record<string, number>;
  watermark?: boolean;
  fontBaseUrl?: string;
};

export type RenderResult = {
  buffer: Buffer;
  format: RenderFormat;
  width: number;
  height: number;
  bytes: number;
  /** 렌더 캐시 키. 같은 해시면 재렌더를 건너뛴다. */
  docHash: string;
  durationMs: number;
  /** 최소 크기로도 안 들어간 텍스트 레이어. 비어 있지 않으면 카피 축약이 필요하다. */
  overflows: { layerId: string; role: string; text: string }[];
  /** 서로 겹친 텍스트 레이어 쌍. 품질 회귀 검사 신호. */
  collisions: { a: string; b: string; overlapRatio: number }[];
};

/** 렌더러 동작이 바뀌면 올린다. 캐시 무효화 신호. */
export const RENDERER_VERSION = 1;

/**
 * 렌더 캐시 키.
 *
 * Playwright 렌더가 인프라 비용의 대부분이므로 이 해시가 비용 절감의 핵심이다.
 * 결과 픽셀에 영향을 주는 모든 입력을 포함해야 한다 — 하나라도 빠지면
 * 바뀐 문서에 옛 이미지가 나가는 버그가 된다.
 */
export function computeDocHash(req: RenderRequest): string {
  const material = JSON.stringify({
    v: RENDERER_VERSION,
    doc: req.doc,
    format: req.format ?? 'png',
    scale: req.scale ?? 1,
    quality: req.quality ?? null,
    fittedSizes: req.fittedSizes ?? null,
    watermark: req.watermark ?? false,
    fontBaseUrl: req.fontBaseUrl ?? null,
  });
  return createHash('sha256').update(material).digest('hex').slice(0, 32);
}

const DEFAULT_QUALITY: Record<RenderFormat, number> = {
  png: 100,
  jpeg: 92,
  webp: 88,
};

export async function renderSlide(pool: BrowserPool, req: RenderRequest): Promise<RenderResult> {
  const startedAt = process.hrtime.bigint();

  const format = req.format ?? 'png';
  const scale = req.scale ?? 1;
  const logical = docCanvasSize(req.doc);
  const width = Math.round(logical.width * scale);
  const height = Math.round(logical.height * scale);

  // 조판: 호출부가 확정 크기를 주지 않았고 문서가 아직 조판되지 않았다면 여기서 맞춘다.
  // 이게 없으면 텍스트가 선언된 크기 그대로 렌더되어 캔버스를 넘친다.
  const typeset =
    req.fittedSizes === undefined && !req.doc.meta.fitted ? typesetSlide(req.doc) : null;
  const fittedSizes = req.fittedSizes ?? typeset?.fittedSizes;

  const html = buildSlideHtml({
    doc: req.doc,
    scale,
    ...(fittedSizes ? { fittedSizes } : {}),
    watermark: req.watermark ?? false,
    ...(req.fontBaseUrl ? { fontBaseUrl: req.fontBaseUrl } : {}),
  });

  const raw = await pool.withContext(async (context) => {
    const page = await context.newPage();
    try {
      await page.setViewportSize({ width, height });
      await page.setContent(html, { waitUntil: 'load' });

      // 폰트가 로드되기 전에 찍으면 폴백 폰트로 렌더되어 자간이 어긋난다.
      await page.evaluate(async () => document.fonts.ready);

      // 이미지가 다 그려질 때까지 기다린다. 하나라도 빠지면 빈칸이 남는다.
      await page.evaluate(async () => {
        const images = [...document.images];
        await Promise.all(
          images.map(async (img) =>
            img.complete
              ? Promise.resolve()
              : new Promise<void>((resolve) => {
                  // 실패한 이미지도 무한 대기하지 않도록 error에서도 resolve한다.
                  img.addEventListener(
                    'load',
                    () => {
                      resolve();
                    },
                    { once: true },
                  );
                  img.addEventListener(
                    'error',
                    () => {
                      resolve();
                    },
                    { once: true },
                  );
                }),
          ),
        );
      });

      const element = page.locator(`#${SLIDE_ROOT_ID}`);
      return await element.screenshot({ type: 'png' });
    } finally {
      await page.close().catch(() => {});
    }
  });

  const quality = req.quality ?? DEFAULT_QUALITY[format];
  const buffer = await convert(raw, format, quality);
  const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

  return {
    buffer,
    format,
    width,
    height,
    bytes: buffer.byteLength,
    docHash: computeDocHash(req),
    durationMs: Math.round(durationMs),
    overflows: typeset?.overflows ?? [],
    collisions: typeset?.collisions ?? [],
  };
}

async function convert(png: Buffer, format: RenderFormat, quality: number): Promise<Buffer> {
  if (format === 'png') {
    // compressionLevel 9는 CPU를 많이 쓰므로 6으로 균형을 잡는다.
    return await sharp(png).png({ compressionLevel: 6 }).toBuffer();
  }
  if (format === 'jpeg') {
    // Instagram이 요구하는 포맷. 투명 배경은 흰색으로 눕힌다.
    return await sharp(png)
      .flatten({ background: '#FFFFFF' })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
  }
  return await sharp(png).webp({ quality }).toBuffer();
}

export const CONTENT_TYPES: Record<RenderFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};
