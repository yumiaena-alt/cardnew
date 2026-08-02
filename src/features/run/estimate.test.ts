import { describe, expect, it } from 'vitest';
import type { CreateRunInput } from '@/validations/RunValidation';
import { estimateRun } from './estimate';

const TEMPLATE_VERSION_ID = '3f6d1e4a-0d2e-4f8a-9c7b-2a1d5e8c4b90';

function item(targets: CreateRunInput['items'][number]['targets'], sourceRowId?: string) {
  return {
    topic: '여름 신메뉴 소개',
    templateVersionId: TEMPLATE_VERSION_ID,
    targets,
    sourceRowId,
  };
}

const origin = { channel: 'instagram', ratio: '4:5', isOrigin: true } as const;
const reelsCut = { channel: 'tiktok', ratio: '9:16', isOrigin: false } as const;
const threadsCut = { channel: 'threads', ratio: '1:1', isOrigin: false } as const;

describe(estimateRun, () => {
  describe('full generation', () => {
    it('prices a lone origin at the full deck rate', () => {
      const estimate = estimateRun({ items: [item([origin])], scope: { kind: 'full' } });

      expect(estimate).toMatchObject({ originCount: 1, cutCount: 0, total: 15 });
    });

    it('prices derived cuts below the origin they came from', () => {
      const estimate = estimateRun({
        items: [item([origin, reelsCut, threadsCut])],
        scope: { kind: 'full' },
      });

      expect(estimate).toMatchObject({ originCount: 1, cutCount: 2, total: 25 });
    });

    it('sums every item of a batch', () => {
      const estimate = estimateRun({
        items: [item([origin, reelsCut]), item([origin]), item([origin, threadsCut])],
        scope: { kind: 'full' },
      });

      expect(estimate).toMatchObject({ originCount: 3, cutCount: 2, total: 55 });
    });

    it('emits one cut per target, carrying the board row it came from', () => {
      const rowId = '8c2b7d61-4a9f-4c3e-8b15-6d7e9a0c1f24';
      const estimate = estimateRun({
        items: [item([origin, reelsCut], rowId)],
        scope: { kind: 'full' },
      });

      expect(estimate.cuts).toHaveLength(2);
      expect(estimate.cuts[0]).toMatchObject({
        itemIndex: 0,
        channel: 'instagram',
        isOrigin: true,
        credits: 15,
        sourceRowId: rowId,
      });
      expect(estimate.cuts[1]).toMatchObject({ channel: 'tiktok', isOrigin: false, credits: 5 });
    });
  });

  describe('partial regeneration', () => {
    it('prices a panel by what it redraws, not by channel', () => {
      const estimate = estimateRun({
        items: [item([origin, reelsCut])],
        scope: { kind: 'panel', panelIndex: 2 },
      });

      expect(estimate.total).toBe(6);
    });

    it('prices a slot at the cheapest rate', () => {
      const estimate = estimateRun({
        items: [item([origin])],
        scope: { kind: 'slot', panelIndex: 1, slotKey: 'headline' },
      });

      expect(estimate.total).toBe(1);
    });
  });
});
