import { describe, expect, it } from 'vitest';
import type { CharacterAppearance } from './character';
import {
  buildCharacterAnchor,
  buildCutPrompt,
  cutSeed,
  findIdentityDrift,
  seedFromName,
} from './character';

const appearance: CharacterAppearance = {
  ageRange: 'late 20s',
  hair: 'short black bob with blunt bangs',
  outfit: 'oversized beige knit and dark jeans',
  face: 'round face, small eyes',
  distinctive: ['round glasses'],
};

const sheet = { name: 'Mina', appearance, artStyle: 'soft-webtoon' } as const;

describe(buildCharacterAnchor, () => {
  it('names every appearance field the character sheet fixes', () => {
    const anchor = buildCharacterAnchor(sheet);

    expect(anchor).toContain('late 20s');
    expect(anchor).toContain('short black bob with blunt bangs');
    expect(anchor).toContain('oversized beige knit and dark jeans');
    expect(anchor).toContain('round glasses');
  });

  it('produces the same sentence for the same sheet', () => {
    expect(buildCharacterAnchor(sheet)).toBe(buildCharacterAnchor(sheet));
  });

  it('omits the recognisable clause when there are no distinctive marks', () => {
    const plain = buildCharacterAnchor({
      ...sheet,
      appearance: { ...appearance, distinctive: [] },
    });

    expect(plain).not.toContain('Recognisable by');
  });
});

describe(buildCutPrompt, () => {
  it('puts the anchor ahead of the scene', () => {
    const prompt = buildCutPrompt(sheet, {
      imagePrompt: 'sitting across a cafe table from a manager',
      characterEmotion: 'tight-lipped',
    });

    expect(prompt.indexOf('Mina')).toBeLessThan(prompt.indexOf('Scene:'));
  });

  it('forbids lettering in every cut', () => {
    const prompt = buildCutPrompt(sheet, { imagePrompt: 'a cafe', characterEmotion: 'calm' });

    expect(prompt).toContain('No text, no lettering, no speech bubbles');
  });
});

describe(cutSeed, () => {
  it('reuses the character seed on a first attempt', () => {
    expect(cutSeed(4242, 0)).toBe(4242);
  });

  it('moves the seed on a retry so the same picture is not redrawn', () => {
    expect(cutSeed(4242, 1)).not.toBe(4242);
  });

  it('stays inside the 32-bit range providers accept', () => {
    expect(cutSeed(2_147_483_000, 500)).toBeLessThan(2_147_483_647);
  });
});

describe(seedFromName, () => {
  it('derives the same seed from the same name', () => {
    expect(seedFromName('미나')).toBe(seedFromName('미나'));
  });

  it('derives different seeds from different names', () => {
    expect(seedFromName('미나')).not.toBe(seedFromName('지훈'));
  });
});

describe(findIdentityDrift, () => {
  it('flags a scene prompt that redescribes the character', () => {
    expect(findIdentityDrift('a woman with long red hair wearing a coat')).toContain('hair');
  });

  it('passes a scene prompt that only describes the scene', () => {
    expect(findIdentityDrift('standing at a bus stop in the rain, wide shot')).toStrictEqual([]);
  });
});
