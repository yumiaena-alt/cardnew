# 02. 아키텍처 — Panelo

기준일: 2026-08-02 · 버전 0.3 (v0 자산 반영)

## 0. v0 자산 실사

프로젝트 루트 `components/` · `lib/`에 v0.dev 생성 대시보드 셸이 배치되어 있다 (10파일, 1,006줄).

### 0-1. 구조 평가

| 항목 | 내용 |
|---|---|
| UI 프리미티브 | **Base UI** (`@base-ui/react/button`) — shadcn 아님 |
| 스타일 조합 | `cva` + `cn()`(clsx + tailwind-merge) |
| 아이콘 | lucide-react |
| 토큰 | 시맨틱 네이밍 (`--primary`, `--card`, `--sidebar-*`, `--status-*`, `--radius-md`) |
| 레이아웃 | 사이드바(w-64) + 톱바(h-14) + 스크롤 메인 |
| 테마 | `documentElement.classList.toggle('dark')` class 기반 |
| 접근성 | `aria-label`·`aria-current`·`aria-expanded`·`aria-pressed` 적절히 사용 |

**판단: 뼈대로 채택한다.** 시맨틱 토큰을 일관되게 쓰고 있어 **토큰 이름을 유지하고 값만 교체하면 컴포넌트 코드를 거의 손대지 않고 Panelo 브랜드가 입혀진다.**

### 0-2. 통합 차단 이슈 (`npx tsc --noEmit` 16건 확인)

| # | 이슈 | 상세 | 조치 |
|---|---|---|---|
| V1 | **의존성 5종 미설치** | `@base-ui/react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react` | 설치 |
| V2 | **경로 별칭 불일치** | `tsconfig`의 `@/*` → `./src/*`인데 v0는 루트 `lib/utils.ts`에 두고 `@/lib/utils`를 import | `src/`로 이관 |
| V3 | **토큰 미정의** | `global.css`에 `@import 'tailwindcss'`뿐. v0의 globals.css가 함께 오지 않음 → **현재 렌더하면 전부 무채색** | [05-DESIGN-SYSTEM](05-DESIGN-SYSTEM.md) §2 이식 |
| V4 | **브랜드 잔존** | `sidebar.tsx` 로고 텍스트 `mirr`, `placeholder.tsx` "mirr 워크스페이스" | 즉시 제거 (저작권) |
| V5 | **IA가 Mirr 복제** | `nav-data.ts`가 Mirr 메뉴 구조 그대로 | Board 중심 재구성 |
| V6 | 하드코딩 한국어 | 전 파일 | next-intl 키 전환 |
| V7 | SPA view 스위칭 | `useState<ViewId>` + switch 렌더 | App Router 라우팅 전환 |
| V8 | props 구조분해 | `function Button({ className, variant })` | `AGENTS.md` 규약(`props.foo`)에 맞춰 교정 |
| V9 | 루트 폴더가 타입체크 대상 | `tsconfig.include`가 `**/*.tsx` | 이관 후 루트 `components/`·`lib/` 삭제 |

> **V4는 법적 리스크다.** 벤치마킹 대상의 브랜드명이 코드에 남은 채로 커밋되면 안 된다. Phase 1-A 최우선 처리.

### 0-3. 이관 원칙

```
루트 components/, lib/  →  src/components/, src/lib/  (이관 후 루트 삭제)
```

- 이관 시 파일명을 프로젝트 컨벤션(PascalCase 컴포넌트)으로 정렬한다.
- **v0 코드를 참조용으로 남겨두지 않는다.** 두 벌이 공존하면 어느 쪽이 진실인지 알 수 없게 된다.
- 이관 완료 판정: `npx tsc --noEmit`에서 `components/`·`lib/` 관련 오류 0건.

## 1. 현재 보일러플레이트 실사 결과

`package.json` / `src/libs` 확인 결과 실제 스택은 아래와 같다. 설계 전제를 이에 맞춰 보정했다.

| 영역 | 설치됨 | 비고 |
|---|---|---|
| Framework | Next.js **16.2.6** (App Router), React **19.2** + React Compiler | `useMemo`/`useCallback` 금지 (AGENTS.md) |
| ORM | Drizzle **0.45** + `pg` 드라이버 | 스키마: `src/models/Schema.ts` 단일 파일 |
| 로컬 DB | **PGlite** (`pglite-server`, `local.db`) | `npm run dev`가 자동 기동 |
| Auth | Clerk **7.4** | Organizations 미사용 상태 |
| i18n | next-intl **4.12**, `localePrefix: 'as-needed'` | 로케일 **`en`, `fr`** — `ko` 없음 |
| Styling | Tailwind **v4** (`@tailwindcss/postcss`) | `src/styles/global.css`는 `@import 'tailwindcss'`뿐 |
| Validation | Zod **4.4** | `import type * as z from 'zod'` (타입 전용 시) |
| 보안 | **Arcjet** (`@arcjet/next`) | rate limit·봇 차단에 그대로 활용 |
| 관측 | Sentry 10, LogTape, Better Stack, PostHog(env만) | |
| 테스트 | Vitest 4, Playwright 1.60, Storybook 10 | |
| 품질 | ultracite/oxlint, knip, `@lingual/i18n-check`, lefthook, commitlint | |

### 1-1. 반드시 처리해야 할 갭

| # | 갭 | 조치 | Phase |
|---|---|---|---|
| G1 | **`ko` 로케일 없음** | `AppConfig.i18n.locales`에 `ko` 추가, `src/locales/ko.json` 생성, `defaultLocale: 'ko'`, Clerk `koKR` 로컬라이제이션 등록 | 1 |
| G2 | **Framer Motion 미설치** | `motion` 패키지 추가 (Framer Motion v12+ 신규 패키지명) | 1 |
| G3 | **Supabase 미연결** | `DATABASE_URL`을 Supabase **pooler(6543, pgbouncer)** 로 교체. `pg` 드라이버 그대로 사용 가능 | 1 |
| G4 | **스키마 단일 파일** | `src/models/` 하위 도메인 분리 후 `drizzle.config.ts`의 `schema`를 `./src/models/index.ts`로 변경 | 1 |
| G5 | **파일 스토리지 없음** | Supabase Storage 버킷 + 서명 URL 유틸 추가 | 1 |
| G6 | **잡 큐 없음** | Trigger.dev v3 도입 (Vercel 함수 타임아웃 회피) | 2 |
| G7 | **Clerk Organizations 미사용** | 대시보드에서 Organizations 활성화 + webhook 동기화 | 1 |
| G8 | **v0 의존성 5종 미설치** | `@base-ui/react` · `class-variance-authority` · `clsx` · `tailwind-merge` · `lucide-react` (§0-2 V1) | 1 |
| G9 | **디자인 토큰 미정의** | `global.css`에 `:root` / `.dark` / `@theme inline` 블록 이식 (§0-2 V3) | 1 |

> `AGENTS.md` 규정상 사용 가능한 스크립트는 `build-local` · `lint` · `check:types` · `check:deps` · `check:i18n` · `test` · `test:e2e` 뿐이다. DB 관련(`db:generate`, `db:migrate`)은 명시적 필요 시에만 사용한다.

## 2. 시스템 구성도

```
                        ┌─────────────────────────────┐
     Browser ─────────► │  Next.js 16 (Vercel)        │
                        │  ├ (marketing)  SSG + SEO   │
                        │  ├ (app)        RSC + Server│
                        │  └ /api/webhooks/*          │
                        └──────┬───────────┬──────────┘
                               │           │
              ┌────────────────┘           └────────────────┐
              ▼                                             ▼
   ┌──────────────────────┐                    ┌─────────────────────────┐
   │ Supabase             │                    │ Trigger.dev v3          │
   │ ├ PostgreSQL(Drizzle)│◄───────────────────┤ ├ run.generate (AI)     │
   │ └ Storage (assets)   │                    │ ├ publish.dispatch      │
   └──────────────────────┘                    │ ├ metrics.collect       │
              ▲                                │ └ credit.grant.monthly  │
              │                                └───────────┬─────────────┘
   ┌──────────┴───────────┐                                │
   │ Clerk (Auth + Orgs)  │                    ┌───────────▼─────────────┐
   │  └ webhook 동기화     │                    │ 외부 API                │
   └──────────────────────┘                    │ ├ LLM (텍스트 기획)     │
                                               │ ├ Image (배경 생성)     │
   ┌──────────────────────┐                    │ ├ Meta / TikTok / YT    │
   │ Stripe (구독·초과과금)│                    │ └ Resend (메일)         │
   └──────────────────────┘                    └─────────────────────────┘
```

## 3. 디렉토리 구조 (증분)

기존 보일러플레이트 구조를 유지하며 확장한다.

```
src/
├─ app/[locale]/
│  ├─ (marketing)/              # 랜딩·요금제·법적 문서 (SSG, index 허용)
│  └─ (auth)/
│     └─ dashboard/
│        ├─ layout.tsx          # ← v0 DashboardShell 이관 (사이드바 + 톱바)
│        ├─ board/[boardId]/    # ⭐ Board 시트 (핵심 화면)
│        ├─ deck/[deckId]/      # Deck 에디터 (Panel 편집)
│        ├─ templates/          # 템플릿 갤러리 + 디자인 학습
│        ├─ calendar/           # 캘린더 (Phase 3)
│        ├─ analytics/          # 성과 (Phase 3)
│        └─ settings/           # 계정·구독·브랜드킷·SNS 연결
├─ components/
│  ├─ ui/                       # ← v0 Button 이관 + Input, Modal, Chip, Toast …
│  ├─ dashboard/                # ← v0 Sidebar, Topbar, navData 이관
│  ├─ board/                    # BoardGrid, BoardCell, FanoutCell, DryRunPanel …
│  ├─ deck/                     # PanelCanvas, SlotEditor, VersionDiff …
│  └─ motion/                   # MotionProvider, presets
├─ lib/
│  └─ utils.ts                  # ← v0 cn() 이관 (@/ 별칭이 src를 가리킴)
├─ features/                    # 도메인 서비스 (서버 전용)
│  ├─ run/                      # 생성 파이프라인
│  ├─ board/                    # Board CRUD, fan-out 확장
│  ├─ credit/                   # 원장 기록·잔액 계산
│  ├─ template/
│  └─ publish/                  # Phase 3
├─ models/                      # Drizzle 스키마 (도메인별 분리)
│  ├─ index.ts                  # 전체 re-export → drizzle.config가 참조
│  ├─ Org.ts  Board.ts  Deck.ts  Template.ts  Billing.ts  Publish.ts
├─ libs/                        # 기존: DB, Env, I18n, Arcjet, Logger
│  ├─ Storage.ts                # Supabase Storage 래퍼
│  └─ Queue.ts                  # Trigger.dev 클라이언트
├─ locales/                     # ko.json ⭐추가, en.json, fr.json
└─ validations/                 # Zod 스키마 (경계 검증)
```

**규칙**
- `features/*`는 서버 전용. 클라이언트 컴포넌트에서 직접 import 금지.
- DB 접근은 `features/*/repository.ts`만 수행. 컴포넌트에서 `db` 직접 사용 금지.
- 파일 800줄, 함수 50줄 상한.
- 신규 UI 컴포넌트는 v0 `button.tsx` 패턴(Base UI 프리미티브 + cva + `cn()` + `data-slot`)을 따른다.
- **루트 `components/`·`lib/`는 이관 완료 즉시 삭제한다.** 동일 컴포넌트가 두 곳에 존재하는 상태를 만들지 않는다.

## 4. 인증 · 테넌트 격리 · RBAC

### 4-1. Clerk ↔ DB 동기화

Clerk Organization = Panelo Workspace로 1:1 매핑한다.

```
Clerk Webhook (Svix 서명 검증)
  user.created / user.updated              → users upsert
  organization.created / updated / deleted → organizations upsert
  organizationMembership.created / updated → memberships upsert
```

- 엔드포인트: `app/api/webhooks/clerk/route.ts`
- **Svix 서명 검증 실패 시 즉시 400.** 검증 전 본문 파싱 금지.
- 멱등성: `svix-id`를 `webhook_events` 테이블에 unique 저장 후 처리.

### 4-2. 테넌트 격리 (가장 중요한 보안 결정)

Drizzle이 Supabase에 직접 연결하면 **RLS가 적용되지 않는다.** 따라서:

**Phase 1~3: 애플리케이션 레이어 강제**

```ts
// features/shared/scope.ts
type Scope = { orgId: string; userId: string; role: MemberRole };

/** 서버 auth() 컨텍스트에서만 조직 범위를 확정한다. 클라이언트 입력은 신뢰하지 않는다. */
export async function getScope(): Promise<Scope> {
  const { userId, orgId, orgRole } = await auth();

  if (!(userId && orgId)) {
    throw new UnauthorizedError();
  }

  return { orgId, userId, role: mapClerkRole(orgRole) };
}
```

- 모든 리포지토리 함수는 첫 인자로 `Scope`를 받고, 모든 쿼리에 `eq(table.orgId, scope.orgId)`를 포함한다.
- **클라이언트가 보낸 `orgId`는 절대 사용하지 않는다.** 서버 `auth()`의 값만 진실원천.
- 회귀 방지: `tests/security/tenant-isolation.integ.ts`에서 조직 A의 토큰으로 조직 B 리소스 접근이 404를 반환하는지 검증한다.

**Phase 4: RLS 심층 방어 추가**

Supabase Third-Party Auth로 Clerk JWT를 수용하고 `auth.jwt()->>'org_id'` 기반 정책을 추가한다. 앱 레이어 가드는 유지한다 (이중 방어).

### 4-3. 권한 모델

```ts
const PERMISSIONS = {
  owner:    ['*'],
  admin:    ['deck:*', 'board:*', 'template:*', 'member:manage', 'billing:read'],
  editor:   ['deck:create', 'deck:update', 'board:edit', 'run:execute', 'analytics:read'],
  reviewer: ['deck:read', 'deck:comment', 'analytics:read'],   // Phase 4
  viewer:   ['deck:read', 'analytics:read'],
} as const;
```

Phase 1~3에서는 `owner`만 실제로 생성되며, 나머지 역할의 UI는 노출하지 않는다. 권한 체크 코드는 처음부터 넣어 둔다.

### 4-4. Arcjet 적용 지점

| 경로 | 정책 |
|---|---|
| `/api/webhooks/*` | 봇 탐지 우회 (서명 검증으로 대체), IP allowlist 검토 |
| `run:execute` Server Action | **토큰버킷 rate limit** — 조직당 분당 10 Run |
| 회원가입 | 이메일 검증 + 봇 차단 |
| 공개 공유 링크 | shield + rate limit |

## 5. 생성 파이프라인 (Batch-first)

### 5-1. 핵심 원칙

**단건 생성을 먼저 만들고 나중에 배치를 얹으면 반드시 재작업이 발생한다.** 처음부터 배치를 기본형으로 두고, 단건은 `items.length === 1`인 배치로 처리한다.

```ts
// features/run/types.ts
export type RunScope =
  | { kind: 'full' }
  | { kind: 'panel'; panelIndex: number }
  | { kind: 'slot'; panelIndex: number; slotKey: string };

export type RunItem = {
  topic: string;
  templateVersionId: string;
  fanout: FanoutTarget[];        // [] 이면 원본만
  sourceRowId?: string;          // Board에서 실행한 경우
};

export type CreateRunInput = {
  items: RunItem[];
  scope: RunScope;
  idempotencyKey: string;
  dryRun: boolean;               // ⭐ 1급 파라미터
};
```

`dryRun: true`이면 크레딧을 차감하지 않고 견적만 반환한다. 이것이 사용자의 크레딧 공포를 없애는 구조적 장치다.

### 5-2. 실행 순서

```
1. getScope()                        조직 범위 확정
2. requirePermission('run:execute')  권한 검사
3. Arcjet rate limit                 남용 차단
4. estimate(items, scope)            크레딧 견적 산출
5. if (dryRun) return estimate       ── 여기서 종료
6. reserveCredits(idempotencyKey)    원장에 음수 delta 선기록
7. enqueue → Trigger.dev             비동기 실행
8. 각 item 처리
     ├ 원본 Deck: LLM 기획 → Panel 슬롯 채움 → 이미지 생성 → 저장
     └ Cut 파생 : 원본 본문 재사용 → 채널 톤 조정 → 리레이아웃
9. 성공 → runs.status='done', cost_snapshot 기록
   실패 → runs.status='failed' + refundCredits() 역분개 + 알림
```

### 5-3. 멱등성과 환불

- `runs.idempotency_key`에 unique 인덱스. 동일 키 재요청 시 기존 Run을 반환한다.
- `credit_ledger.idempotency_key`도 unique. 차감과 환불이 각각 별도 원장 행으로 남는다.
- **잔액 컬럼을 직접 증감하지 않는다.** 잔액은 항상 `SUM(delta)`로 계산하고, 조회 성능이 문제되면 머티리얼라이즈드 뷰를 검토한다.

### 5-4. 비용 관측

`runs.cost_snapshot`(jsonb)에 실제 LLM 토큰 수·이미지 생성 횟수·제공사 단가를 기록한다. 주간으로 "크레딧 수익 vs 실제 원가"를 집계해 크레딧 단가를 조정한다.

## 6. 예약 발행 (Phase 3)

```
1분 cron (Trigger.dev scheduled)
  → SELECT ... FROM schedules
     WHERE status='pending' AND scheduled_at <= now()
     ORDER BY scheduled_at
     FOR UPDATE SKIP LOCKED          ⭐ 중복 발행 원천 차단
     LIMIT 50
  → 채널 API 호출 (멱등키 = schedules.id)
  → 성공: publications 생성, status='published'
  → 실패: attempts++, 지수 백오프(1m→5m→25m), 3회 후 'failed' + 알림
```

토큰 만료 대비: 발행 24시간 전 토큰 유효성 사전 검사 → 만료 임박 시 사용자에게 재연동 알림.

## 7. i18n 설계

### 7-1. 로케일 정책

```ts
// src/utils/AppConfig.ts (수정)
export const AppConfig = {
  name: 'Panelo',
  i18n: {
    locales: ['ko', 'en'],       // fr 제거, ko 추가
    defaultLocale: 'ko',
    localePrefix,                 // 'as-needed' 유지 → ko는 접두어 없음
  },
};
```

- `localePrefix: 'as-needed'` 유지 시 한국어 URL은 `/dashboard/board/xxx`, 영어는 `/en/dashboard/...`
- Clerk 로컬라이제이션에 `koKR` 등록 (`@clerk/localizations`)
- `fr.json`은 제거하되, `check:i18n`이 `-s en`(source=en) 기준이므로 **`en.json`을 소스로 유지**하고 `ko.json`을 완전 번역본으로 관리

### 7-2. 네임스페이스 규칙 (AGENTS.md 준수)

- 페이지 네임스페이스는 `Page`로 끝난다: `BoardPage`, `DeckEditorPage`
- 공용은 `Common`, `Credit`, `Channel`
- 컨텍스트 특화 키를 쓴다: `card_title`, `meta_description`
- 문장은 sentence case. 에러 메시지는 짧게, "다시 시도해 주세요" 변형 금지
- 마크업이 필요하면 `t.rich(...)`

### 7-3. CI 게이트

Mirr에서 관찰된 `Navbar.currentWorkspace:` 원문 노출 사고를 막기 위해 **`check:i18n` 실패 시 머지를 차단**한다.

### 7-4. SEO

| 항목 | 처리 |
|---|---|
| 마케팅 페이지 | SSG. `generateMetadata`에서 `alternates.languages`로 hreflang + `x-default` |
| 대시보드 | `robots: { index: false, follow: false }` |
| sitemap | `app/sitemap.ts`에서 로케일별 URL 생성 (기존 파일 확장) |
| OG 이미지 | `next/og` `ImageResponse`로 동적 생성. 제목 + 브랜드 색 반영 |
| 구조화 데이터 | `SoftwareApplication`, `FAQPage` JSON-LD |

## 8. 모션 아키텍처

```ts
// src/components/motion/presets.ts
export const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.26, ease: [0.16, 1, 0.3, 1] },
} as const;

export const rowStagger = {
  animate: { transition: { staggerChildren: 0.03 } },
} as const;
```

- `LazyMotion` + `domAnimation`으로 번들 분리, `m.*` 컴포넌트 사용
- `useReducedMotion()`이 true면 전역 래퍼에서 duration을 0으로 만들고 페이드만 유지
- **transform / opacity / clip-path만** 애니메이션. width·height·top·left 금지
- Board 행 재정렬은 `layoutId` 공유 전환
- 생성 진행 표시는 CSS 애니메이션 (JS 스레드 점유 회피)

## 9. 상태 관리

| 상태 종류 | 도구 | 근거 |
|---|---|---|
| 서버 상태 | **RSC + Server Actions** | 별도 클라이언트 캐시 도입 없이 시작 |
| 필터·정렬·페이지 | **URL SearchParams** | 공유·북마크·뒤로가기 동작 |
| Board 셀 편집 버퍼 | 로컬 `useReducer` + 낙관적 업데이트 | 시트 조작감에는 즉시 반응이 필수 |
| 폼 | react-hook-form + Zod resolver (설치됨) | |

```ts
// src/validations/BoardFilter.ts
export const boardFilterSchema = z.object({
  q: z.string().optional(),
  status: z.array(z.enum(['draft', 'queued', 'running', 'done', 'failed', 'skipped'])).default([]),
  channel: z.array(z.enum(['instagram', 'threads', 'tiktok', 'youtube', 'blog'])).default([]),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  sort: z.enum(['index', 'recent', 'credits']).default('index'),
});
```

서버 컴포넌트에서 `searchParams`를 이 스키마로 파싱해 그대로 쿼리 조건으로 넘긴다. 파싱 실패 시 기본값으로 폴백하고 사용자에게 알리지 않는다 (URL 조작은 흔한 일).

## 10. 미디어 처리

| 항목 | 정책 |
|---|---|
| 저장소 | Supabase Storage. 버킷: `brand-assets`(비공개), `deck-renders`(비공개), `public-og`(공개) |
| 접근 | 비공개 버킷은 **서명 URL 1시간** |
| 업로드 검증 | MIME + 매직넘버 확인, 최대 10MB, PNG/JPG/WEBP만 |
| 최적화 | 업로드 즉시 WebP 변환 + 4:5(1080×1350) 기준 리사이즈 |
| 렌더링 | `next/image`. blurDataURL을 생성 시점에 DB 저장 |
| 로딩 | Board 썸네일 `loading="lazy"`, Deck 에디터 현재 Panel만 `priority` |

## 11. 관측 · 운영

| 영역 | 도구 | 설정 |
|---|---|---|
| 에러 | Sentry (설치됨) | 소스맵 업로드, 릴리즈 태깅, **PII 스크러빙 필수** |
| 로그 | LogTape (설치됨) | 구조적 로깅. 모든 로그에 `orgId`, `runId` 상관관계 ID |
| 제품 분석 | PostHog (env 존재) | 퍼널: 가입 → 첫 Run → 첫 다운로드 → 첫 Board → 첫 예약 |
| 가용성 | Checkly (설치됨) | 핵심 경로 합성 모니터링 |
| 알림 | 인앱 `notifications` + Resend | 발행 실패, 크레딧 20% 미만, 토큰 만료 임박 |

### 환경변수 (Env.ts에 추가 필요)

```
DATABASE_URL                  # Supabase pooler (6543)
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY     # 서버 전용
CLERK_WEBHOOK_SECRET
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
TRIGGER_SECRET_KEY
LLM_API_KEY
IMAGE_API_KEY
RESEND_API_KEY
```

**`process.env`를 직접 읽지 않는다.** 전부 `Env.ts`에서 Zod로 검증한다 (AGENTS.md).

## 12. 마이그레이션 정책

- `npm run db:generate`로 생성된 SQL을 **반드시 사람이 리뷰한 뒤** 커밋한다.
- 파괴적 변경은 **expand → backfill → contract** 3단계로 분리하고, 각 단계를 별도 배포로 내보낸다.
- 롤백은 마이그레이션 되돌리기가 아니라 **앞으로 가는 수정 마이그레이션**으로 처리한다.
- 프로덕션 배포 전 Supabase 브랜치에서 리허설한다.
- 백업: PITR 7일 이상 + 주간 논리 백업. **분기 1회 복구 리허설**을 캘린더에 고정한다.

## 13. 테스트 전략

| 종류 | 파일 규칙 | 대상 |
|---|---|---|
| 단위 | `*.test.ts` (구현과 같은 위치) | 크레딧 견적 계산, fan-out 확장 로직, 슬롯 병합 |
| 통합 | `tests/*.integ.ts` | 리포지토리 쿼리, **테넌트 격리**, 웹훅 멱등성 |
| E2E | `tests/*.e2e.ts` | 가입 → 생성 → 편집 → 다운로드 / Board 배치 완주 |
| 시각 회귀 | Storybook + Playwright | Board 셀 상태, Panel 캔버스, 320/768/1024/1440 |

`it` 제목은 3인칭 현재형, `verb + object + context`. "should/works/handles" 금지.

```ts
describe('estimateRunCredits', () => {
  it('charges 15 credits for an origin deck', () => {});
  it('charges 5 credits per fan-out cut', () => {});
  it('returns zero for a dry run with no items', () => {});
});
```

## 14. 배포 게이트

머지 전 전부 통과해야 한다.

```
lint  →  check:types  →  check:i18n  →  check:deps  →  test  →  build-local  →  test:e2e
```
