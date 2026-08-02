import { describe, expect, test } from 'vitest';
import {
  alphaComposite,
  contrastRatio,
  contrastRatioFromStrings,
  isLargeText,
  lumaToGray,
  NEAR_BLACK,
  parseAlpha,
  parseColor,
  planReadability,
  planToGradient,
  relativeLuminance,
  requiredContrast,
  rgbToHex,
  WCAG_AA_LARGE,
  WCAG_AA_NORMAL,
  WHITE,
  withAlpha,
} from './contrast';

describe(parseColor, () => {
  test('6자리 hex', () => {
    expect(parseColor('#FF8800')).toStrictEqual({ r: 255, g: 136, b: 0 });
  });

  test('3자리 축약 hex', () => {
    expect(parseColor('#F80')).toStrictEqual({ r: 255, g: 136, b: 0 });
  });

  test('8자리 hex는 알파를 무시하고 RGB만 반환', () => {
    expect(parseColor('#FF8800CC')).toStrictEqual({ r: 255, g: 136, b: 0 });
  });

  test('rgb()/rgba() 함수 표기', () => {
    expect(parseColor('rgb(255, 136, 0)')).toStrictEqual({ r: 255, g: 136, b: 0 });
    expect(parseColor('rgba(255, 136, 0, 0.5)')).toStrictEqual({ r: 255, g: 136, b: 0 });
  });

  test('알 수 없는 표기는 null', () => {
    expect(parseColor('oklch(70% 0.2 250)')).toBeNull();
    expect(parseColor('garbage')).toBeNull();
  });
});

describe(parseAlpha, () => {
  test('알파 정보가 없으면 1', () => {
    expect(parseAlpha('#FF8800')).toBe(1);
  });

  test('8자리 hex의 알파를 읽는다', () => {
    expect(parseAlpha('#000000FF')).toBe(1);
    expect(parseAlpha('#00000000')).toBe(0);
    expect(parseAlpha('#00000080')).toBeCloseTo(0.502, 2);
  });

  test('transparent는 0', () => {
    expect(parseAlpha('transparent')).toBe(0);
  });

  test('rgba의 알파를 읽는다', () => {
    expect(parseAlpha('rgba(0, 0, 0, 0.35)')).toBeCloseTo(0.35, 5);
  });
});

describe(relativeLuminance, () => {
  test('검정은 0, 흰색은 1', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0);
    expect(relativeLuminance(WHITE)).toBeCloseTo(1, 5);
  });

  test('녹색이 같은 값의 파랑보다 휘도가 높다 (인간 시각 가중치)', () => {
    const green = relativeLuminance({ r: 0, g: 255, b: 0 });
    const blue = relativeLuminance({ r: 0, g: 0, b: 255 });
    expect(green).toBeGreaterThan(blue);
  });
});

describe(contrastRatio, () => {
  test('흑백 대비는 21:1 (WCAG 최대값)', () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, WHITE)).toBeCloseTo(21, 1);
  });

  test('같은 색끼리는 1:1', () => {
    expect(contrastRatio(WHITE, WHITE)).toBeCloseTo(1, 5);
  });

  test('순서를 바꿔도 같은 값 (대칭)', () => {
    const a = { r: 30, g: 60, b: 90 };
    const b = { r: 200, g: 180, b: 160 };
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 10);
  });

  test('알려진 값 검증: #767676과 흰색은 AA 경계인 4.5:1 부근', () => {
    const ratio = contrastRatioFromStrings('#767676', '#FFFFFF')!;
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    expect(ratio).toBeLessThan(4.7);
  });

  test('파싱 실패 시 null', () => {
    expect(contrastRatioFromStrings('oklch(50% 0 0)', '#FFF')).toBeNull();
  });
});

describe('WCAG 기준 선택', () => {
  test('24px 이상은 큰 글씨', () => {
    expect(isLargeText(24, 400)).toBeTruthy();
    expect(isLargeText(23, 400)).toBeFalsy();
  });

  test('19px 이상 bold도 큰 글씨', () => {
    expect(isLargeText(19, 700)).toBeTruthy();
    expect(isLargeText(19, 400)).toBeFalsy();
  });

  test('큰 글씨는 3:1, 본문은 4.5:1을 요구한다', () => {
    expect(requiredContrast(64, 700)).toBe(WCAG_AA_LARGE);
    expect(requiredContrast(16, 400)).toBe(WCAG_AA_NORMAL);
  });
});

describe(alphaComposite, () => {
  test('알파 0이면 배경 그대로', () => {
    const bg = { r: 100, g: 100, b: 100 };
    expect(alphaComposite(WHITE, 0, bg)).toStrictEqual(bg);
  });

  test('알파 1이면 전경 그대로', () => {
    expect(alphaComposite(WHITE, 1, { r: 0, g: 0, b: 0 })).toStrictEqual(WHITE);
  });

  test('알파 0.5는 중간값', () => {
    const result = alphaComposite({ r: 0, g: 0, b: 0 }, 0.5, { r: 200, g: 200, b: 200 });
    expect(result.r).toBeCloseTo(100, 5);
  });
});

describe('planReadability — 가독성 자동 보장 (차별점 #2)', () => {
  const headline = { size: 72, weight: 800 };

  test('어두운 배경에는 흰 글씨를 고른다', () => {
    const plan = planReadability({ meanLuma: 0.08, stdDev: 0.03 }, headline.size, headline.weight);
    expect(plan.textColor).toBe(rgbToHex(WHITE));
    expect(plan.meetsRequirement).toBeTruthy();
  });

  test('밝은 배경에는 어두운 글씨를 고른다', () => {
    const plan = planReadability({ meanLuma: 0.95, stdDev: 0.02 }, headline.size, headline.weight);
    expect(plan.textColor).toBe(rgbToHex(NEAR_BLACK));
    expect(plan.meetsRequirement).toBeTruthy();
  });

  test('대비가 충분하면 오버레이를 넣지 않아 사진을 살린다', () => {
    const plan = planReadability({ meanLuma: 0.02, stdDev: 0.01 }, headline.size, headline.weight);
    expect(plan.overlayOpacity).toBe(0);
  });

  test('중간 휘도 배경에는 오버레이를 넣는다', () => {
    const plan = planReadability({ meanLuma: 0.45, stdDev: 0.05 }, headline.size, headline.weight);
    expect(plan.overlayOpacity).toBeGreaterThan(0);
  });

  test('★ 어떤 배경 휘도에서도 요구 대비를 만족한다 (핵심 불변식)', () => {
    for (let luma = 0; luma <= 1.0001; luma += 0.05) {
      const plan = planReadability(
        { meanLuma: luma, stdDev: 0.05 },
        headline.size,
        headline.weight,
      );
      expect(
        plan.resultingContrast,
        `휘도 ${luma.toFixed(2)}에서 대비 ${plan.resultingContrast} < ${WCAG_AA_LARGE}`,
      ).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
      expect(plan.meetsRequirement).toBeTruthy();
    }
  });

  test('본문 크기(4.5:1 요구)도 모든 휘도에서 만족한다', () => {
    for (let luma = 0; luma <= 1.0001; luma += 0.05) {
      const plan = planReadability({ meanLuma: luma, stdDev: 0.05 }, 20, 400);
      expect(
        plan.resultingContrast,
        `휘도 ${luma.toFixed(2)}에서 대비 ${plan.resultingContrast} < ${WCAG_AA_NORMAL}`,
      ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    }
  });

  test('본문은 큰 글씨보다 더 센 오버레이를 요구한다', () => {
    const analysis = { meanLuma: 0.42, stdDev: 0.08 };
    const large = planReadability(analysis, 72, 800);
    const small = planReadability(analysis, 16, 400);
    expect(small.overlayOpacity).toBeGreaterThanOrEqual(large.overlayOpacity);
  });

  test('★ 최악값은 오버레이 세기만 바꾸고 글자색은 뒤집지 않는다', () => {
    // 실제로 겪은 버그: 어두운 나무 위 밝은 타르트 사진.
    // 평균 0.23(어두움) → 흰 글씨가 맞는데, 최악값 0.54를 색 결정에까지 쓰면
    // "밝은 배경"으로 오판해 검정 글씨를 골라 완전히 안 읽히는 결과가 나온다.
    const meanOnly = planReadability({ meanLuma: 0.23, stdDev: 0.15 }, 112, 900);
    const withWorst = planReadability(
      { meanLuma: 0.23, stdDev: 0.15, worstCaseLuma: 0.54 },
      112,
      900,
    );

    // 글자색은 동일해야 한다 (둘 다 흰 글씨)
    expect(withWorst.textColor).toBe(meanOnly.textColor);
    expect(withWorst.textColor).toBe(rgbToHex(WHITE));

    // 오버레이는 더 세져야 한다
    expect(withWorst.overlayOpacity).toBeGreaterThan(meanOnly.overlayOpacity);
  });

  test('★ 밝은 배경에서도 색은 유지되고 오버레이만 강해진다', () => {
    const meanOnly = planReadability({ meanLuma: 0.85, stdDev: 0.1 }, 72, 800);
    const withWorst = planReadability(
      // 밝은 배경이면 최악은 "가장 어두운 부분"(p10)
      { meanLuma: 0.85, stdDev: 0.1, worstCaseLuma: 0.45 },
      72,
      800,
    );

    expect(withWorst.textColor).toBe(meanOnly.textColor);
    expect(withWorst.textColor).toBe(rgbToHex(NEAR_BLACK));
    expect(withWorst.overlayOpacity).toBeGreaterThanOrEqual(meanOnly.overlayOpacity);
  });

  test('worstCaseLuma가 없으면 평균으로 동작한다 (하위 호환)', () => {
    const a = planReadability({ meanLuma: 0.4, stdDev: 0.1 }, 72, 800);
    const b = planReadability({ meanLuma: 0.4, stdDev: 0.1, worstCaseLuma: 0.4 }, 72, 800);
    expect(a).toStrictEqual(b);
  });

  test('복잡한 배경(stdDev 큼)은 더 센 오버레이를 요구한다', () => {
    const simple = planReadability({ meanLuma: 0.3, stdDev: 0.01 }, 72, 800);
    const complex = planReadability({ meanLuma: 0.3, stdDev: 0.25 }, 72, 800);
    expect(complex.overlayOpacity).toBeGreaterThanOrEqual(simple.overlayOpacity);
  });

  test('오버레이 상한 0.75를 넘지 않는다 (사진이 안 보이면 카드뉴스 의미가 없다)', () => {
    for (let luma = 0; luma <= 1.0001; luma += 0.02) {
      const plan = planReadability({ meanLuma: luma, stdDev: 0.25 }, 14, 400);
      expect(plan.overlayOpacity).toBeLessThanOrEqual(0.75);
    }
  });
});

describe(lumaToGray, () => {
  test('왕복 변환이 근사적으로 보존된다', () => {
    for (const luma of [0, 0.1, 0.25, 0.5, 0.75, 1]) {
      const gray = lumaToGray(luma);
      expect(relativeLuminance(gray)).toBeCloseTo(luma, 2);
    }
  });

  test('범위를 벗어난 입력은 클램프된다', () => {
    expect(lumaToGray(-1)).toStrictEqual({ r: 0, g: 0, b: 0 });
    expect(lumaToGray(2)).toStrictEqual(WHITE);
  });
});

describe('withAlpha / planToGradient', () => {
  /**
   * 오버레이가 실제로 필요한 배경.
   * 휘도 0.45는 "어두운 배경"으로 분류되어 흰 글씨를 쓰는데,
   * 흰 글씨 대비 배경이 너무 밝아 오버레이 없이는 3:1을 못 넘긴다.
   * (0.5 이상이면 어두운 글씨를 쓰게 되어 오버레이가 불필요해진다)
   */
  const needsOverlay = { meanLuma: 0.45, stdDev: 0.05 };

  test('withAlpha가 #RRGGBBAA를 만든다', () => {
    expect(withAlpha('#000000', 1)).toBe('#000000FF');
    expect(withAlpha('#000000', 0)).toBe('#00000000');
  });

  test('오버레이가 필요 없으면 그라데이션을 만들지 않는다', () => {
    const plan = planReadability({ meanLuma: 0.02, stdDev: 0.01 }, 72, 800);
    expect(plan.overlayOpacity).toBe(0);
    expect(planToGradient(plan)).toBeUndefined();
  });

  test('bottom 방향은 아래로 갈수록 진해진다', () => {
    const plan = planReadability(needsOverlay, 72, 800);
    expect(plan.overlayOpacity).toBeGreaterThan(0);

    const gradient = planToGradient(plan, 'bottom')!;
    expect(gradient.angle).toBe(180);
    expect(parseAlpha(gradient.stops[0]!.color)).toBe(0);
    expect(parseAlpha(gradient.stops.at(-1)!.color)).toBeGreaterThan(0);
  });

  test('top 방향은 각도가 0이다', () => {
    const plan = planReadability(needsOverlay, 72, 800);
    expect(planToGradient(plan, 'top')!.angle).toBe(0);
  });

  test('full 방향은 균일한 스크림이다', () => {
    const plan = planReadability(needsOverlay, 72, 800);
    const gradient = planToGradient(plan, 'full')!;
    expect(parseAlpha(gradient.stops[0]!.color)).toBeCloseTo(
      parseAlpha(gradient.stops[1]!.color),
      5,
    );
  });
});
