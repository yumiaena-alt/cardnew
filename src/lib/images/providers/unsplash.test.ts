import { describe, expect, it } from 'vitest';
import { narrowQueries } from './unsplash';

describe('unsplash 검색어', () => {
  describe(narrowQueries, () => {
    // 기획 모델이 실제로 뱉은 지시다. 이 문장 그대로는 0건이 나오고,
    // "person tired summer" 로 물으면 수천 건이 나온다.
    it('문장을 주제와 핵심어로 단계적으로 푼다', () => {
      expect(
        narrowQueries('person looking tired in summer heat, fanning with hand, soft window light'),
      ).toStrictEqual([
        'person looking tired in summer heat, fanning with hand, soft window light',
        'person looking tired in summer heat',
        'person looking tired',
      ]);
    });

    it('전치사와 관사는 핵심어에서 뺀다', () => {
      expect(narrowQueries('a cup of iced coffee on the table')).toContain('cup iced coffee');
    });

    // 이미 짧은 검색어를 세 번 물어봐야 할 이유가 없다.
    it('넓힐 여지가 없으면 하나만 돌려준다', () => {
      expect(narrowQueries('iced coffee')).toStrictEqual(['iced coffee']);
    });

    it('한글 지시도 낱말로 끊는다', () => {
      expect(narrowQueries('여름 카페 아이스 음료, 밝은 자연광')).toStrictEqual([
        '여름 카페 아이스 음료, 밝은 자연광',
        '여름 카페 아이스 음료',
        '여름 카페 아이스',
      ]);
    });

    it('빈 지시에는 아무것도 시도하지 않는다', () => {
      expect(narrowQueries('   ')).toStrictEqual([]);
    });
  });
});
