# 📌 Project Status & Handover Guide

최종 갱신: **2026-08-02** · 문서 버전 **1.1** · 기준 커밋 `7c1f59a`
이 문서 하나로 세션을 완전히 복원할 수 있어야 한다. 상태가 바뀌면 반드시 갱신한다.

> 갱신 규칙: 커밋을 남겼으면 이 문서의 §2 체크리스트 · §4 현재 위치/다음 작업 · §6 리스크를 같은 턴에 맞춘다. 문서가 커밋보다 뒤처지면 다음 세션이 이미 끝난 일을 다시 한다.

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

Next.js 16.2 App Router · React 19.2 (Compiler) · TypeScript strict · Supabase(PostgreSQL) · **Drizzle ORM 0.45** · Clerk Auth 7.4 (+Organizations) · Tailwind CSS v4 · next-intl 4.12 · **Base UI + cva** · Arcjet · Sentry · LogTape · Framer Motion(미설치) · Trigger.dev v3(예정)

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
| `docs/06-DEPLOYMENT.md` | Vercel·Supabase 배포 절차, 필수 환경변수, 배포 리스크 |

---

## 2. 현재 완료된 설계 및 구현 단계

> ⚠️ 아래 Phase 번호는 사용자 요청 양식을 따른 것이다. **`docs/04-TASKS.md`의 로드맵 Phase와 번호 체계가 다르다.** 실제 개발 로드맵은 04-TASKS 기준이며, 현재 로드맵상 위치는 **Phase 1-Z·1-A 완료 / 1-B 착수 직전**이다.

### ✅ Phase 1: 기본 프로젝트 스캐폴딩 및 환경 세팅 — **완료**

- [x] `CLAUDE.md` — 프로젝트 개요, 디자인 시스템, 컨벤션, Git·패키지 규칙, 가드레일 5종
- [x] `.env.example` — 전 환경변수 템플릿 (Supabase / Clerk / Stripe / LLM / Trigger / Resend / Arcjet / 관측)
- [x] `.claude/agents/ui-ux-auditor.md` — 디자인·반응형·a11y 검수 (haiku, 읽기 전용)
- [x] `.claude/agents/schema-backend-validator.md` — Drizzle·Clerk·Zod·보안 검수 (haiku, 읽기 전용)
- [x] `.claude/agents/test-runner.md` — 빌드·테스트 실행 보고 (haiku, 타임아웃 120초, 수정 금지)
- [x] 설계 문서 7종 (`docs/README.md` + 01~06)
- [x] **v0 자산 이관 완료** (아래 상세)
- [x] 로케일 전환 — `ko` 추가·기본, `fr` 제거, Clerk `koKR`
- [x] 디자인 토큰 이식 — `global.css`에 `:root` / `.dark` / `@theme inline`
- [x] 대시보드 셸 재구축 — 라우팅 기반, i18n 적용, Board 중심 IA
- [x] Phase 1 스텁 라우트 4개 (`/dashboard/deck`, `/deck/new`, `/templates`, `/templates/learn`)

### 🔄 Phase 2: DB 스키마 및 Clerk Auth RBAC — **부분 진행**

- [x] `src/models/` 도메인 분리 (`Namespace` · `Enums` · `Org` · `Billing` · `System`)
- [x] `drizzle.config.ts` → glob `./src/models/*.ts` (barrel 파일은 린트 규칙에 걸려 미사용)
- [x] **전용 Postgres 스키마 `cardnews`** — 모든 테이블·enum이 `cardnews.table()` / `cardnews.enum()`
- [x] 마이그레이션 `0001_org_billing_system` — 테이블 10개 · enum 4개 · `plan_limits` 시드 4행
- [x] `Env.ts` 확장 (Supabase · Stripe · LLM · Resend · Clerk webhook — 전부 optional)
- [ ] Clerk Organizations 활성화 + `api/webhooks/clerk` (Svix 검증 + 멱등)
- [ ] `features/shared/scope.ts` — `getScope()` / `requirePermission()`
- [ ] 테넌트 격리 통합 테스트
- [ ] 나머지 마이그레이션 (`brand` · `template` · `deck` · `run` · `board` · `publish`)

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

### 🔄 Phase 4: 외부 오픈소스 이식 및 모듈화 — **부분 진행**

- [x] **Board 상호작용 코어 자체 구현** (`src/lib/sheet/`) — 오픈소스 5종 검토 후 **의존성 0 추가**로 결론
- [ ] Trigger.dev v3 (배치 생성 큐)
- [ ] Supabase Storage 래퍼 (`libs/Storage.ts`)
- [ ] Stripe Checkout
- [ ] LLM / 이미지 생성 API 어댑터
- [ ] Framer Motion 프리셋 모듈 — **`motion` 패키지는 knip이 미사용으로 잡아 제거했다.** 실제로 쓸 때 재설치한다

### 🚀 배포 준비 — **부분 완료**

- [x] GitHub 푸시 완료 (`yumiaena-alt/next-boilerplate-drizzle-clerk`, `main`)
- [x] `vercel.json` — 리전 `icn1`(서울), `buildCommand`를 `next build`로 오버라이드
- [x] `docs/06-DEPLOYMENT.md` — 절차 · 필수 환경변수 · 리스크
- [x] Vercel CLI 인증 확인 (`yumiaena-alt` / 팀 `limigogos-projects`)
- [ ] **Supabase 프로젝트 생성** ← 사용자 작업. 배포 차단 요인
- [ ] Vercel 프로젝트 생성 + 환경변수 3개 등록 ← 사용자 작업 (시크릿)
- [ ] `npx vercel --prod`

> `buildCommand`를 오버라이드한 이유: 기본 `npm run build`가 `run-s db:migrate build:next`라 **배포마다 프로덕션 DB에 마이그레이션이 실행**된다. 동시 배포 경쟁 + pooler는 DDL에 부적합.

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

**모든 테이블은 전용 Postgres 스키마 `cardnews`에 만든다** (`pgSchema('cardnews')`). `public`에는 보일러플레이트 `counter`만 남아 있다. Supabase의 자동 REST API는 `public`만 노출하므로 애플리케이션 테이블이 공개 API로 새지 않는다.

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

※ 마이그레이션 0001 로 실제 생성된 것은 10개:
  organizations users memberships projects
  subscriptions credit_ledger plan_limits
  webhook_events notifications audit_logs
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
| ~~`motion`~~ | — | Framer Motion v12 | ❌ **제거됨** — knip이 미사용으로 차단. 실제 애니메이션 작업 시 재설치 |
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

**로드맵 Phase 1-A(기반 정비) 완료 → Phase 1-B(인증·테넌트) 착수 직전.**

Board UI와 DB 스키마는 로드맵상 Phase 2 항목이지만, 흐름상 먼저 만들어졌다.

커밋 이력 (`4b4c2e3` → `7c1f59a`):

| 커밋 | 내용 |
|---|---|
| `4b4c2e3` | 환경 세팅 — `CLAUDE.md` · `.env.example` · 서브에이전트 3종 |
| `a34ba2f` | 설계 문서 6종 |
| `c03d17a` | v0 셸 이관 · 디자인 토큰 · 한국어 로케일 · 스텁 라우트 4개 |
| `470433b` | Board 시트 (`lib/sheet` 코어 + UI 5종) + 크레딧 견적 |
| `a5230e5` | `vercel.json` + 배포 가이드 |
| `7e5e51a` | `models/` 도메인 분리 + 마이그레이션 `0001` + `Env.ts` 확장 |
| `237abbd` | Supabase 절차 문서 보강 |
| `7c1f59a` | **전용 스키마 `cardnews`로 전환** + `0001` 재생성 |

로컬 개발 환경 수정 (커밋에 포함):
- `db-server:*` 스크립트를 `node` 직접 실행으로 변경 → Windows에서 `npm run build-local` / `npm run dev` 동작
- `next-env.d.ts` 생성 → 이미지 모듈 타입 오류 13건 해소
- Playwright chromium 설치 → `npm run test`의 browser 프로젝트 동작

### 검증 상태 (`7c1f59a` 기준, 전부 실측)

| 검사 | 결과 |
|---|---|
| `npx tsc --noEmit` | ✅ **0건** |
| `npm run lint` | ✅ **0건** |
| `npm run check:i18n` | ✅ exit 0 |
| `npm run check:deps` (knip) | ✅ 통과 |
| `npm run test` | ✅ **49건 통과** — unit 47 + **browser(chromium) 2** |
| `npm run build-local` | ✅ **통과** — 마이그레이션이 로컬 PGlite에 실제 적용되는 것까지 확인 |
| `npx drizzle-kit check` | ✅ 통과 |

> ⚠️ **`--project unit`만 돌리지 말 것.** `vitest.config.ts`는 `unit`(node)과 `ui`(chromium browser) 두 프로젝트를 정의한다. `npm run test`로 둘 다 돌려야 한다. Playwright 바이너리가 없으면 `ui`가 실패하므로 새 머신에서는 `npx playwright install chromium`이 필요하다.

### 다음 세션에서 바로 실행할 작업

```
1. Phase 1-B 인증·테넌트  ← 여기부터
   → Clerk 대시보드에서 Organizations 활성화
   → api/webhooks/clerk (Svix 서명 검증 → webhook_events 멱등 → users/orgs/memberships upsert)
   → features/shared/scope.ts : getScope() / requirePermission()
   → 리포지토리 규약: 첫 인자 Scope + 모든 쿼리에 eq(table.orgId, scope.orgId)
   → tests/security/tenant-isolation.integ.ts : 조직 간 접근이 404

2. 폰트 적용 (R2)
   → Pretendard Variable / JetBrains Mono / Instrument Serif.
     global.css 에 패밀리명만 있고 실제 파일이 없어 지금은 시스템 폰트로 렌더된다.

3. Board 마무리
   → DryRunPanel 모달 (현재는 헤더 CreditBadge 인라인 견적만)
   → BoardGrid / BoardCell Storybook 스토리 + a11y 스캔
   → 브라우저에서 키보드·붙여넣기·필 핸들 실동작 확인 (R8, 아직 미검증)

4. libs/Storage.ts (Supabase Storage 래퍼 + 서명 URL)

5. 배포 마무리 — Supabase 생성(사용자) → 환경변수 3개(사용자) → npx vercel --prod
```

**다음 세션 시작 프롬프트**

```
docs/project_status.md 와 CLAUDE.md 를 먼저 읽고 컨텍스트를 파악해 줘.
그다음 §4 '다음 세션에서 바로 실행할 작업' 1번부터 순서대로 진행해 줘.
작업 후에는 schema-backend-validator 와 test-runner 서브에이전트로 검수하고,
project_status.md 를 같은 턴에 갱신해 줘.
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
| ~~R7~~ | ~~`build-local` 실패~~ → **해결됨** (`7c1f59a`). 두 단계 문제였다: ① 작은따옴표를 Windows가 못 넘김 ② 고친 뒤엔 `spawn npm ENOENT`(Windows는 `npm.cmd`라 shell 없이 spawn 불가). `node`로 직접 실행해 해결. **당초 "CI 게이트가 막혔다"고 기록한 것은 과장이었다** — CI는 `ubuntu-latest`라 원래 정상이었고 Windows 로컬 전용 문제였다 | 완료 |
| R8 | Board UI 브라우저 미검증 — 타입·린트·빌드·테스트는 통과했지만 키보드 이동·붙여넣기·필 핸들의 실제 동작은 아직 눈으로 확인하지 않았다 | Storybook/E2E 작성 시 |
| R9 | `counter` 테이블만 `public` 스키마에 남아 있다 (보일러플레이트 데모, `0000`에서 생성). 나머지는 전부 `cardnews` | 마케팅 페이지 정리 시 테이블째 제거 |
| R3 | LLM·이미지 API 제공사 미선정 → 크레딧 단가(15cr/5cr)의 원가 검증 안 됨 | 로드맵 1-D 착수 전 |
| R4 | Supabase 프로젝트 미생성 — 현재 로컬 PGlite로만 동작 | 로드맵 1-B 착수 전 |
| R5 | `npm audit` 취약점 43건 (critical 5) — 기존 보일러플레이트 의존성 | 별도 점검 필요 |
| R6 | 기존 보일러플레이트 잔재 — `Counter`, `Portfolio`, `Sponsors`, `Hello` 등 데모 코드가 남아 있음 | 마케팅 페이지 작업 시 정리 |
