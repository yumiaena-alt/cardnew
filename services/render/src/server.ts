import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { safeParseSlideDoc } from '../../../src/lib/slidedoc/doc';
import { BrowserPool } from './browser-pool';
import { CONTENT_TYPES, renderSlide } from './render';
import type { RenderFormat, RenderRequest } from './render';
import { isFfmpegAvailable, renderVideo, VIDEO_DEFAULTS } from './video';

/**
 * 렌더 서비스 HTTP 엔드포인트.
 *
 * 왜 별도 서비스인가: Next.js 서버리스 함수에는 Chromium을 띄울 수 없고,
 * 장시간 실행에도 부적합하다. 렌더만 떼어 상주 컨테이너(Fly.io)에 둔다.
 *
 * 의존성을 최소화하려고 Node 기본 http를 쓴다. 엔드포인트가 4개뿐이라
 * 프레임워크를 얹을 이유가 없다.
 */

const PORT = Number(process.env.PORT ?? 4000);
const AUTH_TOKEN = process.env.RENDER_SERVICE_TOKEN ?? '';
const MAX_BODY_BYTES = 8 * 1024 * 1024; // SlideDoc + data URI 이미지 여유분
// 영상은 렌더된 카드 여러 장을 base64로 받는다. 장당 1MB에 base64 33% 증가를 얹고
// 최대 20장을 감당할 만큼 넉넉히 잡는다.
const MAX_VIDEO_BODY_BYTES = 48 * 1024 * 1024;

const pool = new BrowserPool({
  size: Number(process.env.RENDER_POOL_SIZE ?? 2),
});

async function readJsonBody(req: IncomingMessage, maxBytes = MAX_BODY_BYTES): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of req) {
    const buf = chunk as Buffer;
    total += buf.byteLength;
    if (total > maxBytes) {
      throw new HttpError(413, `요청 본문이 너무 큽니다 (최대 ${maxBytes} bytes)`);
    }
    chunks.push(buf);
  }

  if (chunks.length === 0) {
    throw new HttpError(400, '본문이 비어 있습니다');
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf-8'));
  } catch {
    throw new HttpError(400, 'JSON 파싱에 실패했습니다');
  }
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

const VALID_FORMATS = new Set<RenderFormat>(['png', 'jpeg', 'webp']);

/** 요청 본문 → RenderRequest. 검증 실패는 400으로 떨어뜨린다. */
function parseRenderRequest(body: unknown): RenderRequest {
  if (typeof body !== 'object' || body === null) {
    throw new HttpError(400, '객체 본문이 필요합니다');
  }
  const raw = body as Record<string, unknown>;

  const docResult = safeParseSlideDoc(raw.doc);
  if (!docResult.success) {
    throw new HttpError(
      400,
      `SlideDoc 검증 실패: ${docResult.error.issues[0]?.message ?? '알 수 없음'}`,
    );
  }

  const format = raw.format === undefined ? 'png' : (raw.format as RenderFormat);
  if (!VALID_FORMATS.has(format)) {
    throw new HttpError(400, `지원하지 않는 포맷입니다: ${String(raw.format)}`);
  }

  const scale = raw.scale === undefined ? 1 : Number(raw.scale);
  if (!Number.isFinite(scale) || scale <= 0 || scale > 4) {
    throw new HttpError(400, 'scale은 0보다 크고 4 이하여야 합니다');
  }

  const quality = raw.quality === undefined ? undefined : Number(raw.quality);
  if (quality !== undefined && (!Number.isFinite(quality) || quality < 1 || quality > 100)) {
    throw new HttpError(400, 'quality는 1~100이어야 합니다');
  }

  return {
    doc: docResult.data,
    format,
    scale,
    ...(quality !== undefined ? { quality } : {}),
    ...(raw.fittedSizes ? { fittedSizes: raw.fittedSizes as Record<string, number> } : {}),
    watermark: Boolean(raw.watermark),
    ...(typeof raw.fontBaseUrl === 'string' ? { fontBaseUrl: raw.fontBaseUrl } : {}),
  };
}

/** 영상 요청 본문 → 이미지 버퍼와 장당 시간. 검증 실패는 400으로 떨어뜨린다. */
function parseVideoRequest(body: unknown): { images: Buffer[]; secondsPerSlide: number } {
  if (typeof body !== 'object' || body === null) {
    throw new HttpError(400, '객체 본문이 필요합니다');
  }
  const raw = body as Record<string, unknown>;

  if (!Array.isArray(raw.images)) {
    throw new HttpError(400, 'images 배열이 필요합니다');
  }

  const images = raw.images.map((entry, index) => {
    if (typeof entry !== 'string') {
      throw new HttpError(400, `images[${index}]는 base64 문자열이어야 합니다`);
    }
    return Buffer.from(entry, 'base64');
  });

  if (images.length === 0) {
    throw new HttpError(400, '이어붙일 이미지가 없습니다');
  }
  if (images.length > VIDEO_DEFAULTS.maxSlides) {
    throw new HttpError(400, `슬라이드가 너무 많습니다 (최대 ${VIDEO_DEFAULTS.maxSlides}장)`);
  }

  const secondsPerSlide =
    raw.secondsPerSlide === undefined
      ? VIDEO_DEFAULTS.secondsPerSlide
      : Number(raw.secondsPerSlide);

  if (!Number.isFinite(secondsPerSlide) || secondsPerSlide < 0.5 || secondsPerSlide > 15) {
    throw new HttpError(400, 'secondsPerSlide는 0.5~15여야 합니다');
  }

  return { images, secondsPerSlide };
}

function checkAuth(req: IncomingMessage): void {
  // 토큰이 설정되지 않은 로컬 개발에서는 검사를 건너뛴다.
  // 프로덕션에서는 반드시 RENDER_SERVICE_TOKEN을 설정해야 한다.
  if (!AUTH_TOKEN) {
    return;
  }
  const header = req.headers.authorization ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (provided !== AUTH_TOKEN) {
    throw new HttpError(401, '인증 실패');
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  try {
    // 헬스체크: 배포 플랫폼이 컨테이너 준비 여부를 판단한다.
    // ffmpeg 유무를 함께 알린다 — 없는 채로 배포되면 영상 요청마다 500이 나는데,
    // 그때 원인을 찾는 것보다 배포 직후에 아는 편이 낫다.
    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, {
        ok: true,
        browserRunning: pool.isRunning,
        ffmpeg: await isFfmpegAvailable(),
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/render') {
      checkAuth(req);
      const request = parseRenderRequest(await readJsonBody(req));
      const result = await renderSlide(pool, request);

      res.writeHead(200, {
        'content-type': CONTENT_TYPES[result.format],
        'content-length': result.bytes,
        'x-doc-hash': result.docHash,
        'x-render-ms': String(result.durationMs),
        'x-dimensions': `${result.width}x${result.height}`,
        // 조판 경고를 헤더로 넘긴다. 호출부가 카피 축약이나 품질 플래그를 판단한다.
        ...(result.overflows.length > 0
          ? { 'x-overflows': result.overflows.map((o) => o.layerId).join(',') }
          : {}),
        ...(result.collisions.length > 0
          ? { 'x-collisions': result.collisions.map((c) => `${c.a}~${c.b}`).join(',') }
          : {}),
      });
      res.end(result.buffer);
      return;
    }

    // 메타데이터만 필요한 경우(조판 검증·품질 검사)에 이미지 없이 응답한다.
    if (req.method === 'POST' && url.pathname === '/inspect') {
      checkAuth(req);
      const request = parseRenderRequest(await readJsonBody(req));
      const { typesetSlide } = await import('../../../src/lib/renderer/typeset');
      const typeset = typesetSlide(request.doc);
      sendJson(res, 200, {
        fittedSizes: typeset.fittedSizes,
        overflows: typeset.overflows,
        collisions: typeset.collisions,
      });
      return;
    }

    // 이미 렌더된 카드들을 이어붙여 릴스 영상으로 만든다. 브라우저를 쓰지 않는다.
    if (req.method === 'POST' && url.pathname === '/video') {
      checkAuth(req);
      const request = parseVideoRequest(await readJsonBody(req, MAX_VIDEO_BODY_BYTES));
      const result = await renderVideo(request);

      res.writeHead(200, {
        'content-type': 'video/mp4',
        'content-length': result.bytes,
        'x-render-ms': String(result.durationMs),
        'x-duration-seconds': String(result.durationSeconds),
      });
      res.end(result.buffer);
      return;
    }

    sendJson(res, 404, { error: '없는 엔드포인트입니다' });
  } catch (error) {
    if (error instanceof HttpError) {
      sendJson(res, error.status, { error: error.message });
      return;
    }
    console.error('렌더 요청 처리 실패:', error);
    sendJson(res, 500, { error: '내부 오류' });
  }
});

async function shutdown(signal: string): Promise<void> {
  console.log(`${signal} 수신 — 종료합니다`);
  server.close();
  await pool.stop();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

// 첫 요청이 콜드 스타트를 물지 않도록 미리 브라우저를 띄운다.
pool
  .start()
  .then(() => {
    console.log('브라우저 풀 준비 완료');
  })
  .catch((error) => {
    console.error('브라우저 풀 시작 실패:', error);
  });

server.listen(PORT, () => {
  console.log(`렌더 서비스 실행 중: http://localhost:${PORT}`);
  console.log(`  POST /render   SlideDoc → 이미지`);
  console.log(`  POST /inspect  조판 검증 (이미지 없음)`);
  console.log(`  POST /video    카드 이미지 → mp4`);
  console.log(`  GET  /health   헬스체크`);
});
