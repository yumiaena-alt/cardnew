import { describe, expect, test } from 'vitest';
import { contentBox, fontScale, isWithinSafeArea, resolveRect } from './geometry';
import { layoutBoxSchema, safeAreaSchema, canvasSize } from './primitives';

const box = (patch: Partial<Parameters<typeof layoutBoxSchema.parse>[0]> = {}) =>
  layoutBoxSchema.parse(patch);

describe(canvasSize, () => {
  test('세로 비율은 짧은 변인 폭을 base에 맞춘다', () => {
    expect(canvasSize('4:5', 1080)).toStrictEqual({ width: 1080, height: 1350 });
    expect(canvasSize('9:16', 1080)).toStrictEqual({ width: 1080, height: 1920 });
  });

  test('가로 비율은 짧은 변인 높이를 base에 맞춘다', () => {
    expect(canvasSize('16:9', 1080)).toStrictEqual({ width: 1920, height: 1080 });
  });

  test('정사각형은 폭과 높이가 같다', () => {
    expect(canvasSize('1:1', 1080)).toStrictEqual({ width: 1080, height: 1080 });
  });
});

describe('resolveRect — 앵커별 기준점', () => {
  const canvas = { width: 1000, height: 1000 };

  test('top-left는 오프셋을 그대로 좌상단에 더한다', () => {
    const rect = resolveRect(box({ anchor: 'top-left', x: 0.1, y: 0.2, w: 0.5, h: 0.3 }), canvas);
    expect(rect).toStrictEqual({ left: 100, top: 200, width: 500, height: 300 });
  });

  test('bottom-center는 아래에서 띄우고 가로 중앙 정렬한다', () => {
    const rect = resolveRect(
      box({ anchor: 'bottom-center', x: 0, y: 0.08, w: 0.6, h: 0.1 }),
      canvas,
    );
    // 아래에서 8% 띄움 → 박스 하단이 y=920, 높이 100이므로 top=820
    expect(rect.top).toBe(820);
    // 가로 중앙: (1000 - 600) / 2
    expect(rect.left).toBe(200);
  });

  test('top-right는 우측에서 안쪽으로 자란다', () => {
    const rect = resolveRect(box({ anchor: 'top-right', x: 0.05, y: 0, w: 0.2, h: 0.1 }), canvas);
    // 우측에서 5% 안쪽이 박스 오른쪽 끝 → right=950, width=200 → left=750
    expect(rect.left).toBe(750);
    expect(rect.top).toBe(0);
  });

  test('center는 양축 모두 중앙 정렬한다', () => {
    const rect = resolveRect(box({ anchor: 'center', x: 0, y: 0, w: 0.4, h: 0.2 }), canvas);
    expect(rect).toStrictEqual({ left: 300, top: 400, width: 400, height: 200 });
  });

  test('h가 없으면 실측 높이를 쓴다', () => {
    const rect = resolveRect(box({ anchor: 'top-left', w: 0.5 }), canvas, 137);
    expect(rect.height).toBe(137);
  });

  test('h와 실측 높이가 모두 없으면 높이 0', () => {
    const rect = resolveRect(box({ anchor: 'top-left', w: 0.5 }), canvas);
    expect(rect.height).toBe(0);
  });
});

describe('resolveRect — 비율 리사이즈 불변식 (차별점 #9)', () => {
  test('"아래에서 8% 띄운 가운데" 의도가 비율이 바뀌어도 보존된다', () => {
    const layout = box({ anchor: 'bottom-center', x: 0, y: 0.08, w: 0.8, h: 0.15 });

    const portrait = canvasSize('9:16', 1080);
    const square = canvasSize('1:1', 1080);

    const a = resolveRect(layout, portrait);
    const b = resolveRect(layout, square);

    // 하단 여백이 각 캔버스 높이의 8%로 유지된다
    expect((portrait.height - (a.top + a.height)) / portrait.height).toBeCloseTo(0.08, 5);
    expect((square.height - (b.top + b.height)) / square.height).toBeCloseTo(0.08, 5);

    // 가로 중앙 정렬도 유지된다
    expect(a.left + a.width / 2).toBeCloseTo(portrait.width / 2, 5);
    expect(b.left + b.width / 2).toBeCloseTo(square.width / 2, 5);
  });

  test('절대 픽셀 저장 방식이라면 깨질 케이스를 비율 저장이 막는다', () => {
    // 1080x1920에서 하단 8%는 y=1766이지만, 1080x1080에서 y=1766은 캔버스 밖이다.
    const layout = box({ anchor: 'bottom-center', y: 0.08, w: 0.8, h: 0.15 });
    const square = canvasSize('1:1', 1080);
    const rect = resolveRect(layout, square);
    expect(rect.top + rect.height).toBeLessThanOrEqual(square.height);
  });
});

describe('안전 영역', () => {
  const canvas = { width: 1000, height: 1000 };
  const safeArea = safeAreaSchema.parse({ top: 0.1, right: 0.1, bottom: 0.1, left: 0.1 });

  test('contentBox는 여백을 뺀 영역을 반환한다', () => {
    expect(contentBox(canvas, safeArea)).toStrictEqual({
      left: 100,
      top: 100,
      width: 800,
      height: 800,
    });
  });

  test('안전 영역 안의 박스는 통과한다', () => {
    const rect = resolveRect(box({ anchor: 'center', w: 0.5, h: 0.5 }), canvas);
    expect(isWithinSafeArea(rect, canvas, safeArea)).toBeTruthy();
  });

  test('안전 영역을 넘는 박스는 걸러진다', () => {
    const rect = resolveRect(box({ anchor: 'top-left', x: 0, y: 0, w: 1, h: 1 }), canvas);
    expect(isWithinSafeArea(rect, canvas, safeArea)).toBeFalsy();
  });
});

describe(fontScale, () => {
  test('base와 단변이 같으면 배수 1', () => {
    expect(fontScale({ width: 1080, height: 1350 }, 1080)).toBe(1);
  });

  test('단변 기준이므로 9:16과 16:9가 같은 배수를 갖는다', () => {
    const portrait = fontScale(canvasSize('9:16', 1080), 1080);
    const landscape = fontScale(canvasSize('16:9', 1080), 1080);
    expect(portrait).toBe(landscape);
  });

  test('캔버스를 2배로 렌더하면 폰트도 2배', () => {
    expect(fontScale({ width: 2160, height: 2700 }, 1080)).toBe(2);
  });
});
