import type { CSSProperties } from 'react';
import type { SlideDoc } from '@/lib/slidedoc/doc';
import { focusToObjectPosition, fontScale } from '@/lib/slidedoc/geometry';
import type { CanvasBox } from '@/lib/slidedoc/geometry';
import type { Layer } from '@/lib/slidedoc/layers';

/**
 * SlideDoc → CSS 변환.
 *
 * 에디터와 서버 렌더러가 이 함수를 공유해야 한다(차별점 #3).
 * 두 곳에서 따로 CSS를 만들면 "에디터에서는 맞았는데 내보내니 틀어진" 버그가 생기고,
 * 이건 사용자 신뢰를 가장 빠르게 깎는 버그 유형이다.
 */

export type PaintLike = SlideDoc['canvas']['bg'];

export function paintToCss(paint: PaintLike): string {
  switch (paint.kind) {
    case 'none': {
      return 'transparent';
    }
    case 'solid': {
      return paint.color;
    }
    case 'gradient': {
      return gradientToCss(paint);
    }
  }
}

export type GradientLike = {
  type: 'linear' | 'radial';
  angle: number;
  stops: { at: number; color: string }[];
};

export function gradientToCss(gradient: GradientLike): string {
  const stops = gradient.stops.map((s) => `${s.color} ${(s.at * 100).toFixed(2)}%`).join(', ');
  return gradient.type === 'linear'
    ? `linear-gradient(${gradient.angle}deg, ${stops})`
    : `radial-gradient(circle at center, ${stops})`;
}

/** CSS filter 문자열. 기본값(1 또는 0)인 항목은 생략해 렌더 비용을 아낀다. */
export function filterToCss(filter: {
  brightness: number;
  contrast: number;
  saturate: number;
  blur: number;
  grayscale: number;
}): string | undefined {
  const parts: string[] = [];
  if (filter.brightness !== 1) {
    parts.push(`brightness(${filter.brightness})`);
  }
  if (filter.contrast !== 1) {
    parts.push(`contrast(${filter.contrast})`);
  }
  if (filter.saturate !== 1) {
    parts.push(`saturate(${filter.saturate})`);
  }
  if (filter.blur !== 0) {
    parts.push(`blur(${filter.blur}px)`);
  }
  if (filter.grayscale !== 0) {
    parts.push(`grayscale(${filter.grayscale})`);
  }
  return parts.length > 0 ? parts.join(' ') : undefined;
}

/**
 * 레이어의 위치·크기 CSS.
 *
 * 중요: top/left를 계산해서 넣지 않고 **앵커에 맞는 CSS 속성**을 쓴다.
 *  - 하단 앵커 → `bottom` 오프셋. 그래야 높이를 모르는 텍스트가 위로 자란다.
 *  - 우측 앵커 → `right` 오프셋. 그래야 폭이 바뀌어도 우측 정렬이 유지된다.
 *  - 중앙 앵커 → 50% + translate(-50%).
 *
 * top을 계산해 넣으면 h가 없는 텍스트(실측 높이 0)가 캔버스 아래로 흘러나간다.
 * 이 방식은 측정 없이 브라우저가 알아서 처리하므로 SSR에서도 정확하다.
 *
 * resolveRect는 여전히 조판·안전영역 검증·히트테스트에 쓰인다(높이가 확정된 경우).
 */
export function layerPositionCss(layer: Layer, canvas: CanvasBox): CSSProperties {
  const { anchor, x, y, w, h, rotate } = layer.layout;

  const isBottom = anchor.startsWith('bottom-');
  const isRight = anchor.endsWith('-right');
  const isHCenter = anchor === 'center' || anchor.endsWith('-center');
  const isVCenter = anchor === 'center' || anchor.startsWith('middle-');

  const offsetX = x * canvas.width;
  const offsetY = y * canvas.height;

  const translates: string[] = [];
  if (isHCenter) {
    translates.push('translateX(-50%)');
  }
  if (isVCenter) {
    translates.push('translateY(-50%)');
  }
  if (rotate !== 0) {
    translates.push(`rotate(${rotate}deg)`);
  }
  if (layer.type === 'image' && (layer.flipX || layer.flipY)) {
    translates.push(`scale(${layer.flipX ? -1 : 1}, ${layer.flipY ? -1 : 1})`);
  }

  // 가로: 중앙 / 우측 / 좌측
  const horizontal: CSSProperties = isHCenter
    ? { left: `calc(50% + ${offsetX}px)` }
    : isRight
      ? { right: `${offsetX}px` }
      : { left: `${offsetX}px` };

  // 세로: 중앙 / 하단 / 상단
  const vertical: CSSProperties = isVCenter
    ? { top: `calc(50% + ${offsetY}px)` }
    : isBottom
      ? { bottom: `${offsetY}px` }
      : { top: `${offsetY}px` };

  return {
    position: 'absolute',
    ...horizontal,
    ...vertical,
    width: `${w * canvas.width}px`,
    ...(h !== undefined ? { height: `${h * canvas.height}px` } : {}),
    opacity: layer.opacity !== 1 ? layer.opacity : undefined,
    ...(translates.length > 0
      ? { transform: translates.join(' '), transformOrigin: 'center' }
      : {}),
  };
}

export type TextStyleLike = {
  family: string;
  weight: number;
  size: number;
  color: string;
  align: 'left' | 'center' | 'right';
  lineHeight: number;
  letterSpacing: number;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  transform: 'none' | 'upper' | 'lower';
  shadow?: { x: number; y: number; blur: number; color: string };
};

/**
 * 텍스트 스타일 CSS.
 *
 * @param resolvedSize autoFit이 확정한 폰트 크기. 없으면 style.size를 쓴다.
 * @param scale 캔버스 스케일 배수 (base 대비 실제 렌더 크기)
 */
export function textStyleCss(
  style: TextStyleLike,
  scale: number,
  resolvedSize?: number,
): CSSProperties {
  const size = (resolvedSize ?? style.size) * scale;

  const decorations: string[] = [];
  if (style.underline) {
    decorations.push('underline');
  }
  if (style.strike) {
    decorations.push('line-through');
  }

  return {
    fontFamily: `"${style.family}", Pretendard, -apple-system, "Malgun Gothic", sans-serif`,
    fontWeight: style.weight,
    fontSize: `${size}px`,
    color: style.color,
    textAlign: style.align,
    lineHeight: style.lineHeight,
    letterSpacing: `${style.letterSpacing}em`,
    fontStyle: style.italic ? 'italic' : 'normal',
    textDecoration: decorations.length > 0 ? decorations.join(' ') : 'none',
    textTransform:
      style.transform === 'upper'
        ? 'uppercase'
        : style.transform === 'lower'
          ? 'lowercase'
          : 'none',
    textShadow: style.shadow
      ? `${style.shadow.x * scale}px ${style.shadow.y * scale}px ${style.shadow.blur * scale}px ${style.shadow.color}`
      : undefined,
    // 한국어 조판 필수: 단어 중간에서 줄바꿈하지 않는다.
    wordBreak: 'keep-all',
    overflowWrap: 'break-word',
    whiteSpace: 'pre-wrap',
    margin: 0,
  };
}

export type ImageLayerLike = {
  fit: 'cover' | 'contain';
  focus: { x: number; y: number };
  scale: number;
  radius: number;
  filter: {
    brightness: number;
    contrast: number;
    saturate: number;
    blur: number;
    grayscale: number;
  };
};

export function imageCss(layer: ImageLayerLike, scale: number): CSSProperties {
  return {
    width: '100%',
    height: '100%',
    objectFit: layer.fit,
    objectPosition: focusToObjectPosition(layer.focus),
    borderRadius: layer.radius > 0 ? `${layer.radius * scale}px` : undefined,
    filter: filterToCss(layer.filter),
    ...(layer.scale !== 1 ? { transform: `scale(${layer.scale})` } : {}),
    display: 'block',
  };
}

/** 캔버스 루트 컨테이너 CSS. */
export function canvasCss(doc: SlideDoc, canvas: CanvasBox): CSSProperties {
  return {
    position: 'relative',
    width: `${canvas.width}px`,
    height: `${canvas.height}px`,
    background: paintToCss(doc.canvas.bg),
    overflow: 'hidden',
    // 렌더 결정론성: 텍스트 크기 자동 조정을 브라우저가 개입하지 못하게 막는다.
    WebkitTextSizeAdjust: '100%',
    textSizeAdjust: '100%',
  } as CSSProperties;
}

/** 문서 기준 폰트 스케일. */
export function docFontScale(doc: SlideDoc, canvas: CanvasBox): number {
  return fontScale(canvas, doc.canvas.base);
}
