import { describe, expect, it } from 'vitest';
import { snapBox, snapTargets } from './snap';

/**
 * Snapping while dragging.
 *
 * The pull has to be strong enough to be useful and weak enough to be escapable.
 * A snap that fires from far away takes control away from whoever is dragging.
 */

const CANVAS = { width: 1080, height: 1350 };
const SAFE = { top: 0.06, right: 0.06, bottom: 0.06, left: 0.06 };
const BOX = { x: 100, y: 100, width: 200, height: 100 };

describe(snapBox, () => {
  it('pulls a near-centre box onto the centre line', () => {
    const targets = snapTargets(CANVAS, [], SAFE);
    const result = snapBox({ ...BOX, x: 435 }, targets);

    // 435 + 100 = 535, six short of the 540 centre line.
    expect(result.x + BOX.width / 2).toBe(CANVAS.width / 2);
    expect(result.guides).toContainEqual({ axis: 'x', at: 540 });
  });

  it('leaves a box that is not near a line alone', () => {
    const targets = snapTargets(CANVAS, [], SAFE);
    const result = snapBox({ ...BOX, x: 300 }, targets);

    expect(result.x).toBe(300);
    expect(result.guides).toStrictEqual([]);
  });

  // Aligning to a neighbour is the other half of why this exists: two headlines
  // sharing a left edge is a design decision, not a coincidence.
  it('aligns to another layer edge', () => {
    const targets = snapTargets(CANVAS, [{ left: 240, top: 800, width: 400, height: 100 }], SAFE);
    const result = snapBox({ ...BOX, x: 246 }, targets);

    expect(result.x).toBe(240);
  });

  it('reports a guide per axis at most', () => {
    const targets = snapTargets(CANVAS, [], SAFE);
    const result = snapBox({ ...BOX, x: 435, y: 620 }, targets);

    expect(result.guides.filter((guide) => guide.axis === 'x')).toHaveLength(1);
    expect(result.guides.filter((guide) => guide.axis === 'y')).toHaveLength(1);
  });
});
