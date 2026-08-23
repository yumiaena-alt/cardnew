import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TOON_CUTS,
  defaultSceneFlow,
  MAX_TOON_CUTS,
  MIN_TOON_CUTS,
  resolveCutCount,
  toonCutSchema,
} from './schema';

describe(defaultSceneFlow, () => {
  it('returns one scene per cut', () => {
    expect(defaultSceneFlow(9)).toHaveLength(9);
  });

  it('opens on the cover and closes on the call to action', () => {
    const flow = defaultSceneFlow(9);

    expect(flow.at(0)).toBe('cover');
    expect(flow.at(-1)).toBe('cta');
  });

  it('keeps conflict from taking over the middle', () => {
    const flow = defaultSceneFlow(9);
    const conflicts = flow.filter((scene) => scene === 'conflict').length;

    expect(conflicts).toBeLessThan(flow.length / 2);
    expect(flow).toContain('climax');
  });

  it('still produces the four fixed beats at the shortest length', () => {
    expect(defaultSceneFlow(MIN_TOON_CUTS)).toStrictEqual(['cover', 'setup', 'resolution', 'cta']);
  });
});

describe(resolveCutCount, () => {
  it('uses the default length when there is neither a formula nor a request', () => {
    expect(resolveCutCount(null)).toBe(DEFAULT_TOON_CUTS);
  });

  it('takes the length from the formula when one applies', () => {
    const beats = Array.from({ length: 7 }, () => ({
      sceneType: 'conflict' as const,
      purpose: '갈등',
      tension: 3,
    }));

    expect(resolveCutCount({ beats })).toBe(7);
  });

  it('lets an explicit request win over the formula', () => {
    const beats = Array.from({ length: 7 }, () => ({
      sceneType: 'conflict' as const,
      purpose: '갈등',
      tension: 3,
    }));

    expect(resolveCutCount({ beats }, 5)).toBe(5);
  });

  it('clamps a request to the carousel limit', () => {
    expect(resolveCutCount(null, 40)).toBe(MAX_TOON_CUTS);
    expect(resolveCutCount(null, 1)).toBe(MIN_TOON_CUTS);
  });
});

describe('cut contract', () => {
  it('fills in the optional fields a cut can leave out', () => {
    const parsed = toonCutSchema.parse({
      cutNumber: 3,
      sceneType: 'conflict',
      imagePrompt: 'a narrow corridor',
      characterEmotion: 'tense',
    });

    expect(parsed).toMatchObject({ narration: null, dialogue: [], visualFocus: null });
  });

  it('refuses dialogue too long for a speech bubble', () => {
    const result = toonCutSchema.safeParse({
      cutNumber: 3,
      sceneType: 'conflict',
      imagePrompt: 'a narrow corridor',
      characterEmotion: 'tense',
      dialogue: [
        {
          speaker: 'main',
          text: '제가 그 일을 다 했는데 왜 팀장님 이름으로 올라가 있는 건가요',
          anchor: 'top-left',
        },
      ],
    });

    expect(result.success).toBeFalsy();
  });

  it('refuses more bubbles than a panel can carry', () => {
    const line = { speaker: 'main', text: '한 마디', anchor: 'top-left' as const };

    const result = toonCutSchema.safeParse({
      cutNumber: 3,
      sceneType: 'conflict',
      imagePrompt: 'a narrow corridor',
      characterEmotion: 'tense',
      dialogue: [line, line, line, line],
    });

    expect(result.success).toBeFalsy();
  });
});
