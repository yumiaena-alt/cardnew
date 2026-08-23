import { describe, expect, it } from 'vitest';
import type { ResolvedImage } from '@/lib/renderer/types';
import { composeToonCut } from './compose';
import type { ToonCut } from './schema';

const art: ResolvedImage = {
  src: 'data:image/jpeg;base64,AAAA',
  assetId: null,
  meanLuma: 0.4,
  stdDev: 0.1,
};

function cut(overrides: Partial<ToonCut> = {}): ToonCut {
  return {
    cutNumber: 2,
    sceneType: 'conflict',
    imagePrompt: 'standing in a narrow office corridor, medium shot',
    characterEmotion: 'tight-lipped',
    narration: '그날 결재란에는 내 이름이 있었다',
    dialogue: [],
    visualFocus: null,
    ...overrides,
  };
}

function compose(input: ToonCut, image: ResolvedImage | null = art) {
  return composeToonCut({ cut: input, ratio: '4:5', image, hook: '3년을 버틴 이유', totalCuts: 9 });
}

describe(composeToonCut, () => {
  it('lays the generated art in as a full-bleed background', () => {
    const { doc } = compose(cut());
    const background = doc.layers.find((layer) => layer.role === 'background');

    expect(background?.type).toBe('image');
    expect(background?.layout.w).toBe(1);
  });

  it('writes narration into a text layer rather than into the picture', () => {
    const { doc } = compose(cut());
    const narration = doc.layers.find((layer) => layer.id === 'narration');

    expect(narration).toMatchObject({ type: 'text', text: '그날 결재란에는 내 이름이 있었다' });
  });

  it('backs narration with an opaque band so contrast never depends on the art', () => {
    const { doc } = compose(cut());
    const band = doc.layers.find((layer) => layer.id === 'narration-band');

    expect(band).toMatchObject({ type: 'shape', role: 'scrim' });
  });

  it('draws each line of dialogue as a bubble and a text layer', () => {
    const { doc } = compose(
      cut({
        dialogue: [
          { speaker: 'main', text: '제 이름은 왜 빠졌을까요', anchor: 'top-left', tone: 'speech' },
          { speaker: '팀장', text: '그건 관행이야', anchor: 'bottom-right', tone: 'speech' },
        ],
      }),
    );

    expect(doc.layers.filter((layer) => layer.role === 'bubble')).toHaveLength(2);
    expect(doc.layers.filter((layer) => layer.id.startsWith('bubble-text-'))).toHaveLength(2);
  });

  it('points a bubble tail back into the frame', () => {
    const { doc } = compose(
      cut({
        dialogue: [{ speaker: 'main', text: '왜요', anchor: 'bottom-left', tone: 'speech' }],
      }),
    );
    const bubble = doc.layers.find((layer) => layer.role === 'bubble');

    expect(bubble?.type === 'shape' ? bubble.tail?.side : null).toBe('top');
  });

  it('separates two bubbles sharing one anchor', () => {
    const { doc } = compose(
      cut({
        dialogue: [
          { speaker: 'main', text: '첫 마디', anchor: 'top-left', tone: 'speech' },
          { speaker: 'main', text: '두 번째 마디', anchor: 'top-left', tone: 'speech' },
        ],
      }),
    );

    const [first, second] = doc.layers.filter((layer) => layer.role === 'bubble');

    expect(second?.layout.y).toBeGreaterThan(first?.layout.y ?? 0);
  });

  it('gives the cover its own large focus line instead of a narration band', () => {
    const { doc } = compose(cut({ cutNumber: 1, sceneType: 'cover', visualFocus: '퇴사 3일 전' }));

    expect(doc.layers.find((layer) => layer.id === 'cover-focus')).toMatchObject({
      text: '퇴사 3일 전',
    });
    expect(doc.layers.find((layer) => layer.id === 'narration-band')).toBeUndefined();
  });

  it('falls back to the hook when the cover carries no focus line', () => {
    const { doc } = compose(cut({ cutNumber: 1, sceneType: 'cover', visualFocus: null }));

    expect(doc.layers.find((layer) => layer.id === 'cover-focus')).toMatchObject({
      text: '3년을 버틴 이유',
    });
  });

  it('still composes the cut when its art failed, and says so', () => {
    const { doc, warnings } = compose(cut(), null);

    expect(doc.layers.some((layer) => layer.role === 'background')).toBeFalsy();
    expect(doc.layers.some((layer) => layer.id === 'narration')).toBeTruthy();
    expect(warnings).toContain('missing_art:2');
  });

  it('maps a scene type onto a slide role the editor already understands', () => {
    expect(compose(cut({ sceneType: 'cta' })).doc.role).toBe('cta');
    expect(compose(cut({ sceneType: 'climax' })).doc.role).toBe('point');
  });
});
