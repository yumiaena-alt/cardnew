/** @jsxImportSource react */
// React를 명시적으로 import하는 이유:
// 이 파일은 여러 빌더(tsx, Next.js, vitest)가 각자의 tsconfig로 컴파일한다.
// 패키지 경계를 넘으면 jsx 설정이 전달되지 않아 classic 런타임(React.createElement)으로
// 떨어지는 경우가 있는데(→ "React is not defined"), 명시적 import는 두 런타임 모두에서 안전하다.
import type { CSSProperties, ReactElement } from 'react';
import type { SlideDoc } from '@/lib/slidedoc/doc';
import { docCanvasSize } from '@/lib/slidedoc/doc';
import type {
  ImageLayer,
  Layer,
  LogoLayer,
  ShapeLayer,
  TextLayer,
  VideoLayer,
} from '@/lib/slidedoc/layers';
import {
  canvasCss,
  docFontScale,
  gradientToCss,
  imageCss,
  layerPositionCss,
  paintToCss,
  textStyleCss,
} from './css';

/**
 * SlideRenderer — SlideDoc을 그리는 유일한 컴포넌트.
 *
 * 에디터(브라우저)와 렌더 서비스(Playwright)가 **같은 이 컴포넌트**를 쓴다.
 * 이게 "에디터 = 내보내기 픽셀 동일"(차별점 #3)의 구현이다.
 * Fabric.js/Konva 같은 canvas 라이브러리를 택하지 않은 이유가 여기에 있다 —
 * 그쪽은 한글 줄바꿈·자간·폰트 폴백이 브라우저 CSS와 미묘하게 달라
 * 에디터와 결과물이 어긋난다.
 *
 * 이 컴포넌트는 순수 표시 전용이다. 선택 핸들·드래그 같은 편집 UI는
 * 에디터가 이 위에 절대 위치로 겹쳐서 올린다.
 */

export type SlideRendererProps = {
  doc: SlideDoc;
  /**
   * 렌더 배수. 1이면 논리 크기(base 1080 기준), 2면 2배 해상도.
   * 에디터 미리보기는 컨테이너에 맞춘 작은 값, 내보내기는 1~2를 쓴다.
   */
  scale?: number;
  /**
   * autoFit이 확정한 레이어별 폰트 크기. 조판 엔진 결과를 넘긴다.
   * 없으면 style.size를 그대로 쓴다 (에디터에서 사용자가 직접 지정한 경우).
   */
  fittedSizes?: Record<string, number>;
  /** 워터마크 표시 (Free 플랜) */
  watermark?: boolean;
  /** 루트 요소에 붙일 id. 렌더 서비스가 screenshot 대상을 찾을 때 쓴다. */
  rootId?: string;
  className?: string;
};

export function SlideRenderer({
  doc,
  scale = 1,
  fittedSizes,
  watermark = false,
  rootId = 'slide-root',
  className,
}: SlideRendererProps): ReactElement {
  const logical = docCanvasSize(doc);
  const canvas = {
    width: logical.width * scale,
    height: logical.height * scale,
  };
  const fScale = docFontScale(doc, canvas);

  return (
    <div
      id={rootId}
      className={className}
      style={canvasCss(doc, canvas)}
      data-slide-role={doc.role}
    >
      {doc.layers.map((layer) =>
        layer.hidden ? null : (
          <LayerView
            key={layer.id}
            layer={layer}
            canvas={canvas}
            fontScale={fScale}
            fittedSize={fittedSizes?.[layer.id]}
          />
        ),
      )}
      {watermark ? <Watermark scale={fScale} /> : null}
    </div>
  );
}

type LayerViewProps = {
  layer: Layer;
  canvas: { width: number; height: number };
  fontScale: number;
  fittedSize?: number;
};

function LayerView({ layer, canvas, fontScale, fittedSize }: LayerViewProps): ReactElement | null {
  switch (layer.type) {
    case 'text': {
      return (
        <TextLayerView
          layer={layer}
          canvas={canvas}
          fontScale={fontScale}
          fittedSize={fittedSize}
        />
      );
    }
    case 'image': {
      return <ImageLayerView layer={layer} canvas={canvas} fontScale={fontScale} />;
    }
    case 'shape': {
      return <ShapeLayerView layer={layer} canvas={canvas} fontScale={fontScale} />;
    }
    case 'logo': {
      return <LogoLayerView layer={layer} canvas={canvas} />;
    }
    case 'video': {
      return <VideoLayerView layer={layer} canvas={canvas} />;
    }
  }
}

function TextLayerView({
  layer,
  canvas,
  fontScale,
  fittedSize,
}: {
  layer: TextLayer;
  canvas: { width: number; height: number };
  fontScale: number;
  fittedSize?: number;
}): ReactElement {
  const position = layerPositionCss(layer, canvas);
  const text = textStyleCss(layer.style, fontScale, fittedSize);

  const { highlight } = layer.style;
  const highlightStyle: CSSProperties =
    highlight?.style === 'marker'
      ? {
          // 텍스트 줄에만 배경이 깔리도록 inline box로 만든다
          background: `linear-gradient(transparent 55%, ${highlight.color} 55%)`,
          display: 'inline',
        }
      : highlight?.style === 'box'
        ? { background: highlight.color, display: 'inline', padding: '0 0.15em' }
        : highlight?.style === 'underline'
          ? {
              borderBottom: `${0.08 * (fittedSize ?? layer.style.size) * fontScale}px solid ${highlight.color}`,
              display: 'inline',
            }
          : {};

  return (
    <div style={position} data-layer-id={layer.id} data-layer-role={layer.role}>
      <p style={text}>
        {highlight ? <span style={highlightStyle}>{layer.text}</span> : layer.text}
      </p>
    </div>
  );
}

function ImageLayerView({
  layer,
  canvas,
  fontScale,
}: {
  layer: ImageLayer;
  canvas: { width: number; height: number };
  fontScale: number;
}): ReactElement {
  // 배경 역할이면 h가 없어도 캔버스 전체를 덮어야 한다.
  const position: CSSProperties =
    layer.role === 'background' && layer.layout.h === undefined
      ? { position: 'absolute', inset: 0, opacity: layer.opacity !== 1 ? layer.opacity : undefined }
      : layerPositionCss(layer, canvas);

  return (
    <div
      style={{ ...position, overflow: 'hidden' }}
      data-layer-id={layer.id}
      data-layer-role={layer.role}
    >
      {layer.src ? (
        <img
          src={layer.src}
          alt=""
          style={imageCss(layer, fontScale)}
          // 렌더 결정론성: 지연 로딩이면 screenshot 시점에 안 그려질 수 있다.
          loading="eager"
          decoding="sync"
        />
      ) : (
        <div style={{ width: '100%', height: '100%', background: '#E9E7E3' }} />
      )}
      {layer.overlay ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: gradientToCss(layer.overlay),
            pointerEvents: 'none',
          }}
          data-overlay-for={layer.id}
        />
      ) : null}
    </div>
  );
}

function ShapeLayerView({
  layer,
  canvas,
  fontScale,
}: {
  layer: ShapeLayer;
  canvas: { width: number; height: number };
  fontScale: number;
}): ReactElement {
  const position = layerPositionCss(layer, canvas);
  const radius =
    layer.shape === 'ellipse'
      ? '50%'
      : layer.radius > 0
        ? `${layer.radius * fontScale}px`
        : undefined;

  return (
    <div
      style={{
        ...position,
        height:
          layer.shape === 'line'
            ? `${Math.max(1, (layer.stroke?.width ?? 2) * fontScale)}px`
            : position.height,
        background:
          layer.shape === 'line'
            ? (layer.stroke?.color ?? paintToCss(layer.fill))
            : paintToCss(layer.fill),
        borderRadius: radius,
        border:
          layer.shape !== 'line' && layer.stroke
            ? `${layer.stroke.width * fontScale}px solid ${layer.stroke.color}`
            : undefined,
      }}
      data-layer-id={layer.id}
      data-layer-role={layer.role}
    />
  );
}

function LogoLayerView({
  layer,
  canvas,
}: {
  layer: LogoLayer;
  canvas: { width: number; height: number };
}): ReactElement {
  const position = layerPositionCss(layer, canvas);
  return (
    <div style={position} data-layer-id={layer.id} data-layer-role="logo">
      {layer.src ? (
        <img
          src={layer.src}
          alt=""
          style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'contain' }}
          loading="eager"
          decoding="sync"
        />
      ) : null}
    </div>
  );
}

function VideoLayerView({
  layer,
  canvas,
}: {
  layer: VideoLayer;
  canvas: { width: number; height: number };
}): ReactElement {
  const position: CSSProperties =
    layer.role === 'background' && layer.layout.h === undefined
      ? { position: 'absolute', inset: 0 }
      : layerPositionCss(layer, canvas);

  // 스틸 렌더(카드뉴스 내보내기)에서는 poster를 그린다.
  // 실제 영상 재생은 Phase 4 Remotion 파이프라인이 담당한다.
  return (
    <div
      style={{ ...position, overflow: 'hidden' }}
      data-layer-id={layer.id}
      data-layer-role={layer.role}
    >
      {layer.posterSrc ? (
        <img
          src={layer.posterSrc}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: layer.fit, display: 'block' }}
          loading="eager"
          decoding="sync"
        />
      ) : (
        <div style={{ width: '100%', height: '100%', background: '#1A1A1A' }} />
      )}
    </div>
  );
}

function Watermark({ scale }: { scale: number }): ReactElement {
  return (
    <div
      data-watermark="true"
      style={{
        position: 'absolute',
        right: `${20 * scale}px`,
        bottom: `${18 * scale}px`,
        fontFamily: 'Pretendard, sans-serif',
        fontSize: `${22 * scale}px`,
        fontWeight: 600,
        letterSpacing: '-0.01em',
        color: '#FFFFFF',
        opacity: 0.85,
        textShadow: `0 ${1 * scale}px ${6 * scale}px rgba(0,0,0,0.45)`,
        pointerEvents: 'none',
      }}
    >
      Toneflow
    </div>
  );
}
