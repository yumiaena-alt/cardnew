// Ported verbatim from the source project; the assertions are the port's
// acceptance criteria, so the file keeps its original shape rather than being
// restructured to house test conventions. See docs/07-PORTED-MODULES.md.
// oxlint-disable vitest/prefer-each
// oxlint-disable vitest/no-conditional-expect
// oxlint-disable eslint/require-unicode-regexp
import { describe, expect, test } from 'vitest';
import type { CardnewsPlan, SlidePlan } from '@/lib/deckplan/schema';
import type { SlideRole } from '@/lib/slidedoc/doc';
import type { AspectRatio } from '@/lib/slidedoc/primitives';
import { composeCardnews, composeSlide, placeholderImage } from './compose';
import { selectTemplate, seededUnit, TEMPLATES, updateWeight, templatesForRole } from './registry';
import type { BrandStyle, ResolvedImage } from './types';

const RATIOS: AspectRatio[] = ['1:1', '4:5', '9:16', '16:9', '3:4'];

function slidePlan(patch: Partial<SlidePlan> = {}): SlidePlan {
  return {
    role: 'cover',
    headline: '이번 시즌, 새로운 주인공',
    body: '오직 지금만 맛볼 수 있는 특별한 맛으로 준비했습니다.',
    eyebrow: 'NEW ARRIVAL',
    imageQuery: 'autumn cafe drink',
    imageMood: 'warm',
    templateHint: null,
    ...patch,
  };
}

function image(meanLuma: number): ResolvedImage {
  return { src: 'data:image/svg+xml;base64,PHN2Zy8+', assetId: null, meanLuma, stdDev: 0.12 };
}

const ALL_ROLES: SlideRole[] = ['cover', 'problem', 'point', 'example', 'quote', 'cta'];

describe('composeSlide — 기본 동작', () => {
  test('SlideDoc을 만들고 템플릿 id를 기록한다', () => {
    const result = composeSlide({
      plan: slidePlan(),
      ratio: '4:5',
      index: 0,
      totalSlides: 5,
      seed: 'test',
    });

    expect(result.doc.v).toBe(3);
    expect(result.doc.canvas.ratio).toBe('4:5');
    expect(result.doc.meta.templateId).toBe(result.templateId);
    expect(result.doc.layers.length).toBeGreaterThan(0);
  });

  test('제목 레이어에 기획 카피가 들어간다', () => {
    const result = composeSlide({
      plan: slidePlan({ headline: '가을 신메뉴' }),
      ratio: '4:5',
      index: 0,
      totalSlides: 3,
      seed: 'test',
    });

    const headline = result.doc.layers.find((l) => l.type === 'text' && l.role === 'headline');
    expect(headline?.type === 'text' && headline.text).toBe('가을 신메뉴');
  });

  test('body가 null이면 본문 레이어를 만들지 않는다', () => {
    const result = composeSlide({
      plan: slidePlan({ body: null }),
      ratio: '4:5',
      index: 0,
      totalSlides: 3,
      seed: 'test',
    });

    const body = result.doc.layers.find((l) => l.role === 'body');
    expect(body).toBeUndefined();
  });

  test('페이지 번호를 끌 수 있다', () => {
    const withNumber = composeSlide({
      plan: slidePlan(),
      ratio: '4:5',
      index: 0,
      totalSlides: 5,
      seed: 't',
      showPageNumber: true,
    });
    const without = composeSlide({
      plan: slidePlan(),
      ratio: '4:5',
      index: 0,
      totalSlides: 5,
      seed: 't',
      showPageNumber: false,
    });

    expect(withNumber.doc.layers.some((l) => l.role === 'pagenum')).toBeTruthy();
    expect(without.doc.layers.some((l) => l.role === 'pagenum')).toBeFalsy();
  });

  test('★ 같은 입력은 항상 같은 결과를 낸다 (결정론성)', () => {
    const options = {
      plan: slidePlan(),
      ratio: '4:5' as AspectRatio,
      index: 2,
      totalSlides: 5,
      seed: 'content-abc',
    };
    const a = composeSlide(options);
    const b = composeSlide(options);

    expect(a.templateId).toBe(b.templateId);
    expect(a.doc).toStrictEqual(b.doc);
  });
});

describe('composeSlide — 가독성 자동 결정 (차별점 #2)', () => {
  test('어두운 이미지에는 밝은 글씨를 쓴다', () => {
    const result = composeSlide({
      plan: slidePlan(),
      ratio: '4:5',
      index: 0,
      totalSlides: 3,
      image: image(0.08),
      seed: 't',
    });

    const headline = result.doc.layers.find((l) => l.role === 'headline');
    if (headline?.type !== 'text') {
      throw new Error('제목 레이어가 있어야 합니다');
    }
    // 흰색 계열이어야 한다
    expect(headline.style.color.toUpperCase()).toMatch(/^#F{3,}|^#FFFFFF$/);
  });

  test('밝은 이미지에는 어두운 글씨를 쓴다', () => {
    const result = composeSlide({
      plan: slidePlan(),
      ratio: '4:5',
      index: 0,
      totalSlides: 3,
      image: image(0.92),
      seed: 't',
    });

    const headline = result.doc.layers.find((l) => l.role === 'headline');
    if (headline?.type !== 'text') {
      throw new Error('제목 레이어가 있어야 합니다');
    }
    expect(headline.style.color).toBe('#111111');
  });

  test('이미지가 있으면 배경 레이어와 오버레이가 생긴다', () => {
    const result = composeSlide({
      plan: slidePlan(),
      ratio: '4:5',
      index: 0,
      totalSlides: 3,
      // 중간 휘도는 오버레이가 필요하다
      image: image(0.45),
      seed: 't',
      forceTemplateId: 'cover-bottom-stack',
    });

    const bg = result.doc.layers.find((l) => l.role === 'background');
    if (bg?.type !== 'image') {
      throw new Error('배경 이미지 레이어가 있어야 합니다');
    }
    expect(bg.overlay).toBeDefined();
  });

  test('이미지가 없으면 배경 레이어를 만들지 않고 단색을 쓴다', () => {
    const result = composeSlide({
      plan: slidePlan(),
      ratio: '4:5',
      index: 0,
      totalSlides: 3,
      image: null,
      seed: 't',
    });

    expect(result.doc.layers.some((l) => l.role === 'background')).toBeFalsy();
    expect(result.doc.canvas.bg.kind).toBe('solid');
  });
});

describe('★ 템플릿 품질 보장 — 전 조합에서 넘침·겹침 없음', () => {
  // 이게 Phase 1의 핵심 품질 지표다.
  // 어떤 역할 × 비율 × 이미지 유무 조합에서도 조판이 깨지지 않아야 한다.
  const headlines = [
    '짧은 제목',
    '이번 시즌, 새로운 주인공을 만나보세요',
    '카페 사장님이라면 반드시 알아야 할 것', // 20자
    '가을에 어울리는 신메뉴 일곱 가지 정리', // 20자
  ];

  /**
   * 최악의 경우: 스키마가 허용하는 최대 길이.
   * headline 28자, body 90자, eyebrow 20자는 Stage 1 LLM이 실제로 만들 수 있는 상한이므로
   * 여기서 깨지면 프로덕션에서 반드시 깨진다.
   */
  test('★ 스키마 최대 길이 카피가 전 조합에서 정상', () => {
    const maxHeadline = '가'.repeat(28);
    const maxBody = '나'.repeat(90);
    const maxEyebrow = 'A'.repeat(20);

    const failures: string[] = [];

    for (const role of ALL_ROLES) {
      for (const ratio of RATIOS) {
        for (const hasImage of [true, false]) {
          const result = composeSlide({
            plan: slidePlan({
              role,
              headline: maxHeadline,
              body: maxBody,
              eyebrow: maxEyebrow,
            }),
            ratio,
            index: 1,
            totalSlides: 5,
            image: hasImage ? image(0.4) : null,
            seed: `stress-${role}-${ratio}-${hasImage}`,
          });

          if (result.warnings.length > 0) {
            failures.push(
              `${result.templateId}/${role}/${ratio}/image=${hasImage}: ${JSON.stringify(result.warnings)}`,
            );
          }
        }
      }
    }

    expect(failures, `최대 길이 카피 실패:\n${failures.join('\n')}`).toStrictEqual([]);
  });

  test('★ 최대 길이 카피 — 각 템플릿 개별', () => {
    const failures: string[] = [];

    for (const template of TEMPLATES) {
      for (const role of template.roles) {
        for (const ratio of RATIOS) {
          const result = composeSlide({
            plan: slidePlan({
              role,
              headline: '가'.repeat(28),
              body: '나'.repeat(90),
              eyebrow: 'A'.repeat(20),
            }),
            ratio,
            index: 1,
            totalSlides: 5,
            image: image(0.4),
            seed: `stress-t-${template.id}-${ratio}`,
            forceTemplateId: template.id,
          });

          if (result.warnings.length > 0) {
            failures.push(`${template.id}/${role}/${ratio}: ${JSON.stringify(result.warnings)}`);
          }
        }
      }
    }

    expect(failures, `템플릿별 최대 길이 실패:\n${failures.join('\n')}`).toStrictEqual([]);
  });

  for (const role of ALL_ROLES) {
    for (const ratio of RATIOS) {
      test(`${role} × ${ratio} — 이미지 있음/없음 모두 정상`, () => {
        for (const hasImage of [true, false]) {
          for (const headline of headlines) {
            const result = composeSlide({
              plan: slidePlan({ role, headline }),
              ratio,
              index: 1,
              totalSlides: 5,
              image: hasImage ? image(0.4) : null,
              seed: `quality-${role}-${ratio}-${headline.length}`,
            });

            expect(
              result.warnings,
              `${role}/${ratio}/image=${hasImage}/"${headline}" → ${JSON.stringify(result.warnings)}`,
            ).toStrictEqual([]);
          }
        }
      });
    }
  }
});

describe('★ 템플릿 품질 — 각 템플릿 개별 검증', () => {
  for (const template of TEMPLATES) {
    test(`${template.id} — 5개 비율 전부 정상`, () => {
      const role = template.roles[0]!;
      for (const ratio of RATIOS) {
        const result = composeSlide({
          plan: slidePlan({ role, headline: '이번 시즌 새로운 주인공을 만나보세요' }),
          ratio,
          index: 1,
          totalSlides: 5,
          image: image(0.35),
          seed: `t-${template.id}-${ratio}`,
          forceTemplateId: template.id,
        });

        expect(result.templateId).toBe(template.id);
        expect(
          result.warnings,
          `${template.id}/${ratio} → ${JSON.stringify(result.warnings)}`,
        ).toStrictEqual([]);
      }
    });

    test(`${template.id} — eyebrow/body 없어도 정상`, () => {
      const role = template.roles[0]!;
      const result = composeSlide({
        plan: slidePlan({ role, eyebrow: null, body: null }),
        ratio: '4:5',
        index: 0,
        totalSlides: 3,
        image: image(0.35),
        seed: `t-${template.id}-minimal`,
        forceTemplateId: template.id,
      });
      expect(result.warnings).toStrictEqual([]);
    });
  }
});

describe('composeSlide — 브랜드 스타일 적용', () => {
  const brand: BrandStyle = {
    palette: { accent: '#0055FF', background: '#FFFFFF', text: '#000000' },
    typography: { headingFamily: 'NanumSquareNeo', headingWeight: 800 },
    logo: null,
  };

  test('브랜드 강조색이 eyebrow에 적용된다', () => {
    const result = composeSlide({
      plan: slidePlan(),
      ratio: '4:5',
      index: 0,
      totalSlides: 3,
      brand,
      image: null,
      seed: 't',
      forceTemplateId: 'cover-bottom-stack',
    });

    const eyebrow = result.doc.layers.find((l) => l.role === 'eyebrow');
    if (eyebrow?.type !== 'text') {
      throw new Error('eyebrow가 있어야 합니다');
    }
    expect(eyebrow.style.color).toBe('#0055FF');
  });

  test('브랜드 폰트가 제목에 적용된다', () => {
    const result = composeSlide({
      plan: slidePlan(),
      ratio: '4:5',
      index: 0,
      totalSlides: 3,
      brand,
      image: null,
      seed: 't',
    });

    const headline = result.doc.layers.find((l) => l.role === 'headline');
    if (headline?.type !== 'text') {
      throw new Error('제목이 있어야 합니다');
    }
    expect(headline.style.family).toBe('NanumSquareNeo');
    expect(headline.style.weight).toBe(800);
  });

  test('밝은 브랜드 배경에는 어두운 글씨를 쓴다', () => {
    const result = composeSlide({
      plan: slidePlan(),
      ratio: '4:5',
      index: 0,
      totalSlides: 3,
      brand,
      image: null,
      seed: 't',
    });

    const headline = result.doc.layers.find((l) => l.role === 'headline');
    if (headline?.type !== 'text') {
      throw new Error('제목이 있어야 합니다');
    }
    expect(headline.style.color).toBe('#000000');
  });

  test('CTA 템플릿은 로고를 배치한다', () => {
    const result = composeSlide({
      plan: slidePlan({ role: 'cta' }),
      ratio: '4:5',
      index: 4,
      totalSlides: 5,
      brand: { ...brand, logo: { src: 'https://example.com/logo.png', assetId: 'a1' } },
      image: null,
      seed: 't',
      forceTemplateId: 'body-cta',
    });

    const logo = result.doc.layers.find((l) => l.type === 'logo');
    expect(logo).toBeDefined();
    expect(logo?.type === 'logo' && logo.src).toBe('https://example.com/logo.png');
  });
});

describe('selectTemplate — 밴딧 선택', () => {
  test('힌트가 유효하면 그것을 쓴다', () => {
    const result = selectTemplate({
      role: 'cover',
      hasImage: true,
      hint: 'cover-bold-type',
      seed: 'x',
      epsilon: 0,
    });
    expect(result.id).toBe('cover-bold-type');
  });

  test('힌트가 역할에 안 맞으면 무시한다', () => {
    const result = selectTemplate({
      role: 'cover',
      hasImage: true,
      hint: 'body-cta',
      seed: 'x',
      epsilon: 0,
    });
    expect(result.id).not.toBe('body-cta');
    expect(result.roles).toContain('cover');
  });

  test('이미지가 없으면 이미지 필수 템플릿을 고르지 않는다', () => {
    for (let i = 0; i < 40; i += 1) {
      const result = selectTemplate({ role: 'cover', hasImage: false, seed: `seed-${i}` });
      expect(result.requiresImage).toBeFalsy();
    }
  });

  test('가중치가 높은 템플릿을 선호한다 (탐색 끔)', () => {
    const result = selectTemplate({
      role: 'cover',
      hasImage: true,
      weights: { 'cover-card-overlay': 0.95, 'cover-bottom-stack': 0.1, 'cover-bold-type': 0.1 },
      epsilon: 0,
      seed: 'x',
    });
    expect(result.id).toBe('cover-card-overlay');
  });

  test('★ 탐색을 켜면 다양한 템플릿이 선택된다', () => {
    const picked = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      picked.add(
        selectTemplate({
          role: 'cover',
          hasImage: true,
          weights: { 'cover-card-overlay': 0.95 },
          epsilon: 0.15,
          seed: `explore-${i}`,
        }).id,
      );
    }
    // 탐색이 동작하면 최고 가중치 하나만 나오지 않는다
    expect(picked.size).toBeGreaterThan(1);
  });

  test('같은 시드는 같은 템플릿을 고른다', () => {
    const pick = () => selectTemplate({ role: 'point', hasImage: true, seed: 'fixed-seed' }).id;
    expect(pick()).toBe(pick());
  });

  test('모든 역할에 최소 하나의 템플릿이 있다', () => {
    for (const role of ALL_ROLES) {
      for (const hasImage of [true, false]) {
        expect(templatesForRole(role, hasImage).length, `${role}/${hasImage}`).toBeGreaterThan(0);
      }
    }
  });

  test('없는 템플릿을 강제하면 오류를 던진다', () => {
    expect(() =>
      composeSlide({
        plan: slidePlan({ role: 'cover' }),
        ratio: '4:5',
        index: 0,
        totalSlides: 3,
        seed: 't',
        forceTemplateId: 'body-cta',
      }),
    ).toThrow(/쓸 수 없습니다/);
  });
});

describe(seededUnit, () => {
  test('0~1 범위를 반환한다', () => {
    for (let i = 0; i < 100; i += 1) {
      const value = seededUnit(`seed-${i}`);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  test('같은 시드는 같은 값을 낸다', () => {
    expect(seededUnit('abc')).toBe(seededUnit('abc'));
  });

  test('다른 시드는 대체로 다른 값을 낸다', () => {
    const values = new Set(Array.from({ length: 100 }, (_, i) => seededUnit(`s${i}`)));
    // 해시 충돌이 심하면 밴딧 탐색이 편향된다
    expect(values.size).toBeGreaterThan(90);
  });

  test('고르게 분포한다', () => {
    const samples = Array.from({ length: 1000 }, (_, i) => seededUnit(`dist-${i}`));
    const belowHalf = samples.filter((v) => v < 0.5).length;
    // 이상적으로 500. 400~600이면 충분히 고르다.
    expect(belowHalf).toBeGreaterThan(400);
    expect(belowHalf).toBeLessThan(600);
  });
});

describe('updateWeight — 채택률 학습', () => {
  test('무편집 발행은 가중치를 올린다', () => {
    expect(updateWeight(0.5, true)).toBeGreaterThan(0.5);
  });

  test('편집 후 발행은 가중치를 내린다', () => {
    expect(updateWeight(0.5, false)).toBeLessThan(0.5);
  });

  test('반복 성공에도 상한을 넘지 않는다 (탐색 여지 유지)', () => {
    let weight = 0.5;
    for (let i = 0; i < 100; i += 1) {
      weight = updateWeight(weight, true);
    }
    expect(weight).toBeLessThanOrEqual(0.95);
  });

  test('반복 실패에도 하한을 넘지 않는다', () => {
    let weight = 0.5;
    for (let i = 0; i < 100; i += 1) {
      weight = updateWeight(weight, false);
    }
    expect(weight).toBeGreaterThanOrEqual(0.05);
  });

  test('초기값이 없으면 0.5에서 시작한다', () => {
    expect(updateWeight(undefined, true)).toBe(updateWeight(0.5, true));
  });

  test('한 번의 결과로 뒤집히지 않는다 (지수 이동평균)', () => {
    // 0.9에서 한 번 실패해도 0.5 아래로 떨어지지 않아야 한다
    expect(updateWeight(0.9, false)).toBeGreaterThan(0.5);
  });
});

describe('composeCardnews — 전체 조판', () => {
  const plan: CardnewsPlan = {
    hook: '가을 신메뉴 출시',
    targetAudience: '카페 단골 고객',
    slides: [
      slidePlan({ role: 'cover' }),
      slidePlan({ role: 'problem', headline: '매번 같은 메뉴에 지치셨나요' }),
      slidePlan({ role: 'point', headline: '제철 과일만 골랐습니다' }),
      slidePlan({ role: 'example', headline: '이렇게 즐겨보세요' }),
      slidePlan({ role: 'cta', headline: '지금 매장에서 만나보세요' }),
    ],
    caption: '가을 신메뉴가 출시되었습니다.',
    hashtags: ['카페', '신메뉴'],
  };

  test('기획의 슬라이드 수만큼 조판한다', () => {
    const result = composeCardnews({ plan, ratio: '4:5', seed: 'content-1' });
    expect(result.slides).toHaveLength(5);
  });

  test('페이지 번호가 순서대로 붙는다', () => {
    const result = composeCardnews({ plan, ratio: '4:5', seed: 'content-1' });

    result.slides.forEach((slide, index) => {
      const pagenum = slide.doc.layers.find((l) => l.role === 'pagenum');
      if (pagenum?.type === 'text') {
        expect(pagenum.text).toBe(`${index + 1} / 5`);
      }
    });
  });

  test('★ 슬라이드마다 다양한 템플릿이 쓰인다', () => {
    const result = composeCardnews({ plan, ratio: '4:5', seed: 'content-1' });
    const ids = new Set(result.slides.map((s) => s.templateId));
    // 5장이 전부 같은 템플릿이면 단조로운 결과물이 된다
    expect(ids.size).toBeGreaterThan(1);
  });

  test('★ 전체 조판에 경고가 없다', () => {
    const result = composeCardnews({ plan, ratio: '4:5', seed: 'content-1' });
    expect(result.warnings).toStrictEqual([]);
  });

  test('★ 5개 비율 전부 경고 없이 조판된다', () => {
    for (const ratio of RATIOS) {
      const result = composeCardnews({ plan, ratio, seed: `content-${ratio}` });
      expect(result.warnings, `${ratio} → ${JSON.stringify(result.warnings)}`).toStrictEqual([]);
    }
  });

  test('이미지 배열이 슬라이드에 순서대로 매핑된다', () => {
    const images = [image(0.1), null, image(0.9), null, null];
    const result = composeCardnews({ plan, ratio: '4:5', images, seed: 'c' });

    expect(result.slides[0]!.doc.layers.some((l) => l.role === 'background')).toBeTruthy();
    expect(result.slides[1]!.doc.layers.some((l) => l.role === 'background')).toBeFalsy();
    expect(result.slides[2]!.doc.layers.some((l) => l.role === 'background')).toBeTruthy();
  });

  test('경고에 슬라이드 인덱스가 포함된다', () => {
    const longPlan: CardnewsPlan = {
      ...plan,
      slides: [
        slidePlan({ role: 'cover' }),
        // 좁은 인용 템플릿에 긴 카피 → 넘칠 수 있다
        slidePlan({
          role: 'quote',
          headline: '아주 긴 인용문이 들어가는 경우를 확인합니다',
          body: '보조 설명도 함께 들어갑니다',
        }),
      ],
    };
    const result = composeCardnews({ plan: longPlan, ratio: '4:5', seed: 'c' });

    for (const warning of result.warnings) {
      expect(warning.slideIndex).toBeTypeOf('number');
      expect(warning.slideIndex).toBeGreaterThanOrEqual(0);
    }
  });
});

describe(placeholderImage, () => {
  test('무드로 휘도를 추정한다', () => {
    expect(placeholderImage(slidePlan({ imageMood: 'dark' })).meanLuma).toBeLessThan(0.3);
    expect(placeholderImage(slidePlan({ imageMood: 'bright' })).meanLuma).toBeGreaterThan(0.7);
  });

  test('src는 비어 있다 (아직 조달 전)', () => {
    expect(placeholderImage(slidePlan()).src).toBe('');
  });
});
