import { describe, expect, it } from 'vitest';
import { CREDIT_RATES } from '@/features/credit/estimate';
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

  describe('instatoon', () => {
    const CHARACTER_ID = '9a1c7b2e-5d34-4f61-8b0a-6c2e9d4f7a13';

    function toonItem(cutCount: number) {
      return {
        topic: '내 성과가 남의 이름으로 올라간 날',
        mode: 'toon' as const,
        toon: { characterId: CHARACTER_ID, formulaId: null, cutCount },
        targets: [origin],
      };
    }

    it('prices an instatoon by its length, not as one flat deck', () => {
      const nine = estimateRun({ items: [toonItem(9)], scope: { kind: 'full' } });
      const five = estimateRun({ items: [toonItem(5)], scope: { kind: 'full' } });

      expect(nine.total).toBe(CREDIT_RATES.toonBase + 9 * CREDIT_RATES.toonCut);
      expect(five.total).toBeLessThan(nine.total);
    });

    it('charges more than a card news deck, because it draws every panel', () => {
      const toon = estimateRun({ items: [toonItem(9)], scope: { kind: 'full' } });

      expect(toon.total).toBeGreaterThan(CREDIT_RATES.originDeck);
    });

    it('prices another channel of the same story as a derived cut', () => {
      const estimate = estimateRun({
        items: [{ ...toonItem(9), targets: [origin, reelsCut] }],
        scope: { kind: 'full' },
      });

      expect(estimate.total).toBe(
        CREDIT_RATES.toonBase + 9 * CREDIT_RATES.toonCut + CREDIT_RATES.toonDerivedCut,
      );
    });

    it('prices repainting one cut at the panel rate, like any other card', () => {
      const estimate = estimateRun({
        items: [{ ...toonItem(9), deckId: CHARACTER_ID }],
        scope: { kind: 'panel', panelIndex: 3 },
      });

      expect(estimate.total).toBe(CREDIT_RATES.panel);
    });

    it('leaves card news items on the card news rate inside a mixed batch', () => {
      const estimate = estimateRun({
        items: [item([origin]), toonItem(9)],
        scope: { kind: 'full' },
      });

      expect(estimate.total).toBe(
        CREDIT_RATES.originDeck + CREDIT_RATES.toonBase + 9 * CREDIT_RATES.toonCut,
      );
    });
  });
});
