# 04. 태스크리스트 — Panelo

기준일: 2026-08-02 · 버전 0.3 (v0 자산 반영)

표기: `[ ]` 미착수 · `[~]` 진행 중 · `[x]` 완료 · **P0** 필수 · **P1** 권장

---

## Phase 0 — 착수 전 확인 (개발 시작 조건)

| # | 태스크 | 담당 | 우선 |
|---|---|---|---|
| 0.1 | `[ ]` **KIPRIS 상표 검색** — 35류·42류·9류 "panel*" 유사군 | 기획 | P0 |
| 0.2 | `[ ]` USPTO TESS / EUIPO 검색 | 기획 | P0 |
| 0.3 | `[ ]` 도메인 확보 — `panelo.app` 우선, `getpanelo.com` 대안 | 기획 | P0 |
| 0.4 | `[ ]` 상표 결과에 따라 브랜드 확정 또는 대안(Deckly) 전환 | 기획 | P0 |
| 0.5 | `[ ]` LLM·이미지 API 제공사 선정 + 단가표 확보 (크레딧 원가 검증) | 개발 | P0 |
| 0.6 | `[ ]` Supabase 프로젝트 생성 (`ap-northeast-2`) | 개발 | P0 |

> **0.1~0.4가 끝나기 전에는 브랜드명이 들어가는 코드·에셋을 만들지 않는다.** 로고·도메인·i18n 문자열 전체를 다시 갈아야 한다.

---

## Phase 1 — 생성 코어 (5주)

**목표**: SNS 연동 없이 "생성 → 편집 → 다운로드"가 완결된다.

### 1-Z. v0 자산 이관 ⭐선행 (3일)

다른 Phase 1 작업보다 **먼저** 끝낸다. 현재 `npx tsc --noEmit`이 16건 실패 중이며, 이 상태로는 어떤 UI 작업도 진행할 수 없다. 상세는 [02-ARCHITECTURE §0](02-ARCHITECTURE.md) 참조.

| # | 태스크 | 우선 |
|---|---|---|
| 1.Z1 | `[ ]` **`sidebar.tsx` 로고 `mirr` 제거** + `placeholder.tsx` "mirr 워크스페이스" 문구 제거 (저작권) | **P0 최우선** |
| 1.Z2 | `[ ]` 의존성 설치 — `@base-ui/react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react` | P0 |
| 1.Z3 | `[ ]` `lib/utils.ts` → `src/lib/utils.ts` 이관 (`@/*`가 `./src/*`를 가리킴) | P0 |
| 1.Z4 | `[ ]` `components/ui/button.tsx` → `src/components/ui/Button.tsx` + `signal` variant 추가 | P0 |
| 1.Z5 | `[ ]` `components/dashboard/*` → `src/components/dashboard/*` 이관 (PascalCase 정렬) | P0 |
| 1.Z6 | `[ ]` props 구조분해 → `props.foo` 규약으로 교정 (`AGENTS.md`) | P0 |
| 1.Z7 | `[ ]` **루트 `components/`·`lib/` 삭제** — 두 벌 공존 금지 | P0 |
| 1.Z8 | `[ ]` `npx tsc --noEmit` 오류 0건 확인 | P0 |
| 1.Z9 | `[ ]` `views/*` 처리 — planning·research 폐기, creation은 Deck 진입점으로 축소, placeholder → `EmptyState` | P0 |

### 1-A. 기반 정비 (1주)

| # | 태스크 | 우선 |
|---|---|---|
| 1.1 | `[ ]` 로케일 전환 — `AppConfig.i18n.locales`를 `['ko','en']`, `defaultLocale: 'ko'`로 변경 | P0 |
| 1.2 | `[ ]` `src/locales/ko.json` 생성, `fr.json` 제거 (소스는 `en.json` 유지) | P0 |
| 1.3 | `[ ]` Clerk `koKR` 로컬라이제이션 등록 (`AppConfig.ClerkLocalizations`) | P0 |
| 1.4 | `[ ]` `motion` 패키지 설치 + `MotionProvider`(LazyMotion + reduced-motion 래퍼) | P0 |
| 1.5 | `[ ]` **`global.css`에 `:root` / `.dark` / `@theme inline` 토큰 이식** ([05-DESIGN-SYSTEM §2](05-DESIGN-SYSTEM.md)) — 이게 없으면 v0 컴포넌트가 무채색으로 렌더된다 | P0 |
| 1.6 | `[ ]` 폰트 설치 — Pretendard Variable, JetBrains Mono, Instrument Serif | P0 |
| 1.7 | `[ ]` **v0 하드코딩 한국어 → next-intl 키 전환** (Sidebar, Topbar, navData) | P0 |
| 1.8 | `[ ]` **IA 재구성** — `navData.ts`를 Board 중심으로 ([05-DESIGN-SYSTEM §5](05-DESIGN-SYSTEM.md)) | P0 |
| 1.9 | `[ ]` **SPA view 스위칭 → App Router 라우팅** 전환, `DashboardShell`을 `dashboard/layout.tsx`로 | P0 |
| 1.10 | `[ ]` 사이드바 하단 3버튼 → 크레딧 잔액 + 업그레이드 하나로 축소 | P1 |
| 1.11 | `[ ]` `DATABASE_URL`을 Supabase pooler(6543)로 전환. 로컬은 PGlite 유지 | P0 |
| 1.12 | `[ ]` `src/models/` 도메인 분리 + `index.ts` re-export, `drizzle.config.ts` 경로 변경 | P0 |
| 1.13 | `[ ]` `Env.ts`에 신규 환경변수 추가 (Supabase, Stripe, LLM, Resend) | P0 |
| 1.14 | `[ ]` `libs/Storage.ts` — Supabase Storage 래퍼 + 서명 URL 유틸 | P0 |
| 1.15 | `[ ]` CI 파이프라인 확정 — `lint → check:types → check:i18n → check:deps → test → build-local → test:e2e` | P0 |

### 1-B. 인증 · 테넌트 (0.5주)

| # | 태스크 | 우선 |
|---|---|---|
| 1.16 | `[ ]` Clerk 대시보드에서 Organizations 활성화 | P0 |
| 1.17 | `[ ]` 마이그레이션 `0001_org_and_users` | P0 |
| 1.18 | `[ ]` `api/webhooks/clerk` — Svix 검증 + `webhook_events` 멱등 처리 | P0 |
| 1.19 | `[ ]` 가입 시 조직 + `default` 프로젝트 자동 생성 | P0 |
| 1.20 | `[ ]` `features/shared/scope.ts` — `getScope()`, `requirePermission()` | P0 |
| 1.21 | `[ ]` 리포지토리 규약 확립 — 모든 함수 첫 인자 `Scope`, 모든 쿼리에 `orgId` 필터 | P0 |
| 1.22 | `[ ]` `tests/security/tenant-isolation.integ.ts` — 조직 간 접근이 404를 반환 | P0 |
| 1.23 | `[ ]` 워크스페이스/프로젝트 스위처 UI **숨김 처리** (v0 사이드바의 breadcrumb 영역) | P0 |

### 1-C. 과금 기반 (0.5주)

| # | 태스크 | 우선 |
|---|---|---|
| 1.24 | `[ ]` 마이그레이션 `0002_billing` + `plan_limits` 시드 (free/standard) | P0 |
| 1.25 | `[ ]` `features/credit` — `getBalance()`(SUM), `grant()`, `spend()`, `refund()` 전부 멱등 | P0 |
| 1.26 | `[ ]` 단위 테스트 — 동일 idempotencyKey 재호출 시 잔액 불변 | P0 |
| 1.27 | `[ ]` Stripe Checkout (Standard 단일 플랜) + 웹훅 | P0 |
| 1.28 | `[ ]` 가입 시 Free 50cr 지급, 월간 지급 잡 | P0 |
| 1.29 | `[ ]` `CreditBadge` 컴포넌트 (mono + tabular-nums) — v0 사이드바의 "AI 60 left" 자리를 대체 | P0 |

### 1-D. 생성 파이프라인 (2주)

| # | 태스크 | 우선 |
|---|---|---|
| 1.30 | `[ ]` 마이그레이션 `0003_template` ~ `0006_run` (`0005`에서 순환 FK 분리) | P0 |
| 1.31 | `[ ]` **`features/run/estimate.ts`** — 크레딧 견적 순수 함수 + 단위 테스트 | P0 |
| 1.32 | `[ ]` **Batch-first `createRun()`** — `items[]`, `scope`, `dryRun`, `idempotencyKey` | P0 |
| 1.33 | `[ ]` Arcjet rate limit — 조직당 분당 10 Run | P0 |
| 1.34 | `[ ]` LLM 기획 단계 — 주제 → Panel별 슬롯 텍스트 | P0 |
| 1.35 | `[ ]` 이미지 생성 + Storage 업로드 + blurDataURL | P0 |
| 1.36 | `[ ]` Panel 렌더링 (슬롯 → PNG) | P0 |
| 1.37 | `[ ]` 실패 시 `refund()` 자동 역분개 + 통합 테스트 | P0 |
| 1.38 | `[ ]` `runs.cost_snapshot` 실제 원가 기록 | P0 |
| 1.39 | `[ ]` 시스템 템플릿 12종 시드 (4:5 위주, 스타일 4계열 × 3변형) | P0 |

### 1-E. UI (1주)

v0에서 확보한 것: `Button`, 사이드바, 톱바, 셸 레이아웃, `EmptyState`(placeholder 전환). **신규로 만들 것만** 아래에 남긴다.

| # | 태스크 | 우선 |
|---|---|---|
| 1.40 | `[ ]` `ui` 신규 6종 — Input, Select, Chip, Modal, Toast, Tabs (v0 `button.tsx` 패턴 준수) | P0 |
| 1.41 | `[ ]` `Button`에 `signal` variant 추가 + AI 액션 전용 사용 규칙 문서화 | P0 |
| 1.42 | `[ ]` 각 컴포넌트 Storybook 스토리 + a11y 스캔 통과 (라이트·다크 양쪽) | P0 |
| 1.43 | `[ ]` 템플릿 갤러리 — v0 `reference-research`의 탭·필터 레이아웃 패턴 재활용, URL SearchParams 기반 | P0 |
| 1.44 | `[ ]` 단건 생성 폼 (주제 · 템플릿 · Panel 수 · 추가 지시) | P0 |
| 1.45 | `[ ]` **`DryRunPanel`** — 크레딧 차감 경로는 반드시 이 패널 경유 | P0 |
| 1.46 | `[ ]` Deck 에디터 — Panel 캔버스 + 슬롯 인라인 편집 (다크 테마) | P0 |
| 1.47 | `[ ]` Slot 재생성 (1cr) / Panel 재생성 (3cr) | P0 |
| 1.48 | `[ ]` PNG / ZIP 다운로드 (Free는 워터마크) | P0 |
| 1.49 | `[ ]` 온보딩 — 가입 후 첫 Deck까지 3스텝 가이드 | P1 |

### ✅ Phase 1 완료 기준

- [ ] 가입 → 생성 → 슬롯 편집 → ZIP 다운로드 E2E 통과
- [ ] 생성 실패 시 크레딧 100% 환불 (통합 테스트로 증명)
- [ ] 조직 격리 테스트 통과
- [ ] TTFV(가입→첫 다운로드) ≤ 5분
- [ ] CI 전 단계 그린 · Lighthouse 마케팅 페이지 성능 ≥ 90
- [ ] **코드·문구·에셋 어디에도 `mirr` 문자열이 없다** (`grep -ri mirr src/` 결과 0건)
- [ ] **루트 `components/`·`lib/` 폴더가 삭제되어 있다**

---

## Phase 2 — Board & Fan-out ⭐핵심 (6주)

**목표**: 12행 × 3채널 = 36 Cut을 한 번에 만든다.

### 2-A. Board 데이터 (1주)

| # | 태스크 | 우선 |
|---|---|---|
| 2.1 | `[ ]` 마이그레이션 `0009_board` | P0 |
| 2.2 | `[ ]` `features/board` — CRUD, 행 순서(position 간격 부여), 대량 upsert | P0 |
| 2.3 | `[ ]` **Fan-out 확장 로직** — 1행 + `fanoutTargets[]` → `RunItem[]` (순수 함수 + 단위 테스트) | P0 |
| 2.4 | `[ ]` Board 단위 견적 집계 (원본 15 / Cut 5) | P0 |

### 2-B. Board UI (2.5주)

| # | 태스크 | 우선 |
|---|---|---|
| 2.5 | `[ ]` `BoardGrid` — `role="grid"`, 가상 스크롤, 행 높이 40px | P0 |
| 2.6 | `[ ]` `BoardCell` — 5가지 상태 (기본/hover/focus/편집/에러) | P0 |
| 2.7 | `[ ]` 키보드 내비게이션 — 방향키·Enter·Esc·Tab | P0 |
| 2.8 | `[ ]` **클립보드 붙여넣기** — TSV 파싱 → 다중 행 생성 | P0 |
| 2.9 | `[ ]` **드래그 필 핸들** — 날짜 연속 채우기, 값 복제 | P0 |
| 2.10 | `[ ]` 다중 셀 선택 + 일괄 편집 | P0 |
| 2.11 | `[ ]` **`⌘Z` 실행취소** — 커맨드 스택 (최소 20단계) | P0 |
| 2.12 | `[ ]` `FanoutCell` — 채널별 체크박스 + 비율 자동 매핑 | P0 |
| 2.13 | `[ ]` 행 상태 인라인 표시 + 진행률 | P0 |
| 2.14 | `[ ]` 1024px 미만 카드 리스트 폴백 | P0 |
| 2.15 | `[ ]` Board 필터 — URL SearchParams (status·channel·기간) | P1 |

### 2-C. 배치 실행 (1.5주)

| # | 태스크 | 우선 |
|---|---|---|
| 2.16 | `[ ]` Trigger.dev v3 도입 + `run.generate` 잡 | P0 |
| 2.17 | `[ ]` 배치 실행 — 행 단위 병렬, 동시성 제한 | P0 |
| 2.18 | `[ ]` **Cut 파생 로직** — 원본 본문 재사용 + 채널 톤 조정 + 리레이아웃 | P0 |
| 2.19 | `[ ]` 실시간 진행률 (폴링 또는 SSE) | P0 |
| 2.20 | `[ ]` **실패 행만 재시도** | P0 |
| 2.21 | `[ ]` 부분 실패 시 성공분 유지 + 실패분만 환불 | P0 |
| 2.22 | `[ ]` 배치 완료 알림 (인앱 + 이메일) | P1 |

### 2-D. 브랜드킷 · 디자인 학습 (1주)

| # | 태스크 | 우선 |
|---|---|---|
| 2.23 | `[ ]` 마이그레이션 `0007_brand` | P0 |
| 2.24 | `[ ]` 브랜드킷 설정 — 팔레트·폰트·말투·금칙어 | P0 |
| 2.25 | `[ ]` Fan-out 톤 조정이 브랜드킷 규칙을 따르는지 검증 | P0 |
| 2.26 | `[ ]` 디자인 학습 — 이미지 ≤10장 업로드 → 템플릿 생성 (5cr) | P1 |
| 2.27 | `[ ]` **권리 보유 확인 체크박스 강제** + `rightsConfirmedAt` 기록 | P0 |
| 2.28 | `[ ]` 업로드 검증 — MIME + 매직넘버, 10MB, PNG/JPG/WEBP | P0 |

### 2-E. 데모 Board (0.5주)

| # | 태스크 | 우선 |
|---|---|---|
| 2.29 | `[ ]` 가입 즉시 **읽기 전용 데모 Board** 제공 (샘플 12행 × 3채널 완성본) | P0 |
| 2.30 | `[ ]` "내 것으로 복제" → 주제만 바꿔 바로 실행 | P0 |

### ✅ Phase 2 완료 기준

- [ ] 12행 × 3채널 배치 성공률 ≥ 95%
- [ ] Dry-run 견적 오차 ≤ 5%
- [ ] 소재 1건 3채널 총 크레딧 ≤ 25cr
- [ ] 붙여넣기 → 실행까지 클릭 ≤ 5회
- [ ] Board 전 기능 키보드 조작 가능 (a11y 스캔 통과)
- [ ] 36 Cut 배치 완료 시간 ≤ 10분

---

## Phase 3 — 발행 루프 (7주)

### 3-A. SNS 연동 (2주)

| # | 태스크 | 우선 |
|---|---|---|
| 3.1 | `[ ]` 마이그레이션 `0010_publish` | P0 |
| 3.2 | `[ ]` **Instagram** OAuth + 토큰 암호화 저장 | P0 |
| 3.3 | `[ ]` Threads 연동 | P0 |
| 3.4 | `[ ]` TikTok 연동 | P1 |
| 3.5 | `[ ]` YouTube 연동 | P1 |
| 3.6 | `[ ]` 토큰 자동 갱신 + 만료 임박 알림 (24시간 전) | P0 |
| 3.7 | `[ ]` Meta 앱 심사 제출 | P0 |

### 3-B. 예약 발행 (1.5주)

| # | 태스크 | 우선 |
|---|---|---|
| 3.8 | `[ ]` 스케줄러 — 1분 cron + `FOR UPDATE SKIP LOCKED` | P0 |
| 3.9 | `[ ]` 채널별 발행 어댑터 (멱등키 = `schedules.id`) | P0 |
| 3.10 | `[ ]` 지수 백오프 3회 + 실패 알림 | P0 |
| 3.11 | `[ ]` **중복 발행 방지 통합 테스트** (동시 실행 시나리오) | P0 |
| 3.12 | `[ ]` 캘린더 뷰 (월·주간) + 드래그 리스케줄 | P0 |
| 3.13 | `[ ]` Board 행 → 캘린더 자동 배치 | P0 |

### 3-C. 월간 배치 세션 (1.5주)

| # | 태스크 | 우선 |
|---|---|---|
| 3.14 | `[ ]` `series_templates` — RRULE 기반 반복 슬롯 | P0 |
| 3.15 | `[ ]` **빈칸 감지** — "8월에 12칸 비어 있어요" | P0 |
| 3.16 | `[ ]` 배치 마법사 — 빈칸 → Board 자동 생성 → 주제만 입력 | P0 |
| 3.17 | `[ ]` AI 주제 제안 (브랜드킷 + 과거 성과 기반) | P1 |

### 3-D. 성과 (1.5주)

| # | 태스크 | 우선 |
|---|---|---|
| 3.18 | `[ ]` `metrics.collect` 잡 — 발행 후 7/14/30일 | P0 |
| 3.19 | `[ ]` 성과 대시보드 — 기간·채널·비교 | P0 |
| 3.20 | `[ ]` CSV 내보내기 | P1 |
| 3.21 | `[ ]` 템플릿별 성과 랭킹 (재사용 판단 근거) | P1 |

### 3-E. 탐색 (0.5주)

| # | 태스크 | 우선 |
|---|---|---|
| 3.22 | `[ ]` `⌘K` 커맨드 팔레트 | P1 |
| 3.23 | `[ ]` 단축키 체계 + `?` 치트시트 | P1 |
| 3.24 | `[ ]` Deck 생애주기 타임라인 | P1 |
| 3.25 | `[ ]` 소재 중복 감지 (임베딩 유사도 ≥0.85) | P1 |

### 3-F. 플랜 확장

| # | 태스크 | 우선 |
|---|---|---|
| 3.26 | `[ ]` Pro / Agency 플랜 개방 + 초과 과금 | P0 |

### ✅ Phase 3 완료 기준

- [ ] 예약 발행 성공률 ≥ 99% · 중복 발행 0건
- [ ] 월간 배치 세션 완주 시간 ≤ 30분
- [ ] Instagram 앱 심사 통과
- [ ] 북극성 지표(배치 세션 완주율) 측정 가능

---

## Phase 4 — 확장 (8주+)

| # | 태스크 | 우선 |
|---|---|---|
| 4.1 | `[ ]` 멀티 프로젝트 UI 해제 (스위처 노출) | P0 |
| 4.2 | `[ ]` 멤버 초대 + `reviewer` 역할 + 승인 워크플로 | P0 |
| 4.3 | `[ ]` 공유 링크 검수 (로그인 없이 코멘트) | P1 |
| 4.4 | `[ ]` **Supabase RLS 심층 방어** — Clerk JWT 기반 정책 (앱 가드 유지) | P0 |
| 4.5 | `[ ]` 댓글 통합 인박스 + AI 답글 초안 | P1 |
| 4.6 | `[ ]` 자동 DM (플랫폼 심사 통과 후) | P1 |
| 4.7 | `[ ]` 공개 REST API + API 키 관리 | P1 |
| 4.8 | `[ ]` MCP 서버 | P1 |
| 4.9 | `[ ]` `en` 로케일 완성 + 해외 결제 | P1 |
| 4.10 | `[ ]` WCAG 2.2 AA 전면 감사 | P0 |
| 4.11 | `[ ]` 복구 리허설 (분기 1회 정례화) | P0 |

---

## 상시 태스크 (전 Phase)

| # | 태스크 | 주기 |
|---|---|---|
| C.1 | `[ ]` `runs.cost_snapshot` 집계 — 크레딧 수익 vs 실제 원가 | 주 1회 |
| C.2 | `[ ]` Sentry 신규 이슈 트리아지 | 주 1회 |
| C.3 | `[ ]` PostHog 퍼널 점검 (가입→첫 Run→첫 Board→첫 예약) | 주 1회 |
| C.4 | `[ ]` 의존성 업데이트 + `check:deps` | 격주 |
| C.5 | `[ ]` 마이그레이션 SQL 사람 리뷰 | 매 PR |

---

## 법무 트랙 (Phase 1과 병행)

| # | 태스크 | 마감 |
|---|---|---|
| L.1 | `[ ]` 이용약관 (크레딧 = 선불 이용권, 유효기간·소멸 명시) | Phase 1 종료 전 |
| L.2 | `[ ]` 개인정보처리방침 (처리위탁 목록 + 국외이전 고지) | Phase 1 종료 전 |
| L.3 | `[ ]` 마케팅 수신동의 분리 UI + 시각 기록 | Phase 1 |
| L.4 | `[ ]` 회원탈퇴 플로우 (30일 유예 + 즉시 파기 옵션) | Phase 1 |
| L.5 | `[ ]` AI 저작권 고지 + 레퍼런스 권리 확인 체크 | Phase 2 |
| L.6 | `[ ]` 전자상거래 표기 + 환불 규정 | Stripe 오픈 전 |
| L.7 | `[ ]` 쿠키 배너 (분석 도구 기본 OFF) | Phase 1 |
| L.8 | `[ ]` 플랫폼 개발자 약관 준수 검토 | Phase 3 |
