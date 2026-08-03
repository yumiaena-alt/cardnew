import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * 슬라이드 이미지 → 릴스 영상.
 *
 * 왜 생성형 영상 API가 아니라 ffmpeg인가: 이 제품의 릴스는 **우리가 만든 카드**가
 * 움직이는 것이다. 생성 API는 우리 카드와 무관한 영상을 만들어 내므로 팬아웃
 * (소재 1개 → 채널별 변형)이라는 축 자체가 성립하지 않는다. 게다가 이미 렌더된
 * PNG를 재사용하므로 추가 원가가 0이고, 초당 과금처럼 예측 불가능한 비용이 없다.
 *
 * 브라우저 풀을 쓰지 않는다. 이어붙일 그림은 이미 렌더돼 스토리지에 있다.
 */

/** 한 장이 화면에 머무는 기본 시간. 카드뉴스는 읽는 콘텐츠라 짧으면 못 읽는다. */
const DEFAULT_SECONDS_PER_SLIDE = 2.5;

const MAX_SLIDES = 20;
const FFMPEG_TIMEOUT_MS = 180_000;
const FRAME_RATE = 30;

export type VideoRequest = {
  /** 이어붙일 이미지. 순서가 곧 재생 순서다. */
  images: Buffer[];
  secondsPerSlide: number;
};

export type VideoResult = {
  buffer: Buffer;
  bytes: number;
  durationSeconds: number;
  durationMs: number;
};

/**
 * ffmpeg 실행 파일 이름. 경로가 다른 호스트를 위해 환경변수로 덮을 수 있다.
 */
const FFMPEG_BIN = process.env.FFMPEG_PATH ?? 'ffmpeg';

/**
 * ffmpeg를 한 번 돌린다.
 *
 * stdout으로 영상을 받지 않고 파일로 쓴다. mp4는 moov atom을 마지막에 쓰기 때문에
 * 파이프로는 seekable 출력을 만들 수 없다.
 */
async function runFfmpeg(args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(FFMPEG_BIN, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('ffmpeg 시간 초과'));
    }, FFMPEG_TIMEOUT_MS);

    child.stderr.on('data', (chunk: Buffer) => {
      // 마지막 몇 줄만 남긴다. 실패 원인은 항상 끝에 있고, 전체는 수십 KB다.
      stderr = `${stderr}${chunk.toString('utf-8')}`.slice(-2000);
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      reject(new Error(`ffmpeg를 실행하지 못했습니다: ${error.message}`));
    });

    child.on('close', (code) => {
      clearTimeout(timer);

      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`ffmpeg가 ${code}로 종료했습니다: ${stderr}`));
    });
  });
}

/**
 * 슬라이드 목록을 concat 데모서 파일로 적는다.
 *
 * 마지막 항목을 한 번 더 적는 것은 데모서 형식의 요구다. 마지막 duration은
 * 무시되기 때문에, 그대로 두면 끝 장면이 한 프레임만 보이고 끝난다.
 */
async function writeConcatList(dir: string, files: string[], seconds: number): Promise<string> {
  const lines = files.flatMap((file) => [`file '${file}'`, `duration ${seconds}`]);
  const last = files.at(-1);

  if (last) {
    lines.push(`file '${last}'`);
  }

  const path = join(dir, 'slides.txt');
  await writeFile(path, lines.join('\n'), 'utf-8');

  return path;
}

/**
 * 이미지들을 mp4로 이어붙인다.
 *
 * @param request - 이미지, 장당 시간, 페이드 길이.
 * @returns 영상 바이트와 길이.
 * @throws Error 이미지가 없거나 ffmpeg가 실패한 경우.
 */
export async function renderVideo(request: VideoRequest): Promise<VideoResult> {
  if (request.images.length === 0) {
    throw new Error('이어붙일 이미지가 없습니다');
  }

  if (request.images.length > MAX_SLIDES) {
    throw new Error(`슬라이드가 너무 많습니다 (최대 ${MAX_SLIDES}장)`);
  }

  const startedAt = Date.now();
  const dir = await mkdtemp(join(tmpdir(), 'panelo-video-'));

  try {
    const files: string[] = [];

    for (const [index, image] of request.images.entries()) {
      const path = join(dir, `${String(index).padStart(3, '0')}.png`);
      await writeFile(path, image);
      files.push(path);
    }

    const listPath = await writeConcatList(dir, files, request.secondsPerSlide);
    const outputPath = join(dir, 'reel.mp4');

    await runFfmpeg([
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      listPath,
      // 짝수 해상도로 맞춘다. yuv420p + H.264는 홀수 폭·높이를 거부한다.
      '-vf',
      `fps=${FRAME_RATE},scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p`,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '23',
      // 어디서든 첫 프레임부터 재생되도록 moov atom을 앞으로 옮긴다.
      '-movflags',
      '+faststart',
      outputPath,
    ]);

    const buffer = await readFile(outputPath);

    return {
      buffer,
      bytes: buffer.byteLength,
      durationSeconds: request.images.length * request.secondsPerSlide,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * ffmpeg가 이 호스트에 있는지 확인한다.
 *
 * 헬스체크에 실어 보낸다. 없는 채로 배포되면 영상 요청마다 500이 나는데,
 * 그때 원인을 찾는 것보다 배포 직후에 아는 편이 낫다.
 *
 * @returns 실행 가능하면 true.
 */
export async function isFfmpegAvailable(): Promise<boolean> {
  return await new Promise<boolean>((resolve) => {
    const child = spawn(FFMPEG_BIN, ['-version'], { stdio: 'ignore' });

    child.on('error', () => {
      resolve(false);
    });
    child.on('close', (code) => {
      resolve(code === 0);
    });
  });
}

/**
 * 장면 전환(크로스페이드)은 아직 넣지 않았다. concat 데모서로는 표현할 수 없고
 * xfade 필터는 입력 수만큼 필터 체인을 만들어야 해서, 첫 판에서 감수할 복잡도가
 * 아니다. 컷 전환만으로도 카드뉴스 릴스는 성립한다.
 */
export const VIDEO_DEFAULTS = {
  secondsPerSlide: DEFAULT_SECONDS_PER_SLIDE,
  maxSlides: MAX_SLIDES,
};
