/**
 * Alignment while dragging.
 *
 * A layer that lands one pixel off centre looks like a mistake nobody made on
 * purpose, and nudging it there by hand is the slowest part of using a canvas.
 * So the drag is pulled onto the lines a design would use anyway — the canvas
 * centre, its safe margins, and whatever the other layers are already aligned
 * to — and the line that caught it is drawn so the pull is explained rather
 * than mysterious.
 */

export type Guide = { axis: 'x' | 'y'; at: number };

export type SnapTarget = {
  /** Lines to snap against, in canvas pixels. */
  x: number[];
  y: number[];
};

/**
 * Within this many canvas pixels, a drag is pulled onto the line.
 *
 * Measured on the document rather than the screen so the pull feels the same
 * whatever size the stage is drawn at.
 */
const SNAP_DISTANCE = 12;

/**
 * The nearest line within reach.
 *
 * @param value - Where the edge currently is.
 * @param candidates - Lines it could snap to.
 * @returns The line, or null when none is close enough.
 */
function nearest(value: number, candidates: number[]): number | null {
  let best: number | null = null;
  let bestGap = SNAP_DISTANCE;

  for (const candidate of candidates) {
    const gap = Math.abs(candidate - value);

    if (gap <= bestGap) {
      best = candidate;
      bestGap = gap;
    }
  }

  return best;
}

export type SnapResult = {
  x: number;
  y: number;
  guides: Guide[];
};

/**
 * Pulls a dragged box onto nearby lines.
 *
 * Both edges and the centre are offered on each axis, because "align these two
 * left edges" and "centre this on the card" are the same gesture from the
 * user's side and it is the box that decides which one it was.
 *
 * @param box - Where the drag currently is, in canvas pixels.
 * @param targets - Lines to snap against.
 * @returns The adjusted position and any lines that caught it.
 */
export function snapBox(
  box: { x: number; y: number; width: number; height: number },
  targets: SnapTarget,
): SnapResult {
  const guides: Guide[] = [];
  let { x, y } = box;

  const horizontal: [number, number][] = [
    [box.x, 0],
    [box.x + box.width / 2, box.width / 2],
    [box.x + box.width, box.width],
  ];

  for (const [edge, offset] of horizontal) {
    const line = nearest(edge, targets.x);

    if (line !== null) {
      x = line - offset;
      guides.push({ axis: 'x', at: line });
      break;
    }
  }

  const vertical: [number, number][] = [
    [box.y, 0],
    [box.y + box.height / 2, box.height / 2],
    [box.y + box.height, box.height],
  ];

  for (const [edge, offset] of vertical) {
    const line = nearest(edge, targets.y);

    if (line !== null) {
      y = line - offset;
      guides.push({ axis: 'y', at: line });
      break;
    }
  }

  return { x, y, guides };
}

/**
 * The lines worth snapping to on this card.
 *
 * @param canvas - Logical canvas size.
 * @param others - Boxes of the layers not being dragged.
 * @param safeArea - Margins as fractions of the canvas.
 * @returns Lines on each axis.
 */
export function snapTargets(
  canvas: { width: number; height: number },
  others: { left: number; top: number; width: number; height: number }[],
  safeArea: { top: number; right: number; bottom: number; left: number },
): SnapTarget {
  return {
    x: [
      canvas.width / 2,
      canvas.width * safeArea.left,
      canvas.width * (1 - safeArea.right),
      ...others.flatMap((box) => [box.left, box.left + box.width / 2, box.left + box.width]),
    ],
    y: [
      canvas.height / 2,
      canvas.height * safeArea.top,
      canvas.height * (1 - safeArea.bottom),
      ...others.flatMap((box) => [box.top, box.top + box.height / 2, box.top + box.height]),
    ],
  };
}
