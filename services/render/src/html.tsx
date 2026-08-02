/** @jsxImportSource react */
import { renderToStaticMarkup } from 'react-dom/server';
import { SlideRenderer } from '../../../src/lib/renderer/SlideRenderer';
import type { SlideRendererProps } from '../../../src/lib/renderer/SlideRenderer';
import { docCanvasSize } from '../../../src/lib/slidedoc/doc';
import type { SlideDoc } from '../../../src/lib/slidedoc/doc';

/**
 * SlideDoc → 완전한 정적 HTML 문서.
 *
 * 여기서 앱과 **동일한 SlideRenderer**를 SSR한다(차별점 #3).
 * Playwright는 이 HTML을 열어 스크린샷만 찍는다 —
 * 렌더 로직이 서버에 따로 존재하지 않으므로 두 결과가 어긋날 수 없다.
 */

export const SLIDE_ROOT_ID = 'slide-root';

export type BuildHtmlOptions = {
  doc: SlideDoc;
  scale?: number;
  fittedSizes?: Record<string, number>;
  watermark?: boolean;
  /** 폰트 파일이 있는 기준 URL/경로. 없으면 시스템 폰트로 폴백한다. */
  fontBaseUrl?: string;
};

export function buildSlideHtml(options: BuildHtmlOptions): string {
  const { doc, scale = 1, fittedSizes, watermark = false, fontBaseUrl } = options;
  const logical = docCanvasSize(doc);
  const width = Math.round(logical.width * scale);
  const height = Math.round(logical.height * scale);

  const props: SlideRendererProps = {
    doc,
    scale,
    rootId: SLIDE_ROOT_ID,
    ...(fittedSizes ? { fittedSizes } : {}),
    watermark,
  };

  const body = renderToStaticMarkup(<SlideRenderer {...props} />);

  return `<!doctype html>
<html lang="${doc.layers.length > 0 ? 'ko' : 'ko'}">
<head>
<meta charset="utf-8">
<title>slide</title>
<style>
  ${fontBaseUrl ? fontFaces(fontBaseUrl) : ''}
  *, *::before, *::after { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    width: ${width}px;
    height: ${height}px;
    overflow: hidden;
    background: #FFFFFF;
    /* 렌더 결정론성: 안티앨리어싱을 고정해 플랫폼 간 차이를 줄인다 */
    -webkit-font-smoothing: antialiased;
    text-rendering: geometricPrecision;
  }
  img { -webkit-user-drag: none; }
</style>
</head>
<body>${body}</body>
</html>`;
}

/**
 * 로컬 폰트 파일 @font-face.
 * 컨테이너에 폰트를 설치하기 전까지는 fontBaseUrl을 넘기지 않고
 * 시스템 한글 폰트(Malgun Gothic 등)로 폴백한다.
 */
function fontFaces(baseUrl: string): string {
  const specs = [
    { family: 'Pretendard', file: 'Pretendard', weights: [400, 500, 600, 700, 800, 900] },
    { family: 'Noto Serif KR', file: 'NotoSerifKR', weights: [400, 500, 700, 900] },
  ];
  return specs
    .flatMap((s) =>
      s.weights.map(
        (w) =>
          `@font-face{font-family:"${s.family}";font-weight:${w};font-style:normal;font-display:block;src:url("${baseUrl}/${s.file}-${w}.woff2") format("woff2");}`,
      ),
    )
    .join('\n  ');
}
