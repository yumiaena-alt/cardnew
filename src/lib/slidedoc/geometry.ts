import type { Anchor, LayoutBox, SafeArea } from './primitives';

/**
 * 제약 기반 LayoutBox → 절대 픽셀 변환.
 *
 * 렌더러와 비율 리사이즈가 이 함수를 공유해야 한다.
 * 두 곳에서 따로 계산하면 에디터와 내보내기 결과가 어긋난다(차별점 #3).
 */

export type Rect = { left: number; top: number; width: number; height: number };

export type CanvasBox = { width: number; height: number };

/** 앵커별 (기준 x비율, 기준 y비율, x부호, y부호). 부호는 오프셋 진행 방향. */
const ANCHOR_TABLE: Record<Anchor, { bx: number; by: number; sx: 1 | -1; sy: 1 | -1 }> = {
  'top-left': { bx: 0, by: 0, sx: 1, sy: 1 },
  'top-center': { bx: 0.5, by: 0, sx: 1, sy: 1 },
  'top-right': { bx: 1, by: 0, sx: -1, sy: 1 },
  'middle-left': { bx: 0, by: 0.5, sx: 1, sy: 1 },
  center: { bx: 0.5, by: 0.5, sx: 1, sy: 1 },
  'middle-right': { bx: 1, by: 0.5, sx: -1, sy: 1 },
  'bottom-left': { bx: 0, by: 1, sx: 1, sy: -1 },
  'bottom-center': { bx: 0.5, by: 1, sx: 1, sy: -1 },
  'bottom-right': { bx: 1, by: 1, sx: -1, sy: -1 },
};

/**
 * LayoutBox를 캔버스 좌표계의 절대 사각형으로 변환한다.
 *
 * 규칙:
 *  - w/h는 캔버스 폭/높이 대비 비율.
 *  - x/y는 앵커 기준점에서의 오프셋(캔버스 폭/높이 대비 비율). 부호는 앵커가 결정.
 *    예) anchor='bottom-center', y=0.08 → 아래에서 캔버스 높이의 8% 띄움.
 *  - 가로 중앙 앵커(*-center)는 박스를 x축 기준으로 중앙 정렬한다.
 *  - 세로 중앙 앵커(middle-*)는 박스를 y축 기준으로 중앙 정렬한다.
 *
 * @param resolvedHeight h가 없는 텍스트 레이어의 실측 높이(px). 없으면 0으로 둔다.
 */
export function resolveRect(layout: LayoutBox, canvas: CanvasBox, resolvedHeight?: number): Rect {
  const a = ANCHOR_TABLE[layout.anchor];
  const width = layout.w * canvas.width;
  const height = layout.h === undefined ? (resolvedHeight ?? 0) : layout.h * canvas.height;

  const baseX = a.bx * canvas.width;
  const baseY = a.by * canvas.height;
  const offX = a.sx * layout.x * canvas.width;
  const offY = a.sy * layout.y * canvas.height;

  const isHCenter = layout.anchor.endsWith('-center') || layout.anchor === 'center';
  const isVCenter = layout.anchor.startsWith('middle-') || layout.anchor === 'center';

  let left = baseX + offX;
  if (isHCenter) {
    left -= width / 2;
  } else if (a.sx === -1) {
    left -= width;
  } // 우측 앵커: 박스가 왼쪽으로 자란다

  let top = baseY + offY;
  if (isVCenter) {
    top -= height / 2;
  } else if (a.sy === -1) {
    top -= height;
  } // 하단 앵커: 박스가 위로 자란다

  return { left, top, width, height };
}

/** 안전 영역을 뺀 사용 가능 영역. */
export function contentBox(canvas: CanvasBox, safeArea: SafeArea): Rect {
  return {
    left: safeArea.left * canvas.width,
    top: safeArea.top * canvas.height,
    width: (1 - safeArea.left - safeArea.right) * canvas.width,
    height: (1 - safeArea.top - safeArea.bottom) * canvas.height,
  };
}

/** 사각형이 안전 영역 안에 완전히 들어오는지. */
export function isWithinSafeArea(
  rect: Rect,
  canvas: CanvasBox,
  safeArea: SafeArea,
  tolerancePx = 1,
): boolean {
  const safe = contentBox(canvas, safeArea);
  return (
    rect.left >= safe.left - tolerancePx &&
    rect.top >= safe.top - tolerancePx &&
    rect.left + rect.width <= safe.left + safe.width + tolerancePx &&
    rect.top + rect.height <= safe.top + safe.height + tolerancePx
  );
}

/**
 * 폰트 크기 스케일 배수.
 *
 * style.size는 base(1080) 기준 px이므로, 실제 캔버스 단변이 다르면 배수를 곱한다.
 * 단변(짧은 쪽)을 기준으로 삼아야 9:16과 16:9에서 글자 크기 체감이 비슷해진다.
 */
export function fontScale(canvas: CanvasBox, base: number): number {
  return Math.min(canvas.width, canvas.height) / base;
}

/** CSS object-position 문자열. */
export function focusToObjectPosition(focus: { x: number; y: number }): string {
  return `${(focus.x * 100).toFixed(2)}% ${(focus.y * 100).toFixed(2)}%`;
}

/**
 * 절대 사각형을 LayoutBox 좌표로 되돌린다. `resolveRect`의 역함수.
 *
 * 에디터가 필요로 한다. 캔버스에서 레이어를 끌면 나오는 값은 화면 픽셀인데,
 * 문서가 저장하는 것은 앵커 기준 오프셋이다. 픽셀을 그대로 x/y에 적으면
 * 다음 조판에서 앵커가 다시 적용돼 레이어가 제자리로 돌아간다 —
 * 끌었는데 아무 일도 일어나지 않는 것처럼 보인다.
 *
 * @param rect - 옮겨진 절대 사각형.
 * @param layout - 원래 LayoutBox. 앵커와 크기를 여기서 가져온다.
 * @param canvas - 논리 캔버스 크기.
 * @returns 저장할 x/y 오프셋.
 */
export function rectToOffset(
  rect: Pick<Rect, 'left' | 'top'>,
  layout: LayoutBox,
  canvas: CanvasBox,
  resolvedHeight?: number,
): { x: number; y: number } {
  const a = ANCHOR_TABLE[layout.anchor];
  const width = layout.w * canvas.width;
  const height = layout.h === undefined ? (resolvedHeight ?? 0) : layout.h * canvas.height;

  const isHCenter = layout.anchor.endsWith('-center') || layout.anchor === 'center';
  const isVCenter = layout.anchor.startsWith('middle-') || layout.anchor === 'center';

  // resolveRect가 뺀 만큼을 그대로 되더한다.
  const backX = isHCenter ? width / 2 : a.sx === -1 ? width : 0;
  const backY = isVCenter ? height / 2 : a.sy === -1 ? height : 0;

  return {
    x: (rect.left + backX - a.bx * canvas.width) / (a.sx * canvas.width),
    y: (rect.top + backY - a.by * canvas.height) / (a.sy * canvas.height),
  };
}
