import { describe, expect, it } from 'vitest';
import { PlanLineParser, PlanParseError } from './plan-parser';

/**
 * 파서는 "모델이 형식을 어겼을 때"를 감당해야 한다.
 * 실제 LLM 호출로는 이 경우들을 재현할 수 없어서 여기서 전부 고정한다.
 */

const SLIDE = (headline: string, role = 'point') =>
  JSON.stringify({
    role,
    headline,
    body: '본문입니다',
    eyebrow: null,
    imageQuery: 'warm cafe interior, natural light',
    imageMood: 'warm',
  });

const META = JSON.stringify({
  hook: '가을에만 맛볼 수 있는 한 잔',
  targetAudience: '동네 단골',
  caption: '가을 신메뉴를 소개합니다.',
  hashtags: ['가을메뉴', '동네카페'],
});

describe(PlanLineParser, () => {
  it('완성된 줄에서만 슬라이드 이벤트를 낸다', () => {
    const parser = new PlanLineParser();

    // 줄이 끝나지 않았으면 아직 아무 일도 일어나지 않는다.
    expect(parser.push(SLIDE('첫 장').slice(0, 20))).toStrictEqual([]);
    expect(parser.push(`${SLIDE('첫 장').slice(20)}\n`)).toHaveLength(1);
  });

  it('청크 경계가 줄 중간이어도 슬라이드를 복원한다', () => {
    const parser = new PlanLineParser();
    const text = `${SLIDE('첫 장', 'cover')}\n${SLIDE('둘째 장')}\n${META}\n`;

    const events = [];
    // 글자 단위로 흘려보내는 최악의 경우
    for (const char of text) {
      events.push(...parser.push(char));
    }

    expect(events.filter((e) => e.type === 'slide')).toHaveLength(2);
    expect(events.filter((e) => e.type === 'meta')).toHaveLength(1);
    expect(parser.buildPlan().slides[0]?.headline).toBe('첫 장');
  });

  it('마지막 줄에 개행이 없어도 flush로 건진다', () => {
    const parser = new PlanLineParser();
    parser.push(`${SLIDE('첫 장', 'cover')}\n${SLIDE('둘째 장')}\n${META}`);

    expect(parser.meta).toBeNull();
    expect(parser.flush()).toHaveLength(1);
    expect(parser.meta?.hook).toBe('가을에만 맛볼 수 있는 한 잔');
  });

  it('코드블록과 머리말을 무시한다', () => {
    const parser = new PlanLineParser();
    parser.push('아래와 같이 작성했습니다.\n```json\n');
    parser.push(`${SLIDE('첫 장', 'cover')}\n${SLIDE('둘째 장')}\n\`\`\`\n`);

    expect(parser.slides).toHaveLength(2);
    expect(parser.warnings.filter((w) => w.kind === 'dropped_line')).toHaveLength(1);
  });

  it('상한을 넘긴 카피는 버리지 않고 잘라낸다', () => {
    const parser = new PlanLineParser();
    const long = '가'.repeat(35);
    parser.push(`${SLIDE(long, 'cover')}\n${SLIDE('둘째 장')}\n`);

    expect(parser.slides[0]?.headline).toHaveLength(28);
    expect(parser.warnings).toContainEqual({
      kind: 'clipped',
      index: 0,
      field: 'headline',
      from: 35,
      to: 28,
    });
  });

  it('깨진 줄 하나가 나머지 슬라이드를 죽이지 않는다', () => {
    const parser = new PlanLineParser();
    parser.push(`${SLIDE('첫 장', 'cover')}\n{"role":"point","headline":"잘린\n`);
    parser.push(`${SLIDE('셋째 장')}\n${META}\n`);

    expect(parser.slides).toHaveLength(2);
    expect(parser.buildPlan().slides).toHaveLength(2);
  });

  it('body가 빈 문자열이거나 "null" 문자열이면 null로 정규화한다', () => {
    const parser = new PlanLineParser();
    parser.push(
      `${JSON.stringify({ role: 'cover', headline: '첫 장', body: '', eyebrow: 'null', imageQuery: 'x', imageMood: 'warm' })}\n`,
    );
    parser.push(`${SLIDE('둘째 장')}\n`);

    expect(parser.slides[0]?.body).toBeNull();
    expect(parser.slides[0]?.eyebrow).toBeNull();
  });

  it('알 수 없는 imageMood는 neutral로 떨어뜨린다', () => {
    const parser = new PlanLineParser();
    parser.push(
      `${JSON.stringify({ role: 'cover', headline: '첫 장', body: null, imageQuery: 'x', imageMood: 'vibrant' })}\n`,
    );

    expect(parser.slides[0]?.imageMood).toBe('neutral');
  });

  it('메타가 없어도 슬라이드로 캡션을 합성한다', () => {
    const parser = new PlanLineParser();
    parser.push(`${SLIDE('첫 장', 'cover')}\n${SLIDE('둘째 장')}\n`);

    const plan = parser.buildPlan();
    expect(plan.hook).toBe('첫 장');
    expect(plan.caption).toContain('둘째 장');
  });

  it('해시태그의 # 접두사를 제거한다', () => {
    const parser = new PlanLineParser();
    parser.push(`${JSON.stringify({ hook: 'h', caption: 'c', hashtags: ['#가을', '카페'] })}\n`);

    expect(parser.meta?.hashtags).toStrictEqual(['가을', '카페']);
  });

  it('슬라이드가 2장 미만이면 실패시킨다', () => {
    const parser = new PlanLineParser();
    parser.push(`${SLIDE('첫 장', 'cover')}\n`);

    expect(() => parser.buildPlan()).toThrow(PlanParseError);
  });
});
