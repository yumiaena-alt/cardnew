import sharp from 'sharp';
import { describe, expect, test } from 'vitest';
import type { SlidePlan } from '@/lib/plan/schema';
import { analyzeLuma, bandForRegion, bestTextRegion } from './analyze';
import type { ImageCandidate } from './providers/types';
import { moodMatch, rerank } from './source';

/** 단색 이미지 생성 */
async function solid(hex: string, width = 300, height = 600): Promise<Buffer> {
  return await sharp({
    create: { width, height, channels: 3, background: hex },
  })
    .png()
    .toBuffer();
}

/** 위/아래가 다른 이미지 생성 — 밴드별 측정이 실제로 다른지 확인하는 용도 */
async function halfAndHalf(topHex: string, bottomHex: string): Promise<Buffer> {
  const width = 300;
  const half = 300;
  const top = await sharp({ create: { width, height: half, channels: 3, background: topHex } })
    .png()
    .toBuffer();
  const bottom = await sharp({
    create: { width, height: half, channels: 3, background: bottomHex },
  })
    .png()
    .toBuffer();

  return await sharp({ create: { width, height: half * 2, channels: 3, background: '#000000' } })
    .composite([
      { input: top, top: 0, left: 0 },
      { input: bottom, top: half, left: 0 },
    ])
    .png()
    .toBuffer();
}

describe('analyzeLuma — 기본', () => {
  test('검정 이미지는 휘도 0에 가깝다', async () => {
    const analysis = await analyzeLuma(await solid('#000000'));
    expect(analysis.overall.meanLuma).toBeLessThan(0.02);
  });

  test('흰 이미지는 휘도 1에 가깝다', async () => {
    const analysis = await analyzeLuma(await solid('#FFFFFF'));
    expect(analysis.overall.meanLuma).toBeGreaterThan(0.95);
  });

  test('단색 이미지의 표준편차는 0에 가깝다', async () => {
    const analysis = await analyzeLuma(await solid('#808080'));
    expect(analysis.overall.stdDev).toBeLessThan(0.02);
  });

  test('원본 크기를 보존해 보고한다', async () => {
    const analysis = await analyzeLuma(await solid('#808080', 1080, 1350));
    expect(analysis.width).toBe(1080);
    expect(analysis.height).toBe(1350);
  });

  test('모든 휘도값이 0~1 범위다', async () => {
    for (const hex of ['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#7F7F7F']) {
      const analysis = await analyzeLuma(await solid(hex));
      for (const band of [analysis.top, analysis.middle, analysis.bottom, analysis.overall]) {
        expect(band.meanLuma).toBeGreaterThanOrEqual(0);
        expect(band.meanLuma).toBeLessThanOrEqual(1);
        expect(band.stdDev).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('★ analyzeLuma — 밴드별 측정 (전체 평균으로는 못 잡는 케이스)', () => {
  test('위가 밝고 아래가 어두우면 밴드가 다르게 측정된다', async () => {
    const analysis = await analyzeLuma(await halfAndHalf('#FFFFFF', '#000000'));

    expect(analysis.top.meanLuma).toBeGreaterThan(0.9);
    expect(analysis.bottom.meanLuma).toBeLessThan(0.1);
    // 전체 평균은 중간값이라 판단에 쓸 수 없다 — 이게 밴드 분할의 이유다
    expect(analysis.overall.meanLuma).toBeGreaterThan(0.2);
    expect(analysis.overall.meanLuma).toBeLessThan(0.8);
  });

  test('경계가 있는 이미지는 전체 표준편차가 크다', async () => {
    const split = await analyzeLuma(await halfAndHalf('#FFFFFF', '#000000'));
    const flat = await analyzeLuma(await solid('#808080'));
    expect(split.overall.stdDev).toBeGreaterThan(flat.overall.stdDev);
  });

  test('bandForRegion이 올바른 밴드를 돌려준다', async () => {
    const analysis = await analyzeLuma(await halfAndHalf('#FFFFFF', '#000000'));
    expect(bandForRegion(analysis, 'top')).toStrictEqual(analysis.top);
    expect(bandForRegion(analysis, 'bottom')).toStrictEqual(analysis.bottom);
    expect(bandForRegion(analysis, 'full')).toStrictEqual(analysis.overall);
  });
});

describe(bestTextRegion, () => {
  test('극단 휘도 영역을 고른다', async () => {
    // 위는 중간회색(애매), 아래는 검정(명확) → 아래를 골라야 한다
    const analysis = await analyzeLuma(await halfAndHalf('#808080', '#000000'));
    expect(bestTextRegion(analysis)).toBe('bottom');
  });

  test('항상 유효한 영역을 반환한다', async () => {
    for (const hex of ['#000000', '#FFFFFF', '#808080']) {
      const region = bestTextRegion(await analyzeLuma(await solid(hex)));
      expect(['top', 'middle', 'bottom']).toContain(region);
    }
  });
});

describe(moodMatch, () => {
  test('어두운 색은 dark 무드와 잘 맞는다', () => {
    expect(moodMatch('#101010', 'dark')).toBeGreaterThan(0.9);
    expect(moodMatch('#F0F0F0', 'dark')).toBeLessThan(0.1);
  });

  test('밝은 색은 bright 무드와 잘 맞는다', () => {
    expect(moodMatch('#F0F0F0', 'bright')).toBeGreaterThan(0.9);
  });

  test('붉은 색은 warm이 cool보다 높다', () => {
    expect(moodMatch('#D06030', 'warm')).toBeGreaterThan(moodMatch('#D06030', 'cool'));
  });

  test('푸른 색은 cool이 warm보다 높다', () => {
    expect(moodMatch('#3060D0', 'cool')).toBeGreaterThan(moodMatch('#3060D0', 'warm'));
  });

  test('잘못된 hex는 중립값을 반환한다', () => {
    expect(moodMatch('#FFF', 'warm')).toBe(0.5);
    expect(moodMatch('bad', 'dark')).toBe(0.5);
  });

  test('모든 무드에서 0~1을 반환한다', () => {
    const moods = ['warm', 'cool', 'neutral', 'dark', 'bright'] as const;
    for (const mood of moods) {
      for (const hex of ['#000000', '#FFFFFF', '#FF0000', '#0000FF', '#808080']) {
        const score = moodMatch(hex, mood);
        expect(score, `${hex}/${mood}`).toBeGreaterThanOrEqual(0);
        expect(score, `${hex}/${mood}`).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe(rerank, () => {
  const plan: SlidePlan = {
    role: 'cover',
    headline: '테스트',
    body: null,
    eyebrow: null,
    imageQuery: 'autumn cafe latte wooden table',
    imageMood: 'warm',
    templateHint: null,
  };

  const candidate = (patch: Partial<ImageCandidate>): ImageCandidate => ({
    url: 'https://example.com/a.jpg',
    sourceUrl: 'https://example.com/a',
    sourceId: 'a',
    width: 1080,
    height: 1350,
    authorName: null,
    authorUrl: null,
    description: null,
    dominantColor: null,
    ...patch,
  });

  test('★ 종횡비가 맞는 후보를 앞으로 올린다', () => {
    const landscape = candidate({ sourceId: 'landscape', width: 1920, height: 1080 });
    const portrait = candidate({ sourceId: 'portrait', width: 1080, height: 1350 });

    const ranked = rerank([landscape, portrait], plan, '4:5');
    expect(ranked[0]!.sourceId).toBe('portrait');
  });

  test('가로 캔버스에는 가로 사진을 올린다', () => {
    const landscape = candidate({ sourceId: 'landscape', width: 1920, height: 1080 });
    const portrait = candidate({ sourceId: 'portrait', width: 1080, height: 1350 });

    const ranked = rerank([portrait, landscape], plan, '16:9');
    expect(ranked[0]!.sourceId).toBe('landscape');
  });

  test('설명이 검색어와 겹치면 점수가 오른다', () => {
    const relevant = candidate({
      sourceId: 'relevant',
      description: 'autumn latte on a wooden table',
    });
    const irrelevant = candidate({ sourceId: 'irrelevant', description: 'city skyline at night' });

    const ranked = rerank([irrelevant, relevant], plan, '4:5');
    expect(ranked[0]!.sourceId).toBe('relevant');
  });

  test('무드에 맞는 지배색을 선호한다', () => {
    const warm = candidate({ sourceId: 'warm', dominantColor: '#C86432' });
    const cool = candidate({ sourceId: 'cool', dominantColor: '#3264C8' });

    const ranked = rerank([cool, warm], plan, '4:5');
    expect(ranked[0]!.sourceId).toBe('warm');
  });

  test('후보 수를 줄이거나 늘리지 않는다', () => {
    const items = [candidate({ sourceId: '1' }), candidate({ sourceId: '2' })];
    expect(rerank(items, plan, '4:5')).toHaveLength(2);
  });

  test('동점이면 원래 순서를 유지한다', () => {
    const a = candidate({ sourceId: 'a' });
    const b = candidate({ sourceId: 'b' });
    expect(rerank([a, b], plan, '4:5')[0]!.sourceId).toBe('a');
  });

  test('빈 배열도 처리한다', () => {
    expect(rerank([], plan, '4:5')).toStrictEqual([]);
  });
});
