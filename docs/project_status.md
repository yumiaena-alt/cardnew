# 📌 Project Status & Handover Guide

최종 갱신: **2026-08-06** · 문서 버전 **3.1** · 기준 커밋 `8fa055d` (작업 트리 깨끗)
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
| **`docs/07-PORTED-MODULES.md`** | **Toneflow 이식 기록 — 단계별 산출물, 고친 것, 남은 부채** |
| `services/render/README.md` | 렌더 서비스 배포 (RackNerd VPS) |

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
- [x] `api/webhooks/clerk` — Svix 서명 검증 + `webhook_events` 멱등 + org/user/membership upsert
- [x] `features/shared/scope.ts` — `getScope()` / `requirePermission()` / `mapClerkRole()`
- [x] `features/shared/orgScope.ts` — `orgScoped()` 테넌트 필터 헬퍼 + 권한 카탈로그 `permissions.ts`
- [x] 마이그레이션 `0002_default_project_unique` — 조직당 default 프로젝트 1개 부분 unique 인덱스
- [x] 마이그레이션 `0003`~`0010` — template · deck · 순환 FK · board+run · run_item_subject · `spend.search` · `blog_posts` · `panels.plan`
- [ ] **Clerk 대시보드에서 Organizations 활성화** ← 사용자 작업
- [ ] 조직 간 접근 404 통합 테스트 — 조직 범위 엔드포인트가 생기는 1-D로 연기
- [ ] 남은 마이그레이션 (`brand` · `publish`) — 쓰는 코드가 생길 때 만든다
- [x] **`0003`~`0010` 프로덕션(Supabase) 적용 완료** — 매번 추가 전용, 기존 데이터 보존 확인

### ✅ Phase 3: 화면 — **메뉴 전 구간 구축 완료** (비디오 제외)

| 화면 | 경로 | 상태 |
|---|---|---|
| 콘텐츠 기획 | `/dashboard/planning` | ✅ 아이디어 생성 → 고른 것만 보드로. **무료** |
| 레퍼런스 리서치 | `/dashboard/planning/reference` | ✅ 광고 라이브러리 검색. **검색어당 하루 1크레딧** · 토큰 없으면 비활성 |
| 월간 보드 | `/dashboard/board` | ✅ 시트 + 영속화 + 견적 → 실행 |
| 링크로 만들기 | `/dashboard/deck/link` | ✅ URL → 본문 추출 → 카드뉴스. **SSRF 차단** |
| 카드뉴스 만들기 | `/dashboard/deck/new` | ✅ 단건 = 1건짜리 Run |
| 내 카드뉴스 | `/dashboard/deck` · `/deck/[id]` | ✅ 목록 · 상세 · 서명 URL · 저작권 표기 |
| 카드 문구 편집 | (상세 안 모달) | ✅ 상한 28/90자 · `isUserEdited` 기록 |
| **부분 재생성** | (상세 안 모달) | ✅ 카드 1장 다시 그리기 · 견적 경유 |
| 블로그 초안 | `/dashboard/blog` | ✅ 5크레딧 · 인라인 실행 |
| 발행 캘린더 | `/dashboard/calendar` | ✅ 보드에서 생성. 빈 날짜 강조 |
| 성과 | `/dashboard/analytics` | ✅ 우리 생산량만. 도달·저장은 연동 후 |
| 계정 연동 | `/dashboard/settings/accounts` | ✅ OAuth → 장기 토큰 → 프로필 조회 → 암호화 저장 · 결과 배너 |
| 댓글 인박스 | `/dashboard/comments` | ✅ 최근 게시물의 **미답변** 댓글을 Graph 로 실시간 조회 |
| 자동 DM | `/dashboard/automation` + 웹훅 | ✅ 규칙 편집 + `api/webhooks/instagram` 실행부 |
| 예약 발행 | 카드뉴스 상세 안 패널 | ✅ 예약·취소 · 캘린더에 표시 · 5분 주기 폴러 |
| 릴스 영상 | 카드뉴스 상세 안 패널 | ✅ 렌더된 카드 이어붙이기(ffmpeg) · 무료 |
| 플랜 | `/dashboard/settings/plan` | ✅ Stripe 체크아웃 |
| 템플릿 갤러리 · 디자인 학습 | `/dashboard/templates*` | ⬜ 스텁 그대로 |

**UI 프리미티브**: `Button` · `CreditBadge` · `EmptyState` · `Modal` · `Field`/`Input`/`Textarea`/`Select` · `StatusChip` · Board 시트 5종. Toast · Tabs 미착수.

> **벤치마킹 관련 결정 (2026-08-03).** 사용자 요청으로 대상 제품의 **구조·레이아웃·색·기능 흐름은 맞추되, 긴 안내 문장은 우리 문구로 새로 썼다.** 짧은 기능 라벨(콘텐츠 기획·웹 검색·자체 창작 등)은 업계 공통어라 그대로 쓴다. `grep -ri mirr src/` 0건은 계속 유지한다.

### 🔄 Phase 4: 외부 오픈소스 이식 및 모듈화 — **부분 진행**

- [x] **Board 상호작용 코어 자체 구현** (`src/lib/sheet/`) — 오픈소스 5종 검토 후 **의존성 0 추가**로 결론
- [x] Trigger.dev v3 — `src/trigger/generateRun.ts` 태스크 완료. knip 예외 제거됨
- [x] Supabase Storage 래퍼 (`libs/Storage.ts`) — REST 직접 호출, **의존성 추가 0**
- [x] Stripe Checkout + 웹훅 — 구독 metadata로 테넌트 확정, 기간별 멱등 지급
- [x] LLM 어댑터 — Anthropic 플래너 이식 (`src/lib/plan/planner.ts`)
- [x] 스톡 이미지 어댑터 — Unsplash + 저작권 원장 (`src/lib/images/`)
- [ ] fal 생성 이미지 — 키만 있고 미구현
- [x] **비디오 생성 — 모션그래픽으로 확정.** 렌더 서비스 `/video`(ffmpeg)로 카드 이어붙이기. VPS 에 ffmpeg 설치는 사용자 작업
- [ ] Framer Motion 프리셋 모듈 — **`motion` 패키지는 knip이 미사용으로 잡아 제거했다.** 실제로 쓸 때 재설치한다

### 🎨 마케팅 페이지 — **신규 구축 (2026-08-02)**

배포하고 보니 공개 첫 화면이 **Next.js 보일러플레이트 데모 그대로**였다. 대시보드 작업물은 전부 `/dashboard` 뒤(로그인 필요)에 있어서, 방문자에게는 우리 제품이 하나도 보이지 않는 상태였다.

| 신규 파일 | 역할 |
|---|---|
| `src/app/[locale]/(marketing)/page.tsx` | 랜딩 — 히어로 · 팬아웃 비주얼 · 차별화 3축 · 3단계 · 클로징 CTA |
| `src/components/marketing/MarketingHeader.tsx` | 상단 바 (대시보드 셸과 동일한 1px 라인 언어) |
| `src/components/marketing/MarketingFooter.tsx` | 하단 |
| `src/components/marketing/PanelStack.tsx` | 팬아웃 비주얼 — 소재 1개 → 채널별 컷 3개 |
| `src/components/marketing/PanelStack.test.tsx` | 브라우저 테스트 3건 (삭제된 `BaseTemplate.test.tsx` 대체) |

**디자인 규칙 준수**: Hex 직접 사용 0건(전부 시맨틱 토큰) · 사용자 노출 문자열 0건 하드코딩(`HomePage` 네임스페이스) · **`--signal` 라임은 팬아웃 비주얼의 "AI 생성" 마커 단 한 곳** · 그림자 대신 1px 라인 · `320/768/1024` 대응 · `<section aria-labelledby>` 시맨틱 마크업.

### 🚀 배포 — **완료 (2026-08-02)**

**라이브: https://cardnews-limigogos-projects.vercel.app**

| 항목 | 상태 |
|---|---|
| Supabase | ✅ `cardnews` 스키마 · 테이블 10 · enum 4 · `plan_limits` 시드 4행 · `0002` 인덱스 |
| Vercel 프로젝트 | ✅ `limigogos-projects/cardnews` — **2026-08-02 `yumiaena-alt/cardnew` 저장소로 Git 연결** (`vercel git connect`가 `Connected` 반환). 그전까지는 CLI 배포만 썼고 Git 연결이 없었다 |
| 프로덕션 환경변수 | ✅ `DATABASE_URL`(6543 트랜잭션 풀러) · `CLERK_SECRET_KEY` · `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` · `CLERK_WEBHOOK_SECRET` |
| Deployment Protection | ✅ 해제 (`ssoProtection: null`) — **켜져 있으면 Clerk 웹훅이 Vercel 로그인벽에 막힌다** |
| 프로덕션 스모크 | ✅ `<html lang="ko">` · `/sign-in` Clerk 렌더 · 웹훅 서명 없음→400 / 잘못된 서명→400 |

**배포하며 밟은 함정 3가지**

1. **DB 비밀번호 URL 인코딩.** `!@#`를 그대로 넣으면 `@`에서 호스트가 끊기고 `#`부터는 프래그먼트로 잘린다. 게다가 dotenv는 unquoted 값의 `#`을 주석으로 처리한다. → `%21%40%23`
2. **마이그레이션은 5432(세션), 런타임은 6543(트랜잭션).** 6543으로는 DDL이 안 된다.
3. **Deployment Protection은 웹훅도 막는다.** 팀 프로젝트 기본값이 `all_except_custom_domains`라 Clerk·Stripe 웹훅이 전부 실패한다. 공개 여부와 무관하게 반드시 처리해야 한다.

> **마이그레이션 실행법**: 자격증명은 `.env.migrate.local`(gitignore 대상)에 있다. `.env.local`에 넣으면 **vitest·Playwright까지 프로덕션 DB를 때리므로** 절대 합치지 않는다.
> ```
> node node_modules/dotenv-cli/cli.js -e .env.migrate.local -- node node_modules/drizzle-kit/bin.cjs migrate
> ```

### 배포 준비 이력 — **완료**

- [x] GitHub 푸시 완료 — **저장소를 `yumiaena-alt/cardnew`로 옮겼다** (2026-08-02). 로컬 `origin`도 이쪽을 가리킨다. 옛 저장소 `next-boilerplate-drizzle-clerk`는 GitHub에 남아 있지만 더 이상 쓰지 않는다
- [x] `vercel.json` — 리전 `icn1`(서울), `buildCommand`를 `next build`로 오버라이드
- [x] `docs/06-DEPLOYMENT.md` — 절차 · 필수 환경변수 · 리스크
- [x] Vercel CLI 인증 확인 (`yumiaena-alt` / 팀 `limigogos-projects`)
- [x] **Supabase 프로젝트 생성** (`wprxbwoxmznmlmzbuwgz`, ap-northeast-2)
- [x] Vercel 프로젝트 생성 + 환경변수 4개 등록
- [x] `npx vercel --prod` — 배포 완료

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

### 편집기·학습 (2026-08-06 추가)

캔버스 편집기와 디자인 학습이 들어왔다. 둘 다 실측으로 확인했다.

| 기능 | 확인한 값 |
|---|---|
| 캔버스 편집 | 300px 드래그 → `y=0.2222`(=300÷1350) → 저장 → 스토리지 이미지 해시 변경 |
| 텍스트·사진 | 내용 수정 · 사진 교체 시 **저작자 표기 자동 갱신** · `object-fit: cover` 초점 |
| 레이어 | 추가(텍스트/도형) · 색상 피커 · 숨기기/잠그기/순서/복제/삭제 |
| 정렬 가이드 | 중앙에서 6px → 정확히 540으로 스냅, 안내선 1개 |
| 디자인 학습 | 참고 3장 → cover/body/cta 레이아웃 + 색·타이포, 18초 |
| 학습 적용 | 배경 `#1a1a1a`(기본 `#141210`) · 제목 위치 `0.400` 일치 |
| 템플릿 관리 | 이름 변경 · 삭제(확인 후) |
| 기획 3소스 | 자체 창작 / 웹 검색(계절·시기) / 내 자료(기존 카드 후속) — 셋 다 다른 결과 |

**`panels.doc` 컬럼이 추가됐다** (마이그레이션 `0014_panel_slide_doc`, 로컬·프로덕션 적용 완료).
슬롯은 카드가 **무슨 말을 하는지**만 담고 **어디에 있는지**는 못 담아서, 레이아웃 편집을 저장할 곳이 없었다.

**비용 측정이 들어왔다.** 그전까지 `providerCostUsd: 0`을 박아 넣고 있어서 마진 검증이 불가능했다.
차감액이 실제 비용의 3배 미만이면 경고 로그를 남긴다. 이 기준이 디자인 학습 5크레딧(2.5배)을 즉시 잡아내 **10크레딧으로 올렸다**.

### 현재 멈춘 위치

**생성 경로가 처음부터 끝까지 실제로 돌았다 (2026-08-03).** 견적 15 → 차감 → 큐 인계 → Anthropic 기획 → Unsplash 조달 → 렌더(VPS) → Supabase 업로드 → Deck·Panel 저장 → 마감(환불 0). 카드 5장, 전부 서명 URL 로 열리는 JPEG. 약 90초.

**막힌 것은 없다.** 남은 것은 Clerk 로그인이 필요한 화면 검증과, 계정 연동·발행·자동 DM 을 실제 Meta 트래픽으로 확인하는 일뿐이다.

**SNS 연동 3종 · 예약 발행 · 릴스 영상 · Board 브라우저 검증까지 코드로 끝났다. 남은 것은 전부 외부 설정에 막혀 있다 — 렌더 서비스 · Supabase Storage · Trigger.dev 키 · Meta 앱 자격증명.**

**§4 의 1~3·5·6·7번이 모두 끝났다.** 남은 4번(생성 경로 실동작 검증)은 §4 0번 사용자 작업이 풀려야 시작된다 — 렌더 서비스 · Supabase Storage · Trigger.dev 키 · Meta 앱 자격증명. 그 넷이 들어오면 생성 · 발행 · 영상 · 자동 DM 이 한꺼번에 실동작 검증 단계로 들어간다.

R3(제공사 미선정)은 해결됐다 — Anthropic(기획) · Unsplash(스톡) · fal(생성 이미지), 키 전부 `.env.local`에 있고 `Env.ts`에서 검증한다.

### 조각은 다 모였다. 남은 건 배선이다

| 있음 | 없음 |
|---|---|
| 슬라이드 문서 모델 · 조판 · 템플릿(84조합 검증) | Trigger.dev 태스크 (`src/trigger/`) ← **계정에 막힘** |
| 가독성 자동 결정 · 폰트 맞춤 | 생성 실행 루프 (§5-2 8단계) |
| Anthropic 플래너 + JSONL 스트리밍 파서 | 렌더 서비스 VPS 배포 ← 사용자 작업 |
| 스톡 이미지 조달 + 저작권 원장 | 생성 UI (`DryRunPanel` 모달) |
| 렌더 서비스 코드 (`services/render/`) | `createRun()`을 부르는 Server Action |
| 크레딧 원장 (멱등 · 초과인출 차단) | Trigger.dev 계정 ← 사용자 작업 |
| **`runs`·`run_items` 등 테이블 12개** | |
| **`createRun()` / `finalizeRun()`** | |

### 이번 세션에 한 것 (마이그레이션 `0003`~`0006` + `createRun()`)

**마이그레이션 4종 — 전부 추가만 한다.** `DROP`·`ALTER COLUMN`·`DELETE` 0건을 실측으로 확인했고, 빈 PGlite에 `0000`~`0006`을 통째로 적용해 통과시켰다.

| 마이그레이션 | 내용 |
|---|---|
| `0003_template` | `templates` · `template_versions` · `design_learnings` (+ enum `template_source`) |
| `0004_deck` | `decks` · `deck_versions` · `panels` (+ enum `deck_status` · `run_scope_kind`) |
| `0005_deck_active_version` | `decks.active_version_id` FK **한 줄뿐** — 순환 참조 해소 |
| `0006_board_and_run` | `boards` · `board_rows` · `board_row_outputs` · `series_templates` · `runs` · `run_items` (+ enum `board_row_status` · `run_status`) |

> ⚠️ **`0002` 스냅샷에서 `public.counter`를 지웠다.** 모델 파일(`models/Schema.ts`)은 진작 삭제됐는데 스냅샷은 그 테이블을 계속 추적하고 있었다. 그래서 drizzle-kit이 새 테이블마다 "이게 `counter`의 이름 변경이냐"고 대화형으로 물어 `generate`가 아예 진행되지 않았고, 방치했으면 언젠가 `DROP TABLE counter`를 뱉었을 것이다. **DB의 테이블 자체는 그대로 둔다**(R9 결정). 스냅샷은 dev 전용이라 `db:migrate`에는 영향이 없다.

**`createRun()` (`src/features/run/`)** — §5-2의 1~7단계. 8단계(실제 생성)는 큐가 없어 비워 뒀고, Run은 `queued`에 남아 워커를 기다린다.

| 파일 | 역할 |
|---|---|
| `src/validations/RunValidation.ts` | 입력 Zod 스키마. 채널·비율 enum을 Drizzle enum에서 가져와 DB와 어긋날 수 없게 했다 |
| `src/features/run/estimate.ts` | Cut 단위 견적. **dry-run 견적과 실제 과금이 같은 함수**라 "본 금액 ≠ 청구 금액"이 구조적으로 불가능 |
| `src/features/run/repository.ts` | Run·RunItem 접근. 전부 `orgScoped()` 경유 |
| `src/features/run/service.ts` | `createRun()` · `finalizeRun()` |

**설계 결정 4가지**

1. **크레딧은 큐에 넣기 전에 차감한다.** 완료 후 과금이면 잔액보다 많은 Run을 동시에 띄울 수 있고, 잔액을 확인할 시점엔 이미 제공사 비용이 나간 뒤다.
2. **중간에 죽은 Run은 재개한다.** Run 삽입과 차감 사이에서 죽으면 `estimated`로 남는데, 같은 멱등키로 다시 부르면 그대로 돌려주는 대신 차감을 마저 진행한다. spend 멱등키가 `run:{runId}`라 재게시가 없다.
3. **부분 실패는 정상 경로다.** 한 장이 실패해도 나머지는 남고, **못 만든 Cut만** 환불한다. Run이 `failed`가 되는 건 아무것도 안 나왔을 때뿐 — 첫 장 실패로 나머지를 중단한 경우가 바로 그것이다(참고: `toneflow/apps/web/src/lib/pipeline/cardnews-job.ts:415`의 `if (index === 0) throw error`).
4. **RunItem 결과에 `canceled`를 뒀다.** 첫 장 실패로 **시도조차 못 한** Cut을 `failed`와 구분하기 위한 것이다. 둘 다 환불 대상이지만 원인이 다르다.

> 부분 환불을 위해 `refundCredits()`를 credit 서비스에 추가했다. 기존 `refundSpend()`는 spend를 **전액** 되돌리는 것이라 "3개 중 1개 실패"를 표현할 수 없다.

### 다음 세션의 순서

**1) ~~`createRun()`을 부르는 Server Action + `DryRunPanel` 모달~~ — 완료 (`e28e8e9`).**

| 파일 | 역할 |
|---|---|
| `src/features/run/actions.ts` | `submitRun()` Server Action. 도메인 에러는 **메시지가 아니라 code로** 넘긴다(내부 id가 섞여 있어서) |
| `src/components/ui/Modal.tsx` | Base UI Dialog 래퍼 — 첫 모달 프리미티브 |
| `src/components/board/DryRunPanel.tsx` | 견적 모달. 확인을 눌러야 크레딧이 빠진다 |
| `src/components/board/runInput.ts` | 시트 행 → `RunItemInput[]`. 소재 없거나 채널 0개인 행은 여기서 버린다 |

- **견적은 서버가 준 값을 쓴다.** 시트가 헤더에 계산해 둔 합계를 그대로 청구하면 "본 금액 ≠ 청구 금액"이 생길 수 있다. `runInput.test.ts`가 두 계산을 서로 맞춰 고정한다.
- **`TRIGGER_SECRET_KEY`가 없으면 실제 실행을 거부한다** (R13 대응). 액션에서 `createRun()` **이전에** 막아 원장에 아무것도 안 남는다.
- Board의 플레이스홀더 잔액(50)을 실제 원장 `SUM`으로 교체했다.
- `templateVersionId`를 **선택**으로 바꿨다. 이식한 템플릿 엔진이 이미 주제로 템플릿을 고르는데, 필수로 두면 템플릿 선택 UI가 생길 때까지 아무도 호출할 수 없다.

**2) ~~Trigger.dev 태스크~~ — 완료 (`6c4e0c6`).**

| 파일 | 역할 |
|---|---|
| `src/trigger/generateRun.ts` | 태스크. Run을 `running`으로 올리고 Cut별로 생성한 뒤 `finalizeRun()` 호출 |
| `src/features/run/pipeline.ts` | Cut 1개 생성 — 기획 → 조판 → 렌더 → 업로드 → Deck·Panel 저장 |
| `src/features/run/queue.ts` | 차감 경로 → 워커 인계. 멱등키 `run:{runId}` |
| `src/libs/RenderService.ts` · `src/libs/Storage.ts` | 렌더 서비스 클라이언트 · Supabase Storage(REST) |
| `src/features/run/readiness.ts` | 큐·렌더·스토리지 중 하나라도 미설정이면 차감 거부 |

**설계 결정 4가지**

1. **기획은 소재당 1회, 파생 Cut은 재사용한다.** 분할 과금(원본 15 / 파생 5)이 정당한 이유가 이것이다. 채널마다 다시 기획하면 토큰을 두 번 쓸 뿐 아니라 **채널 간 문구가 갈라진다**.
2. **첫 장 실패 시 나머지는 시도하지 않는다.** 원인은 대개 모델이나 렌더러 불통이라, 50장을 똑같이 실패시키며 시간·원가만 태우고 어차피 환불하게 된다. 시도조차 못 한 항목은 `failed`가 아니라 `canceled`로 남겨 원인을 구분한다.
3. **큐 인계 실패도 환불한다.** 차감 후 `tasks.trigger()`가 실패하면 아무도 Run을 집어가지 않는다. 이걸 안 막으면 사용자가 **침묵에 돈을 낸다**. 되돌리고 Run을 `failed`로 만든다.
4. **차감 전에 파이프라인 전체 설정을 검사한다.** 큐만 보던 것을 렌더·스토리지까지 넓혔다. 마지막 업로드 단계에서 막히면 결국 환불 사이클만 남기 때문이다.

**3) `run_items`에 소재·비율을 넣었다 (`0007`).** 전에는 board_row를 거쳐야만 알 수 있어서, 보드 밖에서 시작한 Run은 스스로를 설명하지 못했고 워커 재시도가 시트가 안 바뀐 것에 의존했다.

**4) Panel에 기획 문구를 슬롯으로 저장한다.** PNG만 남기면 나중에 헤드라인 수정이 픽셀 편집이 된다.

### 이식 결과 (상세는 `docs/07-PORTED-MODULES.md`)

| 단계 | 내용 | 이식 테스트 |
|---|---|---|
| 1 | SlideDoc 모델 · WCAG 가독성 · autofit | 67 |
| 2 | 조판 · 스택 · CSS · 렌더러 | — |
| 3 | 템플릿 엔진 | 84 |
| 4 | JSONL 스트리밍 파서 | 11 |
| 5 | Anthropic 플래너 | — |
| 6 | 스톡 이미지 + 저작권 원장 | 23 |
| 7 | 렌더 서비스 (`services/render/`) | — |

**이식한 테스트 185건이 전부 수정 없이 통과했다.** 원본 가이드의 합격 기준이 그것이다.

1-C에서 남은 것은 **Stripe 결제뿐**이고, 그건 `stripe` 패키지 설치 승인이 필요하다.

1-B에서 남은 것은 **코드가 아니라 Clerk 대시보드 설정(사용자 작업)** 과, 조직 범위
엔드포인트가 없어 1-D로 연기한 교차 조직 404 테스트뿐이다.

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
| `41f2868` | **마이그레이션 `0003`~`0006`** — template · deck · 순환 FK · board+run |
| `097bbc0` | **`createRun()` / `finalizeRun()`** + 부분 환불 `refundCredits()` |
| `e28e8e9` | **생성 진입점 배선** — `submitRun()` 액션 · `Modal` · `DryRunPanel` · 시트 변환 |
| `6c4e0c6` | **생성 파이프라인** — Trigger 태스크 · `pipeline.ts` · `Storage` · `RenderService` · `0007` |
| `7b6f4a8` | 파이프라인 미설정 시 차감 거부 (`readiness.ts`) |
| `da251af` | **Deck 뷰어 + 스톡 이미지** — 목록·상세·서명 URL · 저작권 표기 |
| `0cb725e` | 실행 후 피드백 — 시작 상태 · `StatusChip` |
| `7de50f1` | **단건 생성 폼** (`/dashboard/deck/new`) + `Field`/`Select`/`Textarea` |
| `94997c2` | **Board 영속화** — 월간 보드 자동 생성 · 편집마다 저장 |
| `4a71254` | **카드 문구 편집** — `isUserEdited` 기록 · 이미지 불일치 배지 |
| `843985c` | 보드 변환 계층 테스트 12건 |
| `7a0a998` | **Stripe 체크아웃 + 웹훅** · Pretendard 셀프호스팅 · 편집 글자수 상한 수정 |
| `168bb1a` | **콘텐츠 기획** — 아이디어 생성 → 보드로 |
| `760d13e` | **레퍼런스 리서치** — 광고 라이브러리 검색 (`0008`) |
| `fd61753` | **링크로 카드뉴스** — SSRF 차단 포함 |
| `de1cfe2` | **블로그 초안** (`0009`) |
| `0e534fa` | **발행 캘린더** |
| `0d7ddea` | **성과 대시보드** |
| `4ee21f3` | **부분 재생성** — 카드 1장 다시 그리기 (`0010`) |
| `b93e9c3` | **자동 DM · 댓글 인박스** — `social_accounts`/`dm_automations`/`dm_sends` (`0011`) |
| `2626c89` | **계정 연동 + 토큰 암호화** — AES-256-GCM · 서명된 OAuth state |
| `4b0e67f` | **계정 연동 완결** — 장기 토큰 교환 · Graph 프로필 조회 · 암호화 저장 · 결과 배너 |
| `fe76f71` | **자동 DM 실행부** — 댓글 웹훅(서명 검증) · 규칙 매칭 · private reply · 발송 선점 |
| `92774fe` | **댓글 인박스 실제 목록** — 미답변 댓글 실시간 조회 |
| `d629e30` | **예약 발행** — `schedules`/`publications` (`0012`) · 예약 UI · 캘린더 표시 · 폴러 |
| `a2d4618` | **릴스 영상** — 렌더 서비스 `/video`(ffmpeg) · 카드뉴스 상세 패널 (`0013`) |
| `8589b3a` | **필 핸들 버그 수정** + Board 브라우저 테스트 9건 |
| (미커밋) | **Phase 1-B 인증·테넌트** — Clerk 웹훅 · `scope`/`permissions`/`orgScope` · `0002` |

**Phase 1-B 산출물 (신규 파일)**

| 파일 | 역할 |
|---|---|
| `src/app/api/webhooks/clerk/route.ts` | Svix 검증 → 멱등 클레임 → 적용. 프록시 matcher 밖이라 Arcjet 미경유 |
| `src/features/org/repository.ts` | 조직·사용자·멤버십 upsert, `findScopeIdentity()`, 웹훅 멱등 테이블 |
| `src/features/org/service.ts` | 검증된 이벤트 → 리포지토리 분기 |
| `src/features/shared/scope.ts` | `Scope` 타입 · `getScope()` · `requirePermission()` |
| `src/features/shared/permissions.ts` | 권한 카탈로그 · 역할별 grant · `mapClerkRole()` |
| `src/features/shared/orgScope.ts` | `orgScoped()` — 모든 테넌트 쿼리의 `orgId` 필터 강제 |
| `src/features/shared/errors.ts` | `DomainError` + code(`unauthorized`/`forbidden`/`not_found`/`conflict`) |
| `src/validations/ClerkWebhookValidation.ts` | 웹훅 페이로드 Zod 판별 유니온 |
| `migrations/0002_default_project_unique.sql` | `projects(org_id) WHERE is_default` 부분 unique |
| `src/features/credit/repository.ts` | 원장 SUM·조회·삽입 + `withOrgCreditLock()` advisory lock |
| `src/features/credit/service.ts` | `getBalance` · `grantCredits` · `spendCredits` · `refundSpend` · `grantSignupCredits` · `grantMonthlyCredits` |
| `src/features/billing/repository.ts` | `findPlanLimit()` — 플랜 한도는 코드가 아니라 `plan_limits` 테이블에서 |
| `tests/security/clerk-webhook.integ.ts` | 서명 위조·멱등·순서역전 Playwright 테스트 |

**1-B 설계 결정 4가지**

1. **`Scope.orgId`는 Clerk id가 아니라 `organizations.id`(UUID).** 테넌트 테이블이 UUID를
   참조하므로 `getScope()`가 DB에서 해석한다. 이때 **우리 `memberships` 행까지 재확인**해
   웹훅 미동기화·멤버십 취소 상태에서 fail-closed 된다.
2. **에러는 클래스 1개 + `code`.** 린트가 파일당 클래스 1개를 강제한다. 교차 조직 접근은
   `not_found`로 응답해 타 조직 리소스의 존재를 확인시켜 주지 않는다.
3. **웹훅 멱등은 `svix-id` + `processed_at` 2단계.** 적용 완료분만 duplicate로 스킵하고,
   중간에 죽은 클레임은 재처리를 허용한다(핸들러가 전부 upsert라 재적용이 안전).
4. **순서 역전은 409.** 멤버십이 조직·사용자보다 먼저 도착하면 삼키지 않고 Clerk가
   재시도하게 둔다.

> **새 패키지 0개.** Svix 검증은 `@clerk/nextjs/webhooks`의 `verifyWebhook`이 제공하고,
> 서명 라이브러리(`standardwebhooks`)는 `@clerk/backend`에 이미 딸려 있다.

**1-C 설계 결정 3가지**

1. **`Scope`를 `OrgScope`와 분리했다.** 리포지토리는 격리에 `orgId`만 필요하고,
   웹훅·스케줄 잡처럼 사용자가 없는 경로가 **가짜 세션을 만들지 않고** 테넌트에
   작업할 수 있어야 한다. `Scope = OrgScope & {userId, role, …}`라 기존 호출부는 그대로다.
2. **spend는 조직 advisory lock 안에서 실행한다.** 잔액을 읽고 그에 기대어 쓰기 때문에,
   락이 없으면 동시 Run 두 개가 모두 "잔액 충분"을 보고 초과 인출한다. Postgres
   advisory lock은 프로세스를 넘어 직렬화되므로 Trigger.dev 도입 후에도 유효하다.
3. **멱등키는 의미로 도출한다.** 가입 지급은 `signup:{orgId}`, 월간 지급은
   `monthly:{orgId}:{YYYY-MM}`. 웹훅 재전송이나 잡 재실행이 구조적으로 무해해진다.

로컬 개발 환경 수정 (커밋에 포함):
- `db-server:*` 스크립트를 `node` 직접 실행으로 변경 → Windows에서 `npm run build-local` / `npm run dev` 동작
- `next-env.d.ts` 생성 → 이미지 모듈 타입 오류 13건 해소
- Playwright chromium 설치 → `npm run test`의 browser 프로젝트 동작

### 검증 상태 (커밋 `657f633` 기준, 전부 실측)

| 검사 | 결과 |
|---|---|
| `npm run check:types` | ✅ **0건** |
| `npm run lint` | ✅ **error 0건** (Board a11y 4건 · `SlideRenderer` img 3건은 기존 warning) |
| `npm run check:i18n` | ✅ exit 0 |
| `npm run check:deps` (knip) | ✅ 통과 |
| `npm run test` | ✅ **452건 통과** (35개 파일, live 5건은 기본 skip) |
| `npm run build-local` | ✅ **통과** |
| 마이그레이션 `0000`~`0013` | ✅ 빈 PGlite에 전부 적용 · **프로덕션 Supabase 적용 확인** (마이그레이션 14건 · 테이블 28 · enum 10 · `deck_versions.video_path` 존재 · 기존 데이터 보존: 조직 2 · 사용자 2 · 원장 2행) |
| 생성 SQL 파괴적 구문 검사 | ✅ `0003`~`0006`에 `DROP`·`ALTER COLUMN`·`DELETE` **0건** |
| `grep -ri mirr src/ tests/` | ✅ **0건** |
| `npm run test:e2e` | ✅ **15건 전부 통과** — 웹훅 보안 7건 포함 |

**`test:e2e` 관련해 이번에 고친 것**

1. **Windows에서 아예 기동조차 안 됐다.** `playwright.config.ts`의 webServer가
   `pglite-server --run 'run-s db:migrate dev:next'`였는데, pglite-server는 `--run`을
   **셸 없이** 공백으로 잘라 `spawn`한다. 그래서 ① 작은따옴표가 그대로 인자로 들어가고
   ② `run-s`/`npm`은 Windows에서 `.cmd`라 셸 없이 spawn 불가. R7과 동일한 계열의 문제다.
   → `scripts/e2e-server.mjs` 단일 node 진입점으로 교체 (마이그레이션 후 Next 기동).
   CI/로컬 분기는 스크립트 안에서 `process.env.CI`로 처리한다.
2. **`fr` 로케일 잔재 테스트 3건.** `fr`은 이 프로젝트에서 제거됐는데 테스트가 남아 있었다
   (R6 잔재). 마케팅 문구가 아직 미번역이라 문구 비교가 불가능해, 로케일 전환은
   **URL 기준**으로 검증하도록 바꿨다.
3. **`/`는 항상 한국어가 아니다.** next-intl이 첫 요청에서 `Accept-Language`를 감지하는데
   테스트 브라우저가 `en-US`를 보내 `/` → `/en`으로 리다이렉트된다. 기본 로케일을
   전제하는 테스트는 `/en`에서 시작해 `ko`로 전환하는 방식으로 결정론적으로 만들었다.

> ⚠️ **`--project unit`만 돌리지 말 것.** `vitest.config.ts`는 `unit`(node)과 `ui`(chromium browser) 두 프로젝트를 정의한다. `npm run test`로 둘 다 돌려야 한다. Playwright 바이너리가 없으면 `ui`가 실패하므로 새 머신에서는 `npx playwright install chromium`이 필요하다.

### 다음 세션에서 바로 실행할 작업

```
0. 사용자 작업 — 코드로는 못 푼다 (§6 R14~R17, R19)
   → [사용자] 렌더 서비스가 외부에서 안 열린다. 155.94.154.102:3000 연결 거부
     (방화벽/포트 미개방, 또는 127.0.0.1 바인딩 의심) · 게다가 http 라 토큰이 평문으로 나간다
   → [x] Supabase Storage 완료 — 버킷 'cardnews'(비공개) · URL · service_role 키.
     업로드→서명→읽기→삭제 한 바퀴 실측 확인. 버킷 이름은 SUPABASE_STORAGE_BUCKET
   → [x] Meta 앱 4종 완료 — META_APP_ID / META_APP_SECRET /
     META_WEBHOOK_VERIFY_TOKEN / TOKEN_ENCRYPTION_KEY(32바이트 검증).
     isConnectConfigured() = true
   → [x] RENDER_SERVICE_URL = https://cardnews.imgmap.shop (로컬·Vercel 모두 반영)
   → [x] Caddy + Let's Encrypt 인증서 발급 완료 (TLS authorized)
   → [x] 렌더 서비스 상시 구동 완료 — systemd `panelo-render.service`,
     Node 22(/opt/node22) + tsx, PORT=3000, 토큰은 /etc/panelo-render.env(600).
     ffmpeg 설치 완료. /health · /render · /video 전부 실측 확인
   → [사용자] Trigger.dev **프로덕션** 키만 남았다 (로컬은 tr_dev_ 라 Vercel 에 안 올렸다)
   → [x] Vercel 환경변수 동기화 완료 (17개). TRIGGER_SECRET_KEY 만 제외 — 로컬이 dev 키다
   → [사용자] Vercel 환경변수에도 SUPABASE_* · SUPABASE_STORAGE_BUCKET ·
     TRIGGER_SECRET_KEY 를 추가해야 한다 (지금 4개만 등록돼 있다)
   → [사용자] 계정 연동용 4개: META_APP_ID / META_APP_SECRET / TOKEN_ENCRYPTION_KEY
     / META_WEBHOOK_VERIFY_TOKEN (자동 DM 웹훅 구독용 · 임의 문자열)
     키 생성: node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
     Meta 콜백 URL: {APP_URL}/api/oauth/instagram/callback
     Meta 웹훅 URL: {APP_URL}/api/webhooks/instagram  (구독 필드: comments)
     ※ 연동하려는 인스타 계정은 **프로 계정 + 페이스북 페이지 연결**이 되어 있어야 한다.
       개인 계정은 댓글·발행 API 자체가 없어서 프로필 조회가 no_business_account 로 끝난다
   → [사용자] 렌더 VPS 에 ffmpeg 설치 (릴스 영상용). apt-get install -y ffmpeg
     확인: GET /health 의 ffmpeg: true
   → [사용자] (선택) META_AD_LIBRARY_TOKEN — 레퍼런스 리서치용
   → [사용자] (선택) STRIPE_STANDARD_PRICE_ID — 결제용
   ※ 큐·렌더·스토리지 중 하나라도 비면 submitRun 이 차감 전에 거부한다. 크레딧은 안전하다

1. ~~계정 연동 마무리~~ — 완료 (`4b0e67f`)
   → 장기 토큰 교환(약 1시간짜리를 60일짜리로) → Graph `/me/accounts` 프로필 조회
     → encryptSecret() → socialAccounts upsert. 재연동은 같은 행을 갱신하되
     **다른 조직이 쥔 계정은 빼앗지 않는다**(unique 는 전역이라 setWhere 로 막았다)
   → 콜백 결과를 계정 화면이 배너로 읽는다. 그전엔 리다이렉트만 하고 아무도 안 봤다

2. ~~자동 DM 실행부~~ — 완료 (`fe76f71`)
   → `api/webhooks/instagram` (GET 핸드셰이크 · POST 처리). 서명은 **원본 바디**에
     대해 검증한 뒤에야 파싱한다
   → 발송은 **보내기 전에** 댓글 id 로 선점한다. 재전송이 같은 사람에게 두 번
     보내는 것이 이 기능의 유일한 치명적 실패다. 실패한 발송은 사유를 남기고
     선점을 유지한다(재시도로 다시 나가지 않게)
   → 계정 주인 본인의 댓글은 건너뛴다. 같은 웹훅으로 되돌아와 자기 자신과 대화한다

3. ~~댓글 인박스 실제 목록~~ — 완료 (`92774fe`)
   → 최근 게시물 12건의 댓글 중 **답글이 하나도 없는 것**만. DB 미러링 없이 실시간
   → 토큰이 만료된 계정은 조용히 빈 목록이 되지 않고 이름이 뜬다

4. ~~생성 경로 실동작 검증~~ — 완료. 하네스: `src/features/run/pipelineLive.test.ts`
   → `RUN_LIVE_PIPELINE=1 npx vitest run --project unit src/features/run/pipelineLive.test.ts`
     기본은 skip 이다. 실제 제공사 할당량을 쓰고 스토리지에 진짜 객체를 남긴다
   → 확인된 것: 견적 15 · 차감 · 큐 인계(jobId 발급) · 기획 · 조달 · 렌더 ·
     업로드 · panels.render_path · 서명 URL 200 · 마감 후 환불 0
   → **이 과정에서 실제 버그 셋을 잡았다** (아래 §6 R23~R25)

5. ~~비디오 생성~~ — 완료 (`a2d4618`). **모션그래픽으로 확정**
   → 생성 API는 우리 카드와 무관한 영상을 만든다. 그러면 팬아웃(소재 1개 →
     채널별 변형)이라는 축 자체가 성립하지 않는다. 이미 렌더된 PNG를 재사용하니
     추가 원가도 0이다
   → 렌더 서비스에 `POST /video`(ffmpeg). **VPS 에 ffmpeg 설치 필요** —
     `GET /health` 의 `ffmpeg: true` 로 확인한다
   → 과금하지 않는다. 픽셀 값은 생성할 때 이미 냈고, 재인코딩에 값을 매기면
     작업이 아니라 포맷에 값을 매기는 것이 된다
   → 장면 전환은 컷 전환뿐. `xfade` 는 입력 수만큼 필터 체인이 필요해 미뤘다

6. ~~예약 발행~~ — 완료 (`d629e30`)
   → `0012_schedule_publish` (추가 전용, 파괴적 구문 0건). **프로덕션 미적용** —
     .env.migrate.local 로 사람이 검토 후 적용해야 한다
   → 폴러는 5분 주기. 예약마다 타이머를 거는 대신 테이블을 읽는다 —
     배포가 끊은 타이머는 되살릴 방법이 없다
   → SKIP LOCKED 로 집고, 집는 순간 attempts 를 올린다. 3회까지 재시도하고
     그 뒤엔 failed 로 남는다(조용히 영원히 재시도하지 않게)
   → **실제 발행은 미검증** — Meta 앱 자격증명과 Trigger.dev 키가 둘 다 필요하다

7. ~~Board 브라우저 검증~~ — 완료 (`8589b3a`). **Storybook 대신 vitest 브라우저 모드**
   (chromium)로 했다. 이미 설정돼 있어 새 패키지가 0개고, Board 는 로그인 뒤라
   Playwright e2e 로는 자격증명 없이 닿을 수 없다
   → **실제 버그를 하나 찾았다.** 필 핸들 드래그가 하이라이트만 보여주고 아무것도
     쓰지 않고 있었다. 드래그가 리스너를 한 번만 등록하는데 `applyFill` 이
     그 시점 렌더의 `fillPreview`(=null)를 읽고 있었다
   → 검증 항목: 방향키 이동 · 셀 위 타이핑 · Escape · 실행취소 · Delete ·
     TSV 붙여넣기 · 필 드래그
```

**다음 세션 시작 프롬프트**

```
docs/project_status.md 의 §4 와 §6, 그리고 CLAUDE.md 를 먼저 읽어 줘. 전부 읽지는 말고.

§4 '다음 세션에서 바로 실행할 작업'은 4번만 남았고, 그건 0번 사용자 작업에 막혀
있다. 0번이 풀렸는지 먼저 확인하고, 아직이면 무엇을 할지 물어봐 줘.

- 이미 있는 것을 다시 만들지 말 것: createRun/finalizeRun, 견적, Board 영속화,
  Deck 뷰어·편집·부분 재생성, 블로그, 캘린더, 성과, 기획, 레퍼런스, 링크 변환,
  Stripe, 암호화(libs/Crypto.ts), 키워드 매칭(features/social/matching.ts),
  계정 연동 전체(features/social/connect.ts · repository.ts),
  자동 DM 실행부(features/social/service.ts · signature.ts · reply.ts),
  댓글 인박스(features/social/comments.ts),
  예약 발행 전체(features/publish/* · models/Publish.ts · trigger/publishDue.ts),
  릴스 영상(features/deck/video.ts · services/render/src/video.ts).

작업 방식:
- 머지 게이트 전부 통과 후 커밋: lint → check:types → check:i18n → check:deps
  → test → build-local → test:e2e
- 마이그레이션이 생기면 SQL 을 눈으로 검토하고, 프로덕션 적용은
  .env.migrate.local 로 (§2 하단 명령)
- 커밋한 턴에 이 문서(§2 체크리스트 · §4 · §6)를 같이 갱신해 줘.
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

> **2026-08-03 실동작 검증에서 잡은 것들** — 전부 고쳐서 커밋했다. 같은 계열이 또 나올 수 있어 남긴다.
>
> | # | 무엇이 | 왜 안 보였나 |
> |---|---|---|
> | R23 | Supabase 신형 키(`sb_secret_`)는 `apikey` 헤더가 있어야 한다. 없으면 JWT 로 파싱하려다 400 | 업로드도 서명도 같은 경로라, 뷰어는 이미지가 **조용히** 안 뜨는 상태였다(서명 실패를 null 로 삼킨다) |
> | R24 | 카드를 PNG 로 저장했다. 사진이 들어간 카드가 10MB. 인스타는 8MB 초과·JPEG 외 포맷을 거부한다 | 렌더도 저장도 성공하므로 발행을 시도하기 전까지 아무 신호가 없다 |
> | R25 | 기획 모델의 이미지 지시는 문장인데 Unsplash 는 문장에 0건을 준다. 첫 실행의 카드 전부가 사진 없이 나왔다 | 로그가 "검색 결과 없음"이라 라이브러리가 빈 것처럼 읽힌다 |

| # | 리스크 | 조치 필요 시점 |
|---|---|---|
| R1 | **상표 미검증** — `Panelo`의 `panel`은 일반명사라 식별력이 약하다. KIPRIS(35·42·9류) / USPTO / EUIPO 검색과 `panelo.app` 도메인 확보가 아직 안 됐다 | **브랜드 에셋 제작 전.** 현재 브랜드명은 i18n 키(`DashboardNav.brand_name`)로만 노출되므로 교체 비용은 낮다 |
| ~~R18~~ | ~~비디오 생성 백엔드 미결정~~ → **모션그래픽으로 확정 (2026-08-03).** 렌더 서비스에 `/video`(ffmpeg) 구현. 남은 것은 VPS 에 ffmpeg 설치(사용자 작업)와 실동작 확인 | 완료 |
| ~~R8~~ | ~~Board UI 브라우저 미검증~~ → **해결됨.** vitest 브라우저 모드로 9건. 그 과정에서 필 핸들이 아무것도 쓰지 않던 버그를 찾아 고쳤다 | 완료 |
| ~~R19~~ | ~~SNS 계정 연동이 없다~~ → **코드는 완료 (2026-08-03).** 테이블(`0011`) · OAuth · 장기 토큰 · 암호화 저장 · 댓글 웹훅 · 자동 DM 발송 · 댓글 인박스가 전부 있다. **남은 것은 Meta 앱 자격증명 4개(사용자 작업)** 와, 실제 Meta 트래픽으로의 검증이다 | 자격증명 입력 시 |
| R20 | **자동 DM·댓글 인박스가 실제 Meta 트래픽으로 미검증.** 서명 검증·중복 방지·매칭은 단위 테스트로 고정했지만, 실물 웹훅 페이로드와 private reply 발송은 아직 돌려보지 않았다. Meta 앱 검수(App Review)에서 `instagram_manage_comments` 승인도 필요하다 | 자격증명이 들어온 직후 |
| R22 | **예약 발행이 실제로 나가본 적이 없다.** 컨테이너 생성 → 발행 2단계는 Meta 문서대로 짰지만 실물 호출은 안 해봤다. 이미지 URL 은 Supabase 서명 URL이라 **버킷·서명이 동작해야** Meta 가 받아갈 수 있다(R16 과 묶여 있다). `0012` 는 프로덕션 미적용 | 자격증명·스토리지가 들어온 직후 |
| R21 | **저장된 액세스 토큰이 약 60일 뒤 만료된다.** 갱신 잡이 없다. 지금은 만료되면 댓글 인박스가 해당 계정을 "불러오지 못함"으로 표시하고 사용자가 재연동해야 한다. `tokenExpiresAt` 은 이미 저장하므로 갱신 잡을 붙일 자리는 있다 | 첫 계정 연동 후 50일 이내 |
| ~~R14~~ | ~~렌더 서비스가 외부에서 닿지 않는다~~ → **해결됨 (2026-08-03).** `https://cardnews.imgmap.shop` 에서 `/health` 200 · `browserRunning: true` · `ffmpeg: true`. 실제로 1080x1350 PNG 렌더(1.5초)와 3장짜리 6초 mp4 인코딩(13초)까지 돌려 확인했다. **막고 있던 것은 방화벽이 아니라 세 가지였다**: ① Caddy 가 ACME 챌린지까지 https 로 리다이렉트해 인증서가 발급되지 않았다 ② VPS 에 `node_modules` 가 아예 없었다(서비스가 한 번도 뜬 적이 없다) ③ 문서가 안내한 `node --experimental-strip-types` 로는 이 서비스가 뜰 수 없다(JSX + 확장자 없는 import + 생성자 파라미터 프로퍼티). 지금은 `tsx` + systemd(`panelo-render.service`)로 상시 구동한다 | 완료 |
| ~~R15~~ | ~~렌더 서비스가 HTTPS 가 아니다~~ → **해결됨 (2026-08-03).** Let's Encrypt 인증서로 TLS `authorized: true`, `RENDER_SERVICE_URL` 도 로컬·Vercel 모두 `https://cardnews.imgmap.shop`. 토큰이 평문으로 나가던 구간이 사라졌다. 3000 번은 애초에 외부에 열린 적이 없어 토큰 교체는 불필요로 본다. 옛 기록: `RENDER_SERVICE_TOKEN`(공유 시크릿)이 `Authorization: Bearer` 헤더로 **평문**으로 공용 인터넷을 건넌다. 경로상 누구든 토큰을 주워 우리 Chromium 을 마음대로 돌리고 카드 내용을 볼 수 있다. `docs/07-PORTED-MODULES.md` §7 이 Caddy 리버스 프록시 + 자동 인증서를 요구한 이유가 이것이다 | **토큰이 이미 평문으로 나갔다면 교체가 필요하다.** HTTPS 적용과 함께 |
| ~~R16~~ | ~~Supabase Storage 미설정~~ → **해결됨 (2026-08-03).** 버킷 `cardnews`(`SUPABASE_STORAGE_BUCKET`), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`(신형 `sb_secret_`) 전부 설정. **업로드 → 서명 URL 발급 → 읽기 → 삭제 한 바퀴를 실제로 돌려 확인**했다. 처음에 공개 버킷이었으나 **비공개로 전환**했고, 전환 후에도 서명 URL 은 200, 서명 없는 공개 접근은 400 으로 차단되는 것을 확인했다 | 완료 |
| ~~R17-env~~ | ~~Vercel 환경변수 미동기화~~ → **해결됨 (2026-08-03).** 프로덕션에 17개 등록: Supabase 3 · Meta 4 · 렌더 2 · AI 3 · `NEXT_PUBLIC_APP_URL` · 기존 Clerk/DB 4. **`TRIGGER_SECRET_KEY` 는 일부러 뺐다** — 로컬 값이 `tr_dev_` 라 그대로 올리면 프로덕션 Run 이 개발 큐로 들어간다. 프로덕션 키를 따로 발급해 넣어야 한다 | 프로덕션 큐 키 발급 시 |
| R17 | **Vercel 자동 배포가 안 걸린다.** `vercel git connect` 는 `Connected` 를 반환했지만 `main` 푸시 후 새 배포가 생기지 않았다(전부 CLI 배포). GitHub App 이 `cardnew` 저장소 접근 권한을 못 받은 것으로 보인다. 지금은 `npx vercel --prod` 로 수동 배포 중 | 배포 자동화가 필요할 때 |
| ~~R12~~ | ~~마이그레이션 미적용~~ → **해결됨 (2026-08-03).** `0003`~`0007` 을 프로덕션 Supabase 에 적용했다. 테이블 22개 · enum 9개, 기존 데이터(조직 2 · 원장 2행) 보존 확인 | 완료 |
| ~~R13~~ | ~~Run이 `queued`에 쌓이기만 하고 아무도 안 집어간다~~ → **해결됨 (2026-08-03).** `TRIGGER_SECRET_KEY`(`tr_dev_…`)와 `TRIGGER_PROJECT_REF` 가 `.env.local` 에 들어왔다. 태스크는 이미 있다. **배포 환경에는 프로덕션 키가 따로 필요하다** | 완료(로컬) |
| R2 | 폰트 미적용 — `global.css`에 패밀리명만 정의, 실제 파일 없음 → 현재 시스템 폰트로 렌더 | 다음 세션 |
| ~~R7~~ | ~~`build-local` 실패~~ → **해결됨** (`7c1f59a`). 두 단계 문제였다: ① 작은따옴표를 Windows가 못 넘김 ② 고친 뒤엔 `spawn npm ENOENT`(Windows는 `npm.cmd`라 shell 없이 spawn 불가). `node`로 직접 실행해 해결. **당초 "CI 게이트가 막혔다"고 기록한 것은 과장이었다** — CI는 `ubuntu-latest`라 원래 정상이었고 Windows 로컬 전용 문제였다 | 완료 |
| ~~R11~~ | ~~Clerk 시크릿 키 미설정~~ → **해결됨.** 사용자가 `.env.local`에 실제 키를 넣었는데도 같은 에러가 났는데, 원인은 **`.env.local` 안에 `CLERK_SECRET_KEY`가 두 번 정의**된 것이었다(10행 실제 키, 36행 `your_clerk_secret_key` placeholder). **dotenv는 나중 값이 이긴다** → placeholder가 승리. 36행 제거로 해결. 이제 `/sign-in`·`/dashboard/*`가 로컬에서 정상 렌더되므로 **R8(Board UI 브라우저 검증)도 착수 가능** | 완료 |
| R10 | **Clerk 웹훅이 실제 Clerk 트래픽으로는 미검증.** 자체 서명 Playwright 테스트 7건(서명 위조·멱등·순서역전)은 실서버+PGlite 대상으로 전부 통과했다. 남은 것은 Clerk 대시보드에서 엔드포인트 등록 후 "Send test event"로 실물 페이로드 확인 | Clerk Organizations 활성화 직후 |
| R9 | `counter` 테이블만 `public` 스키마에 남아 있다 (보일러플레이트 데모, `0000`에서 생성). 나머지는 전부 `cardnews` | 마케팅 페이지 정리 시 테이블째 제거 |
| R3 | LLM·이미지 API 제공사 미선정 → 크레딧 단가(15cr/5cr)의 원가 검증 안 됨 | 로드맵 1-D 착수 전 |
| ~~R2~~ | ~~폰트 미적용~~ → **해결됨 (2026-08-03).** 로컬 브라우저에서 `document.fonts.check('16px \"Pretendard Variable\"')` = true, Instrument Serif 로드 확인. 아래 기록은 이전 상태다. **부분 해결.** Instrument Serif(디스플레이) · JetBrains Mono(수치)를 `next/font/google`로 빌드 타임 셀프호스팅. **Pretendard는 아직 미적용** — Google Fonts에 없어 npm 패키지(`pretendard`) 설치 승인이 필요하다. 그때까지 한글은 시스템 sans로 렌더된다 (`--font-display` 폴백 꼬리를 `serif`에서 sans 스택으로 바꿨다 — 한글 시스템 serif는 낡아 보인다) | Pretendard 설치 승인 시 |
| ~~R6~~ | ~~보일러플레이트 잔재~~ → **해결됨.** `/about` `/portfolio` `/counter` `/api/counter` 라우트, `Counter*`·`Sponsors`·`Hello`·`Demo*`·`BaseTemplate` 컴포넌트, 관련 로케일 네임스페이스 10개, e2e 8건을 제거하고 Panelo 랜딩 페이지로 교체. 프로덕션에서 4개 경로 전부 404 확인 | 완료 |
| ~~R9~~ | ~~`counter` 테이블이 `public`에 남음~~ → **코드에서는 제거됨**(`models/Schema.ts` 삭제). **테이블 자체는 DB에 그대로 둔다** — 파괴적 마이그레이션이라 사람이 리뷰 후 실행할 일이다. 아무것도 참조하지 않으므로 무해 | 스키마 정리 시 |
| ~~R4~~ | ~~Supabase 미생성~~ → **해결됨.** 마이그레이션 3종 적용 완료. 로컬은 계속 PGlite, 프로덕션만 Supabase | 완료 |
| R5 | `npm audit` 취약점 43건 (critical 5) — 기존 보일러플레이트 의존성 | 별도 점검 필요 |
| R6 | 기존 보일러플레이트 잔재 — `Counter`, `Portfolio`, `Sponsors`, `Hello` 등 데모 코드가 남아 있음 | 마케팅 페이지 작업 시 정리 |
