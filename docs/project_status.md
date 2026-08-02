# 📌 Project Status & Handover Guide

최종 갱신: **2026-08-02** · 문서 버전 1.0
이 문서 하나로 세션을 완전히 복원할 수 있어야 한다. 상태가 바뀌면 반드시 갱신한다.

---

## 1. 프로젝트 개요

### 서비스명 및 핵심 목적

**Panelo** (가칭 — 상표 검증 미완, §6 참조)

> 혼자 여러 SNS 채널을 운영하는 1인 사업자가, **한 달에 한 번 앉아서 한 달치 카드뉴스를 만들고 예약까지 끝내는** 도구.

벤치마킹 대상은 [mirra.my](https://www.mirra.my)이며, **기능 문제의식만 참고**하고 디자인·IA·문구는 전면 독자 제작한다.

### 차별화 축 3가지

| # | 기능 | 설명 |
|---|---|---|
| 1 | **Fan-out** | 소재 1개 → 인스타 4:5 / 릴스 9:16 / 스레드 / 블로그 자동 분기. 원본 15cr, 파생 Cut 5cr |
| 2 | **월간 배치 세션** | 캘린더 빈칸 감지 → Board 스프레드시트에서 한 달치 일괄 생성 |
| 3 | **Dry-run 견적** | 크레딧 차감 전 항상 견적 노출. 실패 시 자동 환불 |

### 마스터 기술 스택 (확정 · 변경 금지)

Next.js 16.2 App Router · React 19.2 (Compiler) · TypeScript strict · Supabase(PostgreSQL) · **Drizzle ORM 0.45** · Clerk Auth 7.4 (+Organizations) · Tailwind CSS v4 · next-intl 4.12 · **Base UI + cva** · Framer Motion(`motion`) · Arcjet · Sentry · LogTape · Trigger.dev v3(예정)

> **Prisma를 쓰지 않는다.** 모든 DB 접근은 Drizzle.

### 주요 가이드라인

| 문서 | 역할 |
|---|---|
| **`CLAUDE.md`** | 프로젝트 규칙 (디자인 토큰, 컨벤션, 가드레일). `@AGENTS.md`를 상속 |
| `AGENTS.md` | 보일러플레이트 베이스 컨벤션 |
| `docs/README.md` | 설계 문서 인덱스 + 확정 사항 |
| `docs/01-PRD.md` | 문제 정의, 타깃, IA, 크레딧 경제, 성공 지표, 법적 요건 |
| `docs/02-ARCHITECTURE.md` | v0 자산 실사, 시스템 구조, 인증·RBAC, 생성 파이프라인 |
| `docs/03-DATA-MODEL.md` | Drizzle 스키마 전문 (21개 테이블) |
| `docs/04-TASKS.md` | Phase 0~4 태스크리스트 (약 140개) |
| `docs/05-DESIGN-SYSTEM.md` | 토큰 정의, 컴포넌트 규약, 모션, a11y |

---

## 2. 현재 완료된 설계 및 구현 단계

> ⚠️ 아래 Phase 번호는 사용자 요청 양식을 따른 것이다. **`docs/04-TASKS.md`의 로드맵 Phase와 번호 체계가 다르다.** 실제 개발 로드맵은 04-TASKS 기준이며, 현재 로드맵상 위치는 **Phase 1-Z 완료 / Phase 1-A 진행 중**이다.

### ✅ Phase 1: 기본 프로젝트 스캐폴딩 및 환경 세팅 — **완료**

- [x] `CLAUDE.md` — 프로젝트 개요, 디자인 시스템, 컨벤션, Git·패키지 규칙, 가드레일 5종
- [x] `.env.example` — 전 환경변수 템플릿 (Supabase / Clerk / Stripe / LLM / Trigger / Resend / Arcjet / 관측)
- [x] `.claude/agents/ui-ux-auditor.md` — 디자인·반응형·a11y 검수 (haiku, 읽기 전용)
- [x] `.claude/agents/schema-backend-validator.md` — Drizzle·Clerk·Zod·보안 검수 (haiku, 읽기 전용)
- [x] `.claude/agents/test-runner.md` — 빌드·테스트 실행 보고 (haiku, 타임아웃 120초, 수정 금지)
- [x] 설계 문서 6종 (`docs/README.md` + 01~05)
- [x] **v0 자산 이관 완료** (아래 상세)
- [x] 로케일 전환 — `ko` 추가·기본, `fr` 제거, Clerk `koKR`
- [x] 디자인 토큰 이식 — `global.css`에 `:root` / `.dark` / `@theme inline`
- [x] 대시보드 셸 재구축 — 라우팅 기반, i18n 적용, Board 중심 IA
- [x] Phase 1 스텁 라우트 4개 (`/dashboard/deck`, `/deck/new`, `/templates`, `/templates/learn`)

### ⬜ Phase 2: DB 스키마 및 Clerk Auth RBAC — **미착수**

- [ ] `src/models/` 도메인 분리 + `drizzle.config.ts` 경로 변경
- [ ] 마이그레이션 `0001_org_and_users` ~ `0008_system`
- [ ] Clerk Organizations 활성화 + `api/webhooks/clerk` (Svix 검증 + 멱등)
- [ ] `features/shared/scope.ts` — `getScope()` / `requirePermission()`
- [ ] 테넌트 격리 통합 테스트

### 🔄 Phase 3: 핵심 기능/UI 컴포넌트 — **부분 진행**

| 항목 | 상태 |
|---|---|
| `Button` (+ `signal` variant) | ✅ 완료 |
| `CreditBadge` | ✅ 완료 |
| `EmptyState` | ✅ 완료 |
| `Sidebar` / `Topbar` / `DashboardShell` | ✅ 완료 |
| `navData` (Phase 게이팅 포함) | ✅ 완료 |
| Input / Select / Chip / Modal / Toast / Tabs | ⬜ 미착수 |
| `DryRunPanel` | ⬜ 미착수 |
| Deck 에디터 (Panel 캔버스 · Slot 편집) | ⬜ 미착수 |
| **Board 상호작용 코어** (`src/lib/sheet/`) | ✅ 완료 — clipboard · selection · history, 단위 테스트 39건 |
| **Board 시트 UI** (`BoardGrid` · `BoardCell` · `FanoutCell` · `BoardCardList` · `useBoardSheet`) | ✅ 완료 — `role="grid"`, 키보드·클립보드·필 핸들, 1024px 미만 카드 폴백 |
| **크레딧 견적** (`features/credit/estimate.ts`) | ✅ 완료 — 단위 테스트 6건 |
| `DryRunPanel` (전용 모달) | ⬜ 미착수 — 현재는 헤더의 `CreditBadge` 인라인 견적만 |
| Storybook 스토리 + a11y 스캔 | ⬜ 미착수 |

### ⬜ Phase 4: 외부 오픈소스 이식 및 모듈화 — **미착수**

- [ ] Trigger.dev v3 (배치 생성 큐)
- [ ] Supabase Storage 래퍼 (`libs/Storage.ts`)
- [ ] Stripe Checkout
- [ ] LLM / 이미지 생성 API 어댑터
- [ ] Framer Motion 프리셋 모듈 (`components/motion/presets.ts`)

---

## 3. 핵심 결정 사항 & 아키텍처 요약

### 확정 결정 8가지

| # | 결정 | 근거 |
|---|---|---|
| 1 | 브랜드 **Panelo** (`panelo.app` 우선) | panel = 카드 1장. 제품 은유를 도메인 언어로 |
| 2 | 차별화 축 = **Board** (팬아웃 + 월간 배치) | 1인 사업자의 진짜 고통은 "건수"가 아니라 "채널마다 다시 만들기" |
| 3 | 1차 타깃 = **1인 사업자** (Standard $19 / 500cr / SNS 2계정) | |
| 4 | Phase 1 유료 플랜 = **Standard 단독** | 검증 전 플랜 분화는 조기 최적화 |
| 5 | 잡 큐 = **Trigger.dev v3** | Vercel 함수 타임아웃 회피 |
| 6 | Board는 **1024px 미만 카드 리스트 폴백** | 모바일 가로 스크롤 시트는 실사용 불가 |
| 7 | 컬러 = **잉크 블랙(`--primary`) + 시그널 라임(`--signal`)** | 보라 계열 SaaS 톤 탈피. 라임은 AI 지점 전용 |
| 8 | UI 뼈대 = **v0 셸 구조 채택, 값·IA·문구는 전면 교체** | 토큰 이름 유지 → 코드 수정 없이 브랜드 적용 |

### 선정된 핵심 기능 (Must-Have)

1. Deck 생성 (주제 → Panel 6~10장, 15cr)
2. Slot / Panel 단위 부분 재생성 (1cr / 3cr)
3. Board 시트 — 붙여넣기 · 필 핸들 · `⌘Z` · 다중 편집
4. Fan-out — 1행 → N채널 Cut (5cr)
5. Dry-run 견적 + 실패 자동 환불
6. 템플릿 갤러리 + 디자인 학습 (레퍼런스 ≤10장 → 내 템플릿, 5cr)
7. 브랜드킷 (팔레트 · 폰트 · 말투 · 금칙어)
8. 예약 발행 (Instagram → Threads → TikTok → YouTube)
9. 월간 배치 마법사 (캘린더 빈칸 → Board 자동 생성)
10. 성과 대시보드 (발행 후 7/14/30일)

### 제외된 기능 (Out of Scope)

| 항목 | 사유 | 복귀 |
|---|---|---|
| `reviewer` 역할 · 승인 워크플로 | 1인 사업자는 검수자가 없다 | Phase 4 |
| 워크스페이스/프로젝트 스위처 UI | 브랜드 1개 전제. **스키마는 존재, UI만 게이팅** | Phase 4 |
| Pro / Agency 결제 | Standard 검증 우선 | Phase 3 말 |
| 자동 DM | 플랫폼 스팸 정책 리스크 + 타깃 니즈 낮음 | Phase 4 |
| 댓글 통합 인박스 | 동상 | Phase 4 |
| 레퍼런스 리서치 | 벤치마킹 대상 기능. 우리 핵심 아님 | 재검토 |
| 영상 생성 | 이미지 카드뉴스 집중. 릴스는 "커버 이미지"까지만 | 미정 |
| 자체 이미지 생성 모델 | 외부 API 사용. 모델 학습 안 함 | 미정 |

### DB 스키마 핵심 테이블 (21개 · 전문은 `docs/03-DATA-MODEL.md`)

```
조직·사용자   organizations, users, memberships, projects
브랜드        brand_kits, brand_assets
템플릿        templates, template_versions, design_learnings
콘텐츠        decks, deck_versions, panels
Board ⭐      boards, board_rows, board_row_outputs, series_templates
실행          runs, run_items
과금          subscriptions, credit_ledger, plan_limits
발행          social_accounts, schedules, publications, metrics_daily
시스템        webhook_events, notifications, audit_logs
```

**핵심 설계 원칙**
- 조직 데이터 테이블은 `orgId`를 **직접** 보유 (조인 없이 격리 필터)
- 크레딧은 **이중부기 원장**. 잔액 컬럼 없음 → 항상 `SUM(delta)`
- 모든 생성·과금·발행에 `idempotencyKey` + unique 제약
- `deck_versions.parentVersionId`로 부분 재생성 계보 추적
- ⚠️ `decks.active_version_id` ↔ `deck_versions.deck_id`는 **순환 FK** → `0005` 마이그레이션에서 분리 추가

### 이식되거나 적용된 외부 모듈

| 모듈 | 버전 | 용도 | 상태 |
|---|---|---|---|
| `@base-ui/react` | ^1.6.0 | UI 프리미티브 (shadcn 아님) | ✅ 설치·사용 중 |
| `class-variance-authority` | latest | variant 정의 | ✅ |
| `clsx` + `tailwind-merge` | latest | `cn()` 유틸 | ✅ |
| `lucide-react` | latest | 아이콘 | ✅ |
| `motion` | ^12.43 | Framer Motion v12 | ⚠️ 설치만, 미사용 |
| v0.dev 대시보드 셸 | — | 사이드바·톱바·셸 구조 | ✅ 이관 후 원본 삭제 |

**오픈소스 조사 결론 — Board 시트 (2026-08-02)**

| 후보 | ⭐ | 6개월 커밋 | React 19 | 판정 |
|---|---|---|---|---|
| nick-keller/react-datasheet-grid | 2,019 | 1 | ✅ | 1등 선정. **의존성으로는 미채택** |
| TanStack/table | 28,256 | 100+ | ✅ | headless라 시트 상호작용은 어차피 자체 구현 |
| revolist/revogrid | 3,430 | 100+ | ⚠️ | Web Component — Shadow DOM에 토큰 주입 곤란 |
| glideapps/glide-data-grid | 5,286 | **0** | ❌ 16/17/18만 | 탈락 (canvas 렌더 → `role="grid"` 불가) |
| handsontable | 21,997 | 100+ | ✅ | 탈락 (`NOASSERTION` — 상업 사용 유료) |

**채택 방식: 하이브리드.** 라이브러리를 설치하지 않고 상호작용 알고리즘만 자체 경량 구현했다. 근거: ① 목표 규모 ≤50행이라 가상 스크롤 불필요 ② `role="grid"` a11y 요구가 라이브러리 DOM과 충돌 ③ 자체 CSS와 디자인 토큰 충돌 ④ `classnames` 등 의존성 중복 ⑤ 유지보수 저활동. **MIT 코드를 복사하지 않고 설계만 참고**해 라이선스 고지 의무를 만들지 않았다.

산출물 (`src/lib/sheet/`, 의존성 추가 0):
- `clipboard.ts` — TSV 파싱·직렬화 (따옴표 이스케이프, 셀 내 개행, CRLF, 행 패딩)
- `selection.ts` — 셀 좌표·범위 모델, 키보드 이동, 필 핸들 확장, 값 타일링
- `history.ts` — 실행취소 스택 (기본 20단계, 불변, redo 분기 정리)

**v0 자산 처리 결과**
- 원본 위치: 루트 `components/`, `lib/` → **삭제 완료**
- 이관 위치: `src/components/{ui,dashboard}/`, `src/lib/utils.ts`
- 폐기: `views/content-planning`, `views/reference-research`, `views/content-creation` (Mirr IA 복제)
- 전환: `views/placeholder` → `src/components/ui/EmptyState.tsx`
- **`mirr` 문자열 전량 제거 확인** (`grep -ri mirr src/` → 0건)

---

## 4. 현재 작업 위치 & 다음 진행할 작업

### 현재 멈춘 위치

**로드맵 Phase 1-Z(v0 이관) 완료 → Phase 1-A(기반 정비) 진행 중.**

이번 세션에서 완료한 것:
1. 환경 세팅 4종 (`CLAUDE.md`, `.env.example`, 서브에이전트 3개)
2. 의존성 6종 설치
3. `src/lib/utils.ts` — `cn()` 이관
4. `src/styles/global.css` — 디자인 토큰 전체 이식 (라이트·다크)
5. `src/components/ui/Button.tsx` — `signal` variant 추가
6. `src/components/ui/CreditBadge.tsx`, `EmptyState.tsx` — 신규
7. `src/components/dashboard/{Sidebar,Topbar,DashboardShell,navData}.tsx` — 재구축
8. `src/app/[locale]/(auth)/dashboard/layout.tsx` — 새 셸로 교체
9. 스텁 라우트 4개
10. `src/locales/ko.json` 생성, `AppConfig` 로케일 전환
11. 루트 `components/`·`lib/`·`fr.json` 삭제

### 검증 상태

| 검사 | 결과 |
|---|---|
| `npx tsc --noEmit` | ✅ **0건** |
| `npm run check:i18n` | ✅ exit 0 (missing·unused·undefined 전부 0) |
| `npm run lint` | ✅ 우리 코드 **0건** (기존 파일의 포맷 경고는 미정리 — 무관 코드 재포맷 금지 원칙) |
| `npm run test` | ✅ **47건 통과** (unit 5파일) |
| `npx next build` | ✅ **성공** — `/dashboard/board` 포함 전 라우트 생성 |
| `npm run build-local` | ❌ **실패** — 아래 R7 참조 |

`next-env.d.ts` 미생성으로 인한 이미지 모듈 오류 13건은 해소됐다.

### 다음 세션에서 바로 실행할 작업

```
1. build-local 복구 (R7) — CI 게이트가 막혀 있다
   → package.json 의 db-server:memory 가 Windows 에서 깨진다.
     "pglite-server -m 100 --run 'npm run db:migrate'" 의 작은따옴표를
     Windows cmd 가 처리하지 못해 'run' 이 positional 로 넘어간다.
     크로스플랫폼 인용(큰따옴표 또는 cross-env 경유)으로 수정.
     npx next build 는 이미 성공하므로 코드 문제는 아니다.

2. 폰트 적용 (로드맵 1.6)
   → Pretendard Variable / JetBrains Mono / Instrument Serif 를 next/font 또는
     self-host 로 연결. global.css 의 --font-sans 등은 정의만 되어 있고
     실제 폰트 파일이 없어 현재 시스템 폰트로 렌더된다.

3. Board 마무리
   → DryRunPanel 모달 (현재는 헤더 CreditBadge 인라인 견적만)
   → BoardGrid / BoardCell Storybook 스토리 + a11y 스캔
   → 실제 브라우저에서 키보드·붙여넣기·필 핸들 동작 확인 (아직 미검증)

4. 남은 1-A 정비
   → src/models/ 도메인 분리 + drizzle.config.ts schema 경로를 ./src/models/index.ts 로
   → Env.ts 에 신규 환경변수 추가 (SUPABASE_*, CLERK_WEBHOOK_SECRET, STRIPE_*, LLM_API_KEY 등)
   → libs/Storage.ts (Supabase Storage 래퍼 + 서명 URL)

5. 이어서 로드맵 1-B (인증·테넌트)
   → Clerk Organizations 활성화 → 마이그레이션 0001 → webhook → getScope/requirePermission
```

**다음 세션 시작 프롬프트 예시**

```
docs/project_status.md 와 CLAUDE.md 를 먼저 읽고 컨텍스트를 파악해 줘.
그다음 §4 '다음 세션에서 바로 실행할 작업'의 1번(next-env.d.ts 확인)부터
순서대로 진행해 줘. 작업 후에는 schema-backend-validator 와 test-runner
서브에이전트로 검수하고, project_status.md 를 갱신해 줘.
```

---

## 5. 새 세션 시작 시 Claude 지시사항

1. **이 문서와 `CLAUDE.md`를 먼저 읽는다.** 그다음 필요한 설계 문서(`docs/01`~`05`)를 해당 작업 범위만 읽는다. 전부 읽지 않는다 — 토큰 낭비다.
2. §4 '다음 진행할 작업'부터 이어간다. 앞 단계를 다시 검증하지 않는다.
3. 코드 작성 후 해당 서브에이전트로 검수한다.
   - UI 변경 → `ui-ux-auditor`
   - 스키마·인증·API 변경 → `schema-backend-validator`
   - 커밋 전 → `test-runner`
4. **가드레일을 어기지 않는다** (`CLAUDE.md` §5). 특히:
   - 벤치마킹 대상 CSS·문구·IA 복제 금지, `mirr` 문자열 유입 금지
   - 색상 Hex·사용자 문자열 하드코딩 금지 (토큰 / i18n 키)
   - 시크릿은 `.env.local`에만. `.env`는 git 추적 대상
   - `--signal`(라임)은 AI 개입 지점에만
5. **작업을 마치면 이 문서를 갱신한다.** §2 체크리스트, §4 현재 위치·다음 작업, 검증 상태를 실제와 일치시킨다.

---

## 6. 미해결 리스크

| # | 리스크 | 조치 필요 시점 |
|---|---|---|
| R1 | **상표 미검증** — `Panelo`의 `panel`은 일반명사라 식별력이 약하다. KIPRIS(35·42·9류) / USPTO / EUIPO 검색과 `panelo.app` 도메인 확보가 아직 안 됐다 | **브랜드 에셋 제작 전.** 현재 브랜드명은 i18n 키(`DashboardNav.brand_name`)로만 노출되므로 교체 비용은 낮다 |
| R2 | 폰트 미적용 — `global.css`에 패밀리명만 정의, 실제 파일 없음 → 현재 시스템 폰트로 렌더 | 다음 세션 |
| **R7** | **`build-local` 실패** — `db-server:memory`의 작은따옴표가 Windows에서 깨져 `pglite-server`가 `run`을 positional로 받는다. `npx next build`는 성공하므로 코드가 아닌 스크립트 인용 문제. **CI 머지 게이트가 막혀 있다** | **다음 세션 최우선** |
| R8 | Board UI 브라우저 미검증 — 타입·린트·빌드는 통과했지만 키보드 이동·붙여넣기·필 핸들의 실제 동작은 아직 눈으로 확인하지 않았다 | Storybook/E2E 작성 시 |
| R3 | LLM·이미지 API 제공사 미선정 → 크레딧 단가(15cr/5cr)의 원가 검증 안 됨 | 로드맵 1-D 착수 전 |
| R4 | Supabase 프로젝트 미생성 — 현재 로컬 PGlite로만 동작 | 로드맵 1-B 착수 전 |
| R5 | `npm audit` 취약점 43건 (critical 5) — 기존 보일러플레이트 의존성 | 별도 점검 필요 |
| R6 | 기존 보일러플레이트 잔재 — `Counter`, `Portfolio`, `Sponsors`, `Hello` 등 데모 코드가 남아 있음 | 마케팅 페이지 작업 시 정리 |
