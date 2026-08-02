/**
 * 텍스트 자동 맞춤 (autoFit).
 *
 * 조판 엔진이 폰트 크기를 이진탐색으로 정해 텍스트가 박스 안에 정확히 수납되게 만든다.
 * LLM에게 "제목을 몇 px로 해라"를 맡기면 반드시 넘치거나 남는다.
 * 그래서 카피는 LLM이, 크기는 이 함수가 정한다.
 *
 * 측정 함수는 주입받는다:
 *  - 브라우저/Playwright: 실제 DOM 측정 (정확)
 *  - Node 단독(테스트·서버 사전계산): 근사 측정 (measureTextApprox)
 * 두 환경에서 같은 이진탐색을 쓰므로 결과가 크게 어긋나지 않는다.
 */

export type FitConstraints = {
  /** 사용 가능한 폭 (px) */
  maxWidth: number;
  /** 사용 가능한 높이 (px). 미지정이면 높이 제약 없음. */
  maxHeight?: number;
  maxLines: number;
  minSize: number;
  maxSize: number;
  lineHeight: number;
};

export type TextMetrics = {
  width: number;
  height: number;
  lines: number;
};

/** 주어진 폰트 크기에서 텍스트가 차지하는 크기를 재는 함수. */
export type MeasureFn = (text: string, fontSizePx: number, maxWidth: number) => TextMetrics;

export type FitResult = {
  fontSize: number;
  metrics: TextMetrics;
  /** 최소 크기까지 줄여도 제약을 못 맞춘 경우 true. 호출부가 카피 축약을 요청해야 한다. */
  overflow: boolean;
};

function fits(metrics: TextMetrics, c: FitConstraints): boolean {
  if (metrics.lines > c.maxLines) {
    return false;
  }
  if (metrics.width > c.maxWidth + 0.5) {
    return false;
  }
  if (c.maxHeight !== undefined && metrics.height > c.maxHeight + 0.5) {
    return false;
  }
  return true;
}

/**
 * 제약을 만족하는 가장 큰 폰트 크기를 찾는다.
 *
 * 이진탐색 전제: "크기가 작아질수록 제약을 만족하기 쉬워진다"는 단조성.
 * 줄바꿈 때문에 완벽히 단조롭지는 않지만(경계에서 한 줄이 접히며 높이가 튐),
 * 1px 해상도에서는 실무상 문제가 없다. 대신 마지막에 결과를 반드시 재검증한다.
 */
export function fitTextSize(text: string, c: FitConstraints, measure: MeasureFn): FitResult {
  const minSize = Math.max(1, Math.floor(c.minSize));
  const maxSize = Math.max(minSize, Math.floor(c.maxSize));

  if (text.length === 0) {
    return {
      fontSize: maxSize,
      metrics: { width: 0, height: 0, lines: 0 },
      overflow: false,
    };
  }

  let lo = minSize;
  let hi = maxSize;
  let best: number | null = null;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (fits(measure(text, mid, c.maxWidth), c)) {
      best = mid;
      lo = mid + 1; // 더 크게 가능한지 탐색
    } else {
      hi = mid - 1;
    }
  }

  if (best === null) {
    // 최소 크기로도 안 들어간다 → 넘침을 알리고 최소 크기를 쓴다.
    return {
      fontSize: minSize,
      metrics: measure(text, minSize, c.maxWidth),
      overflow: true,
    };
  }

  return {
    fontSize: best,
    metrics: measure(text, best, c.maxWidth),
    overflow: false,
  };
}

// ─── Node 환경 근사 측정 ─────────────────────────────────────

/**
 * 문자별 폭 배수 (폰트 크기 대비).
 * 한글은 전각이라 폰트 크기와 거의 같은 폭을 차지하고,
 * 라틴 소문자는 절반 정도다. 이 차이를 무시하면 한글 카피가 항상 넘친다.
 */
const CHAR_WIDTH_RATIO = {
  /** 한글 음절, 한자, 전각 문자 */
  wide: 1,
  /** 라틴 대문자, 숫자 */
  upper: 0.62,
  /** 라틴 소문자 */
  lower: 0.52,
  /** 공백 */
  space: 0.28,
  /** 좁은 문자 (i, l, . , ! 등) */
  narrow: 0.28,
} as const;

const NARROW_CHARS = new Set([
  'i',
  'l',
  'I',
  'j',
  't',
  'f',
  '.',
  ',',
  ':',
  ';',
  '!',
  "'",
  '|',
  '(',
  ')',
  '[',
  ']',
]);

function charWidthRatio(ch: string): number {
  const code = ch.codePointAt(0) ?? 0;

  if (ch === ' ' || ch === ' ') {
    return CHAR_WIDTH_RATIO.space;
  }
  if (NARROW_CHARS.has(ch)) {
    return CHAR_WIDTH_RATIO.narrow;
  }

  // 한글 음절/자모, CJK, 전각 기호 범위
  const isWide =
    (code >= 0xac_00 && code <= 0xd7_a3) || // 한글 음절
    (code >= 0x11_00 && code <= 0x11_ff) || // 한글 자모
    (code >= 0x31_30 && code <= 0x31_8f) || // 호환 자모
    (code >= 0x4e_00 && code <= 0x9f_ff) || // CJK 통합 한자
    (code >= 0x30_00 && code <= 0x30_3f) || // CJK 기호
    (code >= 0xff_00 && code <= 0xff_60); // 전각 영숫자
  if (isWide) {
    return CHAR_WIDTH_RATIO.wide;
  }

  if (/[A-Z0-9]/u.test(ch)) {
    return CHAR_WIDTH_RATIO.upper;
  }
  return CHAR_WIDTH_RATIO.lower;
}

export function approxTextWidth(text: string, fontSizePx: number): number {
  let ratio = 0;
  for (const ch of text) {
    ratio += charWidthRatio(ch);
  }
  return ratio * fontSizePx;
}

/**
 * 한국어 줄바꿈을 반영한 근사 측정.
 *
 * 한국어는 `word-break: keep-all`이 표준이다(단어 중간에서 자르지 않는다).
 * 이걸 무시하고 문자 단위로 자르면 실제 렌더보다 줄 수를 적게 세어
 * 에디터와 내보내기 결과가 어긋난다.
 */
export function measureTextApprox(
  text: string,
  fontSizePx: number,
  maxWidth: number,
  lineHeight = 1.3,
): TextMetrics {
  if (text.length === 0) {
    return { width: 0, height: 0, lines: 0 };
  }

  const paragraphs = text.split('\n');
  let totalLines = 0;
  let widest = 0;

  for (const paragraph of paragraphs) {
    if (paragraph.length === 0) {
      totalLines += 1;
      continue;
    }

    // 공백 기준 단어 분리 (keep-all: 단어를 쪼개지 않는다)
    const words = paragraph.split(/(\s+)/u).filter((w) => w.length > 0);
    let lineWidth = 0;
    let lines = 1;

    for (const word of words) {
      const w = approxTextWidth(word, fontSizePx);

      // 단어 하나가 폭보다 길면 어쩔 수 없이 쪼갠다 (브라우저도 그렇게 한다)
      if (w > maxWidth) {
        if (lineWidth > 0) {
          widest = Math.max(widest, lineWidth);
          lines += 1;
          lineWidth = 0;
        }
        const chunks = Math.ceil(w / maxWidth);
        lines += chunks - 1;
        lineWidth = w - maxWidth * (chunks - 1);
        widest = Math.max(widest, maxWidth);
        continue;
      }

      if (lineWidth + w <= maxWidth) {
        lineWidth += w;
      } else {
        widest = Math.max(widest, lineWidth);
        lines += 1;
        // 줄 시작의 공백은 버린다
        lineWidth = /^\s+$/u.test(word) ? 0 : w;
      }
    }

    widest = Math.max(widest, lineWidth);
    totalLines += lines;
  }

  return {
    width: Math.min(widest, maxWidth),
    height: totalLines * fontSizePx * lineHeight,
    lines: totalLines,
  };
}

/** measureTextApprox를 MeasureFn 시그니처로 바인딩한다. */
export function approxMeasureFn(lineHeight: number): MeasureFn {
  return (text, fontSizePx, maxWidth) => measureTextApprox(text, fontSizePx, maxWidth, lineHeight);
}
