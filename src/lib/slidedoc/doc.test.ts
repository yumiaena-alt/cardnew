import { describe, expect, test } from 'vitest';
import {
  createEmptySlideDoc,
  docCanvasSize,
  findLayer,
  parseSlideDoc,
  safeParseSlideDoc,
  SLIDEDOC_VERSION,
  summarizeForLLM,
} from './doc';
import { textLayerSchema } from './layers';

describe('SlideDoc 파싱', () => {
  test('빈 문서는 기본값이 채워진다', () => {
    const doc = createEmptySlideDoc('4:5');
    expect(doc).toMatchObject({
      v: SLIDEDOC_VERSION,
      canvas: { base: 1080 },
      layers: [],
      meta: { templateId: 'blank', contrastChecked: false },
    });
    expect(doc.safeArea.top).toBeGreaterThan(0);
  });

  test('알 수 없는 버전은 거부한다', () => {
    const result = safeParseSlideDoc({ v: 99, canvas: { ratio: '1:1' } });
    expect(result.success).toBeFalsy();
  });

  test('지원하지 않는 비율은 거부한다', () => {
    const result = safeParseSlideDoc({ v: SLIDEDOC_VERSION, canvas: { ratio: '21:9' } });
    expect(result.success).toBeFalsy();
  });

  test('레이어 type이 없으면 거부한다', () => {
    const result = safeParseSlideDoc({
      v: SLIDEDOC_VERSION,
      canvas: { ratio: '1:1' },
      layers: [{ id: 'a', role: 'headline' }],
    });
    expect(result.success).toBeFalsy();
  });

  test('최소 입력으로 텍스트 레이어가 채워진다', () => {
    const doc = parseSlideDoc({
      v: SLIDEDOC_VERSION,
      canvas: { ratio: '1:1' },
      layers: [{ id: 'h', type: 'text', role: 'headline', text: '안녕하세요' }],
    });
    const layer = findLayer(doc, 'h');
    expect(layer).toMatchObject({
      type: 'text',
      style: { family: 'Pretendard', autoFit: { enabled: true } },
      layout: { anchor: 'top-left' },
    });
  });
});

describe(docCanvasSize, () => {
  test('문서 비율에 맞는 픽셀 크기를 반환한다', () => {
    expect(docCanvasSize(createEmptySlideDoc('9:16'))).toStrictEqual({ width: 1080, height: 1920 });
    expect(docCanvasSize(createEmptySlideDoc('16:9'))).toStrictEqual({ width: 1920, height: 1080 });
  });
});

describe(summarizeForLLM, () => {
  test('편집 판단에 필요한 필드만 노출한다', () => {
    const doc = parseSlideDoc({
      v: SLIDEDOC_VERSION,
      canvas: { ratio: '4:5' },
      role: 'cover',
      layers: [
        {
          id: 'bg',
          type: 'image',
          role: 'background',
          src: 'https://example.com/a.jpg',
          overlay: {
            type: 'linear',
            angle: 180,
            stops: [
              { at: 0, color: '#00000000' },
              { at: 1, color: '#000000AA' },
            ],
          },
        },
        { id: 'h', type: 'text', role: 'headline', text: '가을 신메뉴' },
      ],
    });

    const summary = summarizeForLLM(doc);
    expect(summary).toMatchObject({ ratio: '4:5', role: 'cover' });
    expect(summary.layers).toHaveLength(2);

    // src처럼 긴 값은 프롬프트에서 제외해야 토큰이 절약된다
    expect(summary.layers[0]).toMatchObject({ hasOverlay: true });
    expect(summary.layers[0]).not.toHaveProperty('src');
    expect(summary.layers[1]).toMatchObject({
      text: '가을 신메뉴',
      fontSize: expect.any(Number),
    });
  });
});

describe('텍스트 레이어 스키마', () => {
  test('허용되지 않는 폰트 웨이트는 거부한다', () => {
    const result = textLayerSchema.safeParse({
      id: 'h',
      type: 'text',
      role: 'headline',
      style: { weight: 650 },
    });
    expect(result.success).toBeFalsy();
  });

  test('100~900의 100단위 웨이트는 통과한다', () => {
    for (const weight of [100, 400, 700, 900]) {
      const result = textLayerSchema.safeParse({
        id: 'h',
        type: 'text',
        role: 'headline',
        style: { weight },
      });
      expect(result.success).toBeTruthy();
    }
  });
});
