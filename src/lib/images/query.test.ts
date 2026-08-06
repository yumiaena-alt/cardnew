import { describe, expect, it } from 'vitest';
import { hasKorean, shouldRetranslate } from './query';

/**
 * 언제 다시 찾아볼지.
 *
 * 번역은 모델 호출이라 공짜가 아니다. 잘 나온 검색에까지 붙으면 검색 한 번마다
 * 비용이 붙고, 안 붙이면 한글 사용자에게는 라이브러리가 비어 보인다.
 */

describe(hasKorean, () => {
  it('한글 음절을 찾아낸다', () => {
    expect(hasKorean('아이스 아메리카노')).toBeTruthy();
    expect(hasKorean('cafe 라떼')).toBeTruthy();
  });

  it('영어만 있으면 아니라고 한다', () => {
    expect(hasKorean('iced americano')).toBeFalsy();
  });

  // 자모만 남은 입력은 조합 중인 상태다. 번역해도 뜻이 없다.
  it('완성되지 않은 자모는 한글로 세지 않는다', () => {
    expect(hasKorean('ㅇㅏ')).toBeFalsy();
  });
});

describe(shouldRetranslate, () => {
  it('한글인데 결과가 얕으면 다시 찾는다', () => {
    expect(shouldRetranslate({ query: '아이스 아메리카노', resultCount: 2 })).toBeTruthy();
  });

  // 잘 나오고 있는데 굳이 모델을 부를 이유가 없다.
  it('결과가 충분하면 그대로 둔다', () => {
    expect(shouldRetranslate({ query: '아이스 아메리카노', resultCount: 12 })).toBeFalsy();
  });

  // 영어로 0건이면 번역해도 같은 0건이다.
  it('영어 검색어는 결과가 없어도 다시 찾지 않는다', () => {
    expect(shouldRetranslate({ query: 'nonexistent thing', resultCount: 0 })).toBeFalsy();
  });
});
