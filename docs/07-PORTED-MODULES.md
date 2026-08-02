# 07. 이식 모듈 — Toneflow → Panelo

기준일: 2026-08-02 · 출처: `C:\Claude\toneflow` (사용자 본인 프로젝트) · 원본 가이드 `toneflow/docs/PORTING_GUIDE.md`

Toneflow는 같은 문제(카드뉴스 생성)를 먼저 푼 우리 프로젝트다. 생성 파이프라인까지 동작하는 상태이고, 그중 **도메인 결합이 없는 부분부터 단계적으로** 옮긴다.

원본 가이드가 제시한 검증 기준을 그대로 따른다: **복사한 테스트가 수정 없이 통과해야 한다.** 통과시키려고 테스트를 고치면 그 시점에 이식이 잘못된 것이다.

---

## 1단계 — 완료 (기반부, 도메인 결합 0)

| 이식 모듈 | 위치 | 줄 수 | 테스트 |
|---|---|---|---|
| SlideDoc 원시 타입 | `src/lib/slidedoc/primitives.ts` | 114 | — |
| 기하 해석 (anchor → Rect) | `src/lib/slidedoc/geometry.ts` | 107 | **17건** |
| 레이어 스키마 | `src/lib/slidedoc/layers.ts` | 207 | — |
| 문서 스키마 + LLM 요약 | `src/lib/slidedoc/doc.ts` | 144 | **9건** |
| WCAG 대비·가독성 결정 | `src/lib/renderer/contrast.ts` | 305 | **41건** |
| 이진탐색 폰트 맞춤 | `src/lib/renderer/autofit.ts` | 216 | — |

**이식한 테스트 67건이 수정 없이 통과했다.** (전체 113 → 180건)

### 왜 이게 핵심 자산인가

**제약 기반 레이아웃.** 레이어를 절대좌표가 아니라 `LayoutBox`(anchor + 캔버스 대비 비율)로 저장한다. 그래서 4:5 → 9:16 → 1:1 변환에서 레이아웃이 깨지지 않는다. **Fan-out(원본 1개 → 채널별 컷 N개)이 우리 차별화 축 1번인데, 비율마다 디자인을 따로 만들지 않아도 되는 것이 바로 이 구조 덕분이다.**

**가독성 자동 결정.** 사진 위 텍스트가 사라지는 문제를 실측 휘도로 푼다. 원본 가이드가 강조한 규칙 하나는 반드시 지켜야 한다 — **글자색은 평균 휘도로, 오버레이 강도는 최악값(p90)으로** 정한다. 하나로 둘 다 정하면 반드시 실패한다(어두운 배경 위 밝은 피사체에서 실제로 겪은 사례).

### 이식하며 고친 것

1. **zod 3 → 4.** Toneflow는 zod 3. 하위 필드가 전부 기본값인 객체의 `.default({})`는 zod 4에서 출력 타입을 요구해 타입 오류가 난다. → `.prefault({})` 6곳.
2. **가드레일.** `contrast.ts` 주석에 벤치마킹 대상 이름이 1곳 있어 다시 썼다. `grep -ri mirr src/ tests/` → 0건 유지.
3. **정규식 `u` 플래그, `Number.parseInt`, 함수 스코프** 등 우리 린트 규칙에 맞춰 조정. 동작 변경 없음(테스트로 확인).
4. **테스트 단언 묶기.** `max-expects`·`no-conditional-expect` 때문에 `toMatchObject`로 묶었다. **단언 내용은 그대로**다.

### 남겨둔 부채

`oxlint.config.ts`의 `overrides`와 `knip.config.ts`의 `ignore`에 이식 디렉터리 예외가 있다.

- **린트**: 문서화 태그(`jsdoc/require-*`)·선언 순서(`no-use-before-define`)만 끈다. 정확성 규칙은 전부 켜둔 상태다. 각 모듈을 실제로 통합·리뷰할 때 하나씩 되돌린다.
- **knip**: 소비자(typeset·templates·renderer)가 2단계에 들어오기 전까지 export 대부분이 미사용으로 잡힌다. **2단계가 끝나면 두 항목을 지운다.**

---

## 2단계 — 완료 (조판 레이어)

| 이식 모듈 | 위치 | 줄 수 |
|---|---|---|
| 조판 + 레이어 충돌 감지 | `src/lib/renderer/typeset.ts` | 154 |
| 수직 스택 해석 (실측 y 배치) | `src/lib/renderer/stack.ts` | 144 |
| SlideDoc → CSS | `src/lib/renderer/css.ts` | 211 |
| SlideDoc → React 렌더 | `src/lib/renderer/SlideRenderer.tsx` | 294 |

**배럴 파일을 쓰지 않는다.** 원본은 `@toneflow/shared/slidedoc` 배럴로 가져왔지만, 우리 린트(`oxc/no-barrel-file`)가 이를 막는다. 각 심볼이 실제로 선언된 모듈(`layers` / `doc` / `geometry` / `primitives`)에서 직접 가져오도록 바꿨다.

`import * as React`는 제거했다. 원본 가이드가 패키지 경계를 넘을 때 필요하다고 경고한 것인데, 단일 Next 앱에서는 최신 JSX 변환이 처리한다.

## 3단계 — 완료 (템플릿 엔진)

`types` · `covers` · `bodies` · `registry` · `compose`를 `src/lib/renderer/`로. **`compose.test.ts`의 84개 비율 조합 검증이 수정 없이 통과.**

> ⚠️ 이 단계에서 용어를 과잉 정정했다가 되돌렸다. `SlideDoc`·`CardnewsPlan` 같은 이름을 `PanelDoc`·`DeckPlan`으로 바꿨는데, '슬라이드'·'카드뉴스'는 업계 공통 기능 명사이지 타사 브랜드가 아니다. `CLAUDE.md` §1에 경계를 명시해 뒀다.

> ⚠️ **포매터가 동작을 바꾼 사례.** 템플릿 선택 해시(FNV-1a)의 `charCodeAt`이 `codePointAt`으로 자동 변환됐다. 서로게이트 페어에서 해시가 달라져 같은 시드가 다른 템플릿을 고른다. 테스트로는 안 잡힌다. 되돌리고 주석을 남겼다. 린트가 제안한 `Math.trunc`도 `>>> 0`과 동등하지 않다.

## 4단계 — 완료 (JSONL 스트리밍 파서)

`src/lib/plan/schema.ts`(도메인 스키마) + `src/lib/plan/plan-parser.ts`. **테스트 11건 통과.**

파서는 **제공사 무관**이다. 남은 것은 Gemini 어댑터를 붙여 `parser.push(delta)`로 흘려 넣는 일뿐이다.

## 5단계 — 완료 (플래너)

`src/lib/plan/planner.ts` + `prompts/plan-prompt.ts`. 패키지 `ai` · `@ai-sdk/anthropic` 설치.

**Gemini가 아니라 Anthropic으로 갔다.** 제공된 키가 Anthropic이고 원본 코드도 Anthropic을 쓴다. AI SDK가 제공사를 추상화하므로 나중에 Gemini를 붙이려면 `@ai-sdk/google` 추가 + 모델 지정 한 줄이면 된다.

AI SDK v7 대응: `usage`가 `promptTokens/completionTokens` → `inputTokens/outputTokens`로 바뀌고 optional이 됐다. 비스트리밍 `generateObject` 폴백은 **일부러 마이그레이션하지 않고 표시만** 했다 — 원본이 14.6초로 측정한 느린 경로라, 이 폴백이 필요한지부터 따져야 한다.

## 6단계 — 완료 (스톡 이미지 + 저작권 원장)

| 이식 모듈 | 위치 | 테스트 |
|---|---|---|
| 밴드별 휘도 분석 | `src/lib/images/analyze.ts` | **23건** |
| 프로바이더 계약 | `src/lib/images/providers/types.ts` | — |
| Unsplash 프로바이더 | `src/lib/images/providers/unsplash.ts` | — |
| 검색·재랭킹·전처리 | `src/lib/images/source.ts` | — |

패키지 `sharp` 설치. 프로바이더 인터페이스가 **license 필드를 타입으로 강제**해서, 저작권 정보 없이 새 소스를 붙이면 컴파일 오류가 난다.

house rule 대응: `unsplash.ts`가 `process.env`를 직접 읽던 것을 `Env.ts` 경유로 바꿨다.

> **Unsplash 이용약관상 `reportUsage()`(다운로드 트리거) 호출은 의무다.** 지우지 말 것.

## 7단계 — 착수 전 결정 필요 (렌더 서비스)

**패키지 승인만으로는 부족한 단계다.** 이건 라이브러리가 아니라 **새 프로덕션 서비스**를 세우는 일이다.

원본이 이걸 별도 앱(`apps/render-service/`)으로 만든 이유는 명확하다 — **Next.js 서버리스 함수에 Chromium을 넣을 수 없고, 장시간 실행에도 부적합하다.** 로컬에서 되더라도 Vercel 배포에서 갈린다.

따라서 결정할 것:

| 항목 | 내용 |
|---|---|
| **호스팅** | Vercel 불가. Railway / Fly.io / Render / 컨테이너 중 선택 |
| **비용** | 상시 구동 인스턴스 요금이 새로 발생 |
| **인증** | 웹 앱 ↔ 렌더 서비스 간 공유 시크릿 |
| **대안** | Vercel에서 `@sparticuz/chromium` 같은 서버리스 Chromium을 시도할 수는 있으나, 콜드스타트와 50MB 번들 제한 문제가 따로 붙는다 |

**이식 자체는 `apps/render-service/` 통째로 복사라 가장 깔끔한 단위다.** 막힌 건 코드가 아니라 어디에 띄울지다.

챙길 디테일(원본 가이드):
- 스크린샷 전에 `document.fonts.ready`와 **모든 이미지 로드 완료**를 기다린다. 빠뜨리면 폴백 폰트로 렌더되거나 빈칸이 남는다
- `computeDocHash()`에 결과 픽셀에 영향을 주는 **모든** 입력을 넣는다. 하나라도 빠지면 바뀐 문서에 옛 이미지가 나간다

### 4단계에서 반드시 챙길 것 — 스트리밍 방식

원본 가이드의 실측이다. **구조화 출력(tool) 스트리밍은 첫 결과까지 14.6초, JSONL 텍스트 + 자체 파싱은 2.8초.** 제공사 API가 도구 호출의 JSON 델타를 12~14초 묶었다가 flush하기 때문이고, 스키마 필드 순서를 바꿔도 줄지 않는다.

Gemini에서도 같은지는 재측정해야 하지만, **파서 자체는 제공사 무관**이라 먼저 옮겨두면 손해가 없다.

### 이식하지 않을 것

| 대상 | 이유 |
|---|---|
| Toneflow 크레딧 원장 | **우리가 이미 만들었다.** 우리 쪽은 잔액 캐시 컬럼이 없고 항상 `SUM(delta)`라 재검증 배치가 필요 없다. 다만 Toneflow의 `hold → settle/release`(부분 사용분만 확정) 패턴은 Run 단위 과금에 유용하니 1-D에서 참고한다 |
| `.env` 로더 | 우리는 `Env.ts` + Zod 검증을 쓴다 |
| `workspace.ts`, 로컬 FS 스토리지, `CreateWizard.tsx`, 데모 데이터 | 원본 가이드 §5가 이식 금지로 지정 |
| 미구현 기능의 DB 테이블 | 스키마만 있고 쓰는 코드가 없다 |
