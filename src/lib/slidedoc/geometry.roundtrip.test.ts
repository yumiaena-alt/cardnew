import { describe, expect, it } from 'vitest';
import { rectToOffset, resolveRect } from './geometry';
import type { LayoutBox } from './primitives';

/**
 * 앵커 왕복.
 *
 * 에디터의 드래그가 이 왕복 위에 서 있다. 어긋나면 레이어를 끌어도 다음
 * 조판에서 제자리로 돌아가고, 화면상으로는 드래그가 먹지 않는 것처럼 보인다.
 */

const CANVAS = { width: 1080, height: 1350 };

const ANCHORS = [
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'center',
  'middle-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
] as const;

/**
 * 주어진 앵커의 기본 레이아웃.
 *
 * @param anchor - 시험할 앵커.
 * @returns 레이아웃 박스.
 */
function boxFor(anchor: LayoutBox['anchor']): LayoutBox {
  return { anchor, x: 0.1, y: 0.2, w: 0.6, h: 0.15, rotate: 0, z: 0 };
}

describe('앵커 좌표 왕복', () => {
  it.each(ANCHORS)('%s 앵커에서 오프셋이 그대로 돌아온다', (anchor) => {
    const layout = boxFor(anchor);
    const rect = resolveRect(layout, CANVAS);
    const back = rectToOffset(rect, layout, CANVAS);

    expect(back.x).toBeCloseTo(layout.x, 10);
    expect(back.y).toBeCloseTo(layout.y, 10);
  });

  // 에디터가 실제로 하는 일: 사각형을 옮긴 뒤 그 자리를 저장한다.
  it('옮긴 자리를 저장하면 그 자리에 다시 놓인다', () => {
    const layout = boxFor('center');
    const moved = { left: 200, top: 900 };
    const offset = rectToOffset(moved, layout, CANVAS);
    const again = resolveRect({ ...layout, ...offset }, CANVAS);

    expect(again.left).toBeCloseTo(moved.left, 10);
    expect(again.top).toBeCloseTo(moved.top, 10);
  });

  // 높이를 비워 둔 텍스트가 흔한 경우다. 실측 높이로 왕복해야 한다.
  it('높이가 비어 있으면 실측 높이로 왕복한다', () => {
    const layout: LayoutBox = { ...boxFor('bottom-center'), h: undefined };
    const measured = 240;
    const rect = resolveRect(layout, CANVAS, measured);
    const back = rectToOffset(rect, layout, CANVAS, measured);

    expect(back.y).toBeCloseTo(layout.y, 10);
  });
});
