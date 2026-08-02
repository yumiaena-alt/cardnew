import { describe, expect, it } from 'vitest';
import { estimateBoardCredits } from '@/features/credit/estimate';
import { estimateRun } from '@/features/run/estimate';
import { parseFanout } from './FanoutCell';
import { toRunItems } from './runInput';
import type { SheetRow } from './useBoardSheet';

function row(topic: string, fanout: string): SheetRow {
  return { topic, fanout, scheduledAt: '', notes: '' };
}

describe(toRunItems, () => {
  describe('row selection', () => {
    it('skips a row with no topic', () => {
      expect(toRunItems([row('', 'instagram')])).toStrictEqual([]);
    });

    it('skips a row whose topic is only whitespace', () => {
      expect(toRunItems([row('   ', 'instagram')])).toStrictEqual([]);
    });

    it('skips a row with no channel selected', () => {
      expect(toRunItems([row('여름 신메뉴 소개', '')])).toStrictEqual([]);
    });

    it('trims the topic it sends', () => {
      expect(toRunItems([row('  여름 신메뉴 소개  ', 'instagram')])[0]?.topic).toBe(
        '여름 신메뉴 소개',
      );
    });

    it('keeps sheet order across a gap', () => {
      const items = toRunItems([
        row('첫 번째', 'instagram'),
        row('', 'instagram'),
        row('세 번째', 'threads'),
      ]);

      expect(items.map((item) => item.topic)).toStrictEqual(['첫 번째', '세 번째']);
    });
  });

  describe('fan-out targets', () => {
    it('marks the first selected channel as the origin', () => {
      const targets = toRunItems([row('여름 신메뉴 소개', 'instagram,threads,tiktok')])[0]?.targets;

      expect(targets?.map((target) => target.isOrigin)).toStrictEqual([true, false, false]);
    });

    it('carries the ratio each channel renders at', () => {
      const targets = toRunItems([row('여름 신메뉴 소개', 'instagram,tiktok')])[0]?.targets;

      expect(targets).toStrictEqual([
        { channel: 'instagram', ratio: '4:5', isOrigin: true },
        { channel: 'tiktok', ratio: '9:16', isOrigin: false },
      ]);
    });

    it('drops a channel the sheet does not recognise', () => {
      const targets = toRunItems([row('여름 신메뉴 소개', 'instagram,carrier-pigeon')])[0]?.targets;

      expect(targets).toHaveLength(1);
    });
  });

  // The header total and the server quote are produced by different functions.
  // If they disagree the user approves one number and is charged another, so
  // the two are pinned against each other here.
  describe('agreement with the header estimate', () => {
    const rows = [
      row('여름 신메뉴 소개', 'instagram,threads'),
      row('', 'instagram'),
      row('가을 이벤트', 'instagram,threads,tiktok,blog'),
      row('겨울 준비', ''),
      row('연말 인사', 'tiktok'),
    ];

    it('produces the same total as the sheet header', () => {
      const header = estimateBoardCredits(
        rows.map((sheetRow) => ({
          hasTopic: (sheetRow.topic ?? '').trim() !== '',
          channelCount: parseFanout(sheetRow.fanout ?? '').length,
        })),
      );

      const server = estimateRun({ items: toRunItems(rows), scope: { kind: 'full' } });

      expect(server.total).toBe(header.total);
    });

    it('produces the same origin and cut counts as the sheet header', () => {
      const header = estimateBoardCredits(
        rows.map((sheetRow) => ({
          hasTopic: (sheetRow.topic ?? '').trim() !== '',
          channelCount: parseFanout(sheetRow.fanout ?? '').length,
        })),
      );

      const server = estimateRun({ items: toRunItems(rows), scope: { kind: 'full' } });

      expect(server).toMatchObject({
        originCount: header.originCount,
        cutCount: header.cutCount,
      });
    });
  });
});
