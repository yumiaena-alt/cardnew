@AGENTS.md

# Panelo — 프로젝트 가이드라인

> 위 `AGENTS.md`가 베이스 컨벤션이다. 이 문서는 **Panelo 고유 규칙**만 담는다. 충돌 시 이 문서가 우선한다.
> 상세 설계는 [`docs/`](docs/README.md) 참조. 구현 전 해당 문서를 먼저 읽는다.

## 1. 프로젝트 개요

**Panelo** — 혼자 여러 SNS 채널을 운영하는 1인 사업자가, 한 달에 한 번 앉아서 한 달치 카드뉴스를 만들고 예약까지 끝내는 도구.

### 차별화 축
1. **Fan-out** — 소재 1개 → 인스타/릴스/스레드/블로그로 자동 분기 (원본 15cr, 파생 5cr)
2. **월간 배치 세션** — 캘린더 빈칸 감지 → Board에서 한 달치 일괄 생성
3. **Dry-run 견적** — 크레딧 차감 전 항상 견적 노출

### 용어 (코드·UI·DB 전반에서 이 단어만 사용)
| 용어 | 정의 | 테이블 |
|---|---|---|
| **Panel** | 카드 1장 | `panels` |
| **Deck** | 카드뉴스 1건 | `decks` |
| **Cut** | 소재 1개에서 파생된 채널별 변형 | `board_row_outputs` |
| **Board** | 여러 Deck을 다루는 스프레드시트 | `boards` |
| **Run** | 생성 실행 1회 = 크레딧 차감 단위 | `runs` |
| **Slot** | Panel 내 편집 최소 단위 | `panels.slots` |

**위 표는 코드 식별자·DB 테이블명에만 적용된다.** `panels`·`decks`는 이미 프로덕션에 마이그레이션된 테이블명이라 바꾸지 않는다.

**사용자에게 보이는 한국어는 업계 표준 용어를 그대로 쓴다.** 이걸 영어나 억지 조어로 바꾸지 않는다.

| 화면에 쓸 말 | 쓰지 말 것 |
|---|---|
| 카드뉴스, 슬라이드, 장 (10장 카드뉴스) | 덱, Deck, 패널, Panel |
| 소재, 콘텐츠, 템플릿 | 애셋, Asset, 콘텐츠 박스 |
| 예약 발행, 월간 보드 | Publishing Deck, Board |
| 인스타, 릴스, 스레드, 숏폼, 크레딧 | (그대로 쓴다) |

'카드뉴스'·'슬라이드'·'릴스'·'템플릿'은 **업계 공통 기능 명사**이지 타사 브랜드가 아니다. 배제 대상은 **벤치마킹 대상의 실제 상표명·회사명·고유 로고 문구뿐**이다.

### 기술 스택 (확정 · 변경 금지)
Next.js 16 App Router · React 19 (Compiler) · TypeScript strict · Supabase(PostgreSQL) · **Drizzle ORM** · Clerk Auth(+Organizations) · Tailwind v4 · next-intl · Base UI + cva · Framer Motion(`motion`) · Arcjet · Sentry · Trigger.dev v3

**Prisma를 쓰지 않는다.** 모든 DB 접근은 Drizzle.

## 2. 디자인 시스템

전문: [`docs/05-DESIGN-SYSTEM.md`](docs/05-DESIGN-SYSTEM.md)

### 컬러 — 시맨틱 토큰만 사용

Hex를 코드에 직접 쓰지 않는다. `global.css`의 `:root`/`.dark`에 정의하고 Tailwind 유틸리티로만 접근한다.

| 역할 | 토큰 | Light | Dark | 용도 |
|---|---|---|---|---|
| **Main** | `--primary` | `#14140F` 잉크 | `#EDEBE4` | 주요 버튼·아이콘·아바타 |
| **Accent** | `--signal` | `#C8F751` 라임 | 동일 | **AI 개입 지점 전용** |
| **Secondary** | `--secondary` | `#F7E4DC` 클레이 | `#3A241C` | 보조 강조·크레딧 |
| **Neutral** | `--background` | `#FBFAF7` 웜 페이퍼 | `#111310` | 배경 |
| | `--card` | `#FFFFFF` | `#1B1E19` | 카드 표면 |
| | `--muted` / `--accent` | `#F2F0EA` | `#22261F` / `#262B22` | 비활성·hover |
| | `--border` / `--input` | `#E4E0D6` | `#2C3129` | 라인 |
| | `--muted-foreground` | `#5C5A52` | `#9A968A` | 보조 텍스트 |
| **Focus** | `--ring` | `#8FBF12` | `#A9DC2E` | 포커스 링 |
| Semantic | `--destructive` `--success` `--warning` `--info` | | | 상태 |
| Sidebar | `--sidebar*` | | | 셸 전용 |
| Status | `--status-{wait,draft,done,fail}[-border\|-foreground]` | | | Board 행 상태 |

**`--signal` 사용 규칙 (엄격)**: AI 생성 버튼, 생성 진행 바, DryRunPanel 실행 버튼, 포커스 링. **장식으로 쓰지 않는다.** 라임이 보이면 "AI가 뭔가 한다"는 뜻이어야 한다.

**대비**: `--signal` 위에는 반드시 `--signal-foreground`(잉크). 라임 위 흰 글자 금지.

### 타이포그래피
- 본문·UI: `--font-sans` = Pretendard Variable (400·500·600)
- 디스플레이: `--font-display` = Instrument Serif + Pretendard — **마케팅 라우트에서만**
- 수치·크레딧: `--font-mono` = JetBrains Mono + **`tabular-nums` 필수**

### 반응형
브레이크포인트 **320 / 768 / 1024 / 1440 / 1920**.
- 셸: 사이드바 `w-64`, 톱바 `h-14`, 메인 `p-4 md:p-6 lg:p-8`
- 콘텐츠 `max-w-6xl` — **단 Board는 전폭**
- **Board는 `lg`(1024px) 미만에서 시트 대신 카드 리스트로 폴백**

### 라운드 (의도적 비균일)
`--radius-sm 6` / `--radius-md 8`(필드·버튼) / `--radius-lg 12`(카드) / `--radius-xl 20`(모달) / `rounded-full`(칩)

### 컴포넌트 패턴
`src/components/ui/Button.tsx` 패턴을 표준으로 삼는다.
```
Base UI 프리미티브 → cva(variant/size) → cn() 병합 → data-slot 부여 → focus-visible 링 공통
```
- 그림자보다 **1px 라인** 우선. 그림자는 hover·오버레이에만
- hover/focus/active를 각각 다르게 설계
- 모션은 `transform`·`opacity`·`clip-path`만. width/height/top/left 금지
- `useReducedMotion()`은 전역 래퍼에서 처리. 개별 컴포넌트에서 분기하지 않는다

## 3. 구조 · 컨벤션

### 폴더
```
src/
├─ app/[locale]/(marketing)|(auth)/dashboard/…   라우트
├─ components/ui|dashboard|board|deck|motion/    UI (클라이언트 허용)
├─ features/<domain>/                            서버 전용 도메인 로직
│    ├─ repository.ts   DB 접근은 여기서만
│    ├─ service.ts      비즈니스 로직
│    └─ *.test.ts
├─ models/                                       Drizzle 스키마 (도메인별 분리)
├─ libs/                                         DB·Env·Storage·Queue·I18n
├─ locales/                                      ko.json(기본) · en.json(i18n-check 소스)
└─ validations/                                  Zod 스키마
```

### Server / Client 분리
- **기본은 Server Component.** `'use client'`는 상태·이벤트·브라우저 API가 필요할 때만
- `features/*`는 **서버 전용**. 클라이언트 컴포넌트에서 import 금지
- 데이터 페칭은 RSC 또는 Server Action. 클라이언트 캐시 라이브러리를 새로 도입하지 않는다
- 필터·정렬·페이지 상태는 **URL SearchParams**가 단일 진실원천

### Drizzle
```ts
// 모든 테이블은 전용 스키마 cardnews 소속. pgTable을 직접 쓰지 않는다.
import { cardnews } from './Namespace';

export const decks = cardnews.table('decks', { ... });

// 타입은 스키마에서 추론한다. 수기 인터페이스 중복 정의 금지
export type Deck = typeof decks.$inferSelect;
export type NewDeck = typeof decks.$inferInsert;
```
- jsonb는 반드시 `.$type<T>()`로 고정. 스키마 없는 jsonb 금지
- 조직 데이터를 담는 테이블은 `orgId`를 **직접** 보유 (조인 없이 격리 필터가 걸리도록)
- 마이그레이션 SQL은 **사람이 리뷰한 뒤** 커밋. 파괴적 변경은 expand → backfill → contract 3단계
- 잔액·집계 컬럼을 두지 않는다. 크레딧 잔액은 항상 `SUM(delta)`

### Zod 검증
- 모든 시스템 경계(Server Action 인자, API body, searchParams, 외부 API 응답)에서 파싱
- 타입은 `z.infer`로 도출. 수기 중복 정의 금지
- 타입으로만 쓸 때는 `import type * as z from 'zod'`

### Clerk Auth
```ts
// 조직 범위는 서버 auth()에서만 확정한다. 클라이언트가 보낸 orgId는 절대 신뢰하지 않는다.
const { userId, orgId, orgRole } = await auth();
```
- UI는 Clerk 컴포넌트 사용: `<SignIn/>` `<SignUp/>` `<UserButton/>` `<OrganizationSwitcher/>`
- 서버 진입점마다 `getScope()` → `requirePermission(...)` 순서로 검증
- 리포지토리 함수는 **첫 인자로 `Scope`를 받고**, 모든 쿼리에 `eq(table.orgId, scope.orgId)`를 포함
- 웹훅은 Svix 서명 검증 **후에** 본문을 파싱. `webhook_events`로 멱등 처리

### 에러 · 로깅
- 불필요한 `try/catch` 금지. 처리할 수 있을 때만 잡는다
- 에러를 삼키지 않는다. 도메인 에러는 명시적 타입(`UnauthorizedError` 등)
- 로깅은 **LogTape**. `console.log` 금지
- 모든 로그에 상관관계 ID(`orgId`, `runId`) 포함
- 사용자 노출 메시지는 i18n 키로. 짧게, "다시 시도해 주세요" 변형 금지
- 서버 로그에 PII·토큰을 남기지 않는다

## 4. Git · 패키지

### 커밋
Conventional Commits, **scope 없음**: `type: 무엇이 어디서 왜 바뀌었는지`
`feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert` · 필요 시 `BREAKING CHANGE:` 푸터

```
feat: add fan-out expansion for board rows
fix: prevent duplicate credit charge on run retry
```
❌ `update code`, `fix bug`, `wip`

### 스크립트 (이것만 사용)
`build-local` · `lint` · `check:types` · `check:deps` · `check:i18n` · `test` · `test:e2e`
DB 작업이 필요할 때만 `db:generate` · `db:migrate`

### 머지 게이트
`lint → check:types → check:i18n → check:deps → test → build-local → test:e2e` 전부 통과

### 신규 패키지 설치 절차
1. **먼저 물어본다.** 설치 전 사용자 승인 필수
2. 승인 요청 시 함께 제시: ① 왜 필요한가 ② 기존 의존성으로 대체 가능한가 ③ 번들 영향 ④ 유지보수 상태(최근 릴리스·다운로드)
3. 승인 후 설치 → `check:deps`(knip) 통과 확인
4. 설계 문서에서 이미 합의된 패키지(`docs/02-ARCHITECTURE.md` 갭 목록)는 사전 승인된 것으로 본다

## 5. 절대 금지사항 (Guardrails)

### 🚫 벤치마킹 자산 복제
- 벤치마킹 대상(Mirr)의 **CSS·색상값·클래스 조합·레이아웃 수치·문구·아이콘·이미지를 복사하지 않는다**
- 루트에 있던 v0 산출물은 **구조만** 차용하고 색상값·IA·문구는 전면 교체한다
- **`mirr` 문자열이 코드·문구·에셋·주석에 남아 있으면 안 된다.** 머지 전 `grep -ri mirr src/` 결과 0건
- 참고는 "기능이 무엇을 해결하는가" 수준까지. 표현(expression)은 우리 것으로 새로 만든다

### 🚫 하드코딩
- 색상 Hex·폰트명·간격 수치를 컴포넌트에 직접 쓰지 않는다 → `global.css` 토큰
- 사용자 노출 문자열을 하드코딩하지 않는다 → next-intl 키 (`check:i18n`이 CI에서 차단)
- 크레딧 단가·플랜 한도를 코드에 흩지 않는다 → `plan_limits` 테이블 / 상수 모듈
- 매직 넘버 금지 → 명명된 상수

### 🚫 보안
- **시크릿을 코드·`.env`에 쓰지 않는다.** `.env`는 git 추적 대상이다 — 공개 값(`NEXT_PUBLIC_*`)만 넣고, 시크릿은 **`.env.local`**(gitignore 대상)에 둔다
- `process.env`를 직접 읽지 않는다 → 전부 `src/libs/Env.ts`에서 Zod 검증
- SNS 액세스 토큰은 애플리케이션 레벨 암호화 후 저장. 평문 금지
- 클라이언트가 보낸 `orgId`·`userId`·`role`을 신뢰하지 않는다
- 서명 검증 없는 웹훅 처리 금지

### 🚫 데이터 무결성
- 크레딧 차감 경로에 **`DryRunPanel`을 거치지 않는 것**이 있으면 안 된다
- 멱등키 없는 생성·과금·발행 금지
- 잔액 컬럼 직접 증감 금지 (원장 `SUM`)

### 🚫 품질
- `any` 금지 (격리된 불가피한 경우만, 사유 주석 필수) · 캐스팅 대신 narrowing
- default export 금지 (Next.js 페이지 제외)
- 파일 800줄 / 함수 50줄 / 중첩 4단계 상한
- `console.log`·디버그 잔재 커밋 금지
- 실패한 테스트를 스킵으로 덮지 않는다

## 6. 서브에이전트 활용

| 에이전트 | 언제 |
|---|---|
| `ui-ux-auditor` | UI 컴포넌트·페이지 작성/수정 직후 |
| `schema-backend-validator` | Drizzle 스키마·Server Action·API·인증 코드 변경 직후 |
| `test-runner` | 커밋 전, 또는 빌드 영향이 있는 변경 후 |

세 에이전트는 모두 **읽기·검사 전용 보고자**다. 코드 수정은 메인 세션에서 수행한다.

## 7. 현재 상태

- **Phase 0** (상표·도메인 검증) 미완 — 브랜드명은 i18n 키로만 노출해 교체 비용을 낮춘다
- **Phase 1-Z·1-A·1-B** 완료 — v0 자산 이관 · Board 시트 · `cardnews` 스키마 · Clerk 웹훅/테넌트 스코프
- **Phase 1-C** (과금 기반) 착수 직전 — [`docs/04-TASKS.md`](docs/04-TASKS.md)
- 서버 진입점을 새로 만들 때는 `getScope()` → `requirePermission()` → 리포지토리(`orgScoped()`) 순서를 지킨다
