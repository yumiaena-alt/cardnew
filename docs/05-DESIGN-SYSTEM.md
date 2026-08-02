# 05. 디자인 시스템 — Panelo

기준일: 2026-08-02 · 버전 0.3 (v0 자산 반영)

## 0. 이 문서의 전제

프로젝트 루트 `components/` · `lib/`에 v0.dev로 생성한 대시보드 셸이 배치되어 있다. 이 문서는 **그 자산을 뼈대로 삼는다.**

| v0 자산 | 채택 여부 | 판단 |
|---|---|---|
| Base UI + `cva` 조합 | ✅ 채택 | shadcn보다 가볍고 접근성 프리미티브가 견고하다 |
| `cn()` (clsx + tailwind-merge) | ✅ 채택 | |
| 시맨틱 토큰 네이밍 (`--primary`, `--card`, `--sidebar-*`, `--status-*`) | ✅ 채택 | **토큰 이름을 유지하면 컴포넌트 코드를 안 고치고 값만 바꿔 브랜드를 입힐 수 있다** |
| lucide-react 아이콘 | ✅ 채택 | |
| 레이아웃 구조 (사이드바 + 톱바 + 메인) | ✅ 채택 | |
| 색상 **값** (보라 계열 primary) | ❌ 교체 | 잉크 블랙 + 시그널 라임으로 전면 교체 |
| IA / `nav-data.ts` | ❌ 교체 | Mirr 메뉴 복제 → Board 중심으로 재구성 |
| 로고·문구의 `mirr` | ❌ 제거 | 저작권 리스크. Phase 1-A에서 즉시 제거 |
| 하드코딩 한국어 문자열 | ❌ 교체 | next-intl 키로 전환 |
| view 스위칭 SPA 패턴 | ❌ 교체 | App Router 라우팅으로 전환 |

## 1. 방향: Editorial Workbench

| 원칙 | 내용 |
|---|---|
| 라인 우선 | 그림자 대신 1px `--border`로 구조를 만든다. 그림자는 hover와 오버레이에만 |
| 잉크가 주인공 | `--primary`는 보라가 아니라 **잉크 블랙**. v0의 `bg-primary` 버튼·`text-primary` 아이콘이 전부 차분한 잉크로 바뀐다 |
| 라임은 AI 전용 | `--signal`은 **AI가 개입하는 지점에만**. 생성 버튼, 진행 바, 견적 패널, 포커스 링 |
| 비균일 라운드 | 칩 999 / 필드 8 / 카드 12 / 모달 20 |
| 밀도 있는 작업면 | Board는 스프레드시트다. 여백보다 정보 밀도와 스캔 속도가 우선 |
| 테마 | 관리 화면 = 라이트 기본. **Deck 에디터 = 다크 기본**. v0의 class 기반 토글(`documentElement.classList`) 유지 |

로고 모티프: 하나의 사각형이 세로선으로 분할되는 형태. "한 소재가 여러 장(panel)으로 갈라진다"의 직역.

## 2. 토큰 정의

`src/styles/global.css`에 작성한다. Tailwind v4의 `@theme inline` 패턴으로 CSS 변수를 유틸리티에 연결한다.

```css
@layer theme, base, clerk, components, utilities;

@import 'tailwindcss';

/* 다크 모드를 class 기반으로 (v0 셸의 documentElement.classList.toggle('dark')와 연동) */
@custom-variant dark (&:where(.dark, .dark *));

:root {
  /* ── Surface: 웜 페이퍼 ── */
  --background:            #FBFAF7;
  --foreground:            #14140F;
  --card:                  #FFFFFF;
  --card-foreground:       #14140F;
  --popover:               #FFFFFF;
  --popover-foreground:    #14140F;

  /* ── Primary: 잉크 블랙 (주요 액션·아이콘) ── */
  --primary:               #14140F;
  --primary-foreground:    #FBFAF7;

  /* ── Secondary: 클레이 (보조 강조) ── */
  --secondary:             #F7E4DC;
  --secondary-foreground:  #8F3A1C;

  /* ── Signal: AI 개입 지점 전용 ⭐ ── */
  --signal:                #C8F751;
  --signal-foreground:     #14140F;
  --signal-subtle:         #EEFBC4;
  --signal-strong:         #8FBF12;

  /* ── Neutral ── */
  --muted:                 #F2F0EA;
  --muted-foreground:      #5C5A52;
  --accent:                #F2F0EA;
  --accent-foreground:     #14140F;
  --border:                #E4E0D6;
  --input:                 #E4E0D6;
  --ring:                  #8FBF12;   /* 포커스 링 = 라임 */

  /* ── Semantic ── */
  --destructive:            #C1362B;
  --destructive-foreground: #FFFFFF;
  --success:                #1F7A4C;
  --warning:                #B5730B;
  --info:                   #2C5FA8;

  /* ── Sidebar (v0 셸이 참조) ── */
  --sidebar:                    #F7F5F0;
  --sidebar-foreground:         #14140F;
  --sidebar-border:             #E4E0D6;
  --sidebar-accent:             #EAE6DC;
  --sidebar-accent-foreground:  #14140F;

  /* ── Status: Board 행 · 칸반 열 (v0 셸이 참조) ── */
  --status-wait:              #FDF6E3;
  --status-wait-border:       #F0E0B0;
  --status-wait-foreground:   #7A5B0B;
  --status-draft:             #EEF4FD;
  --status-draft-border:      #C7DBF5;
  --status-draft-foreground:  #24537F;
  --status-done:              #EDF7F0;
  --status-done-border:       #C0E3CD;
  --status-done-foreground:   #1F6B41;
  --status-fail:              #FDEEEC;
  --status-fail-border:       #F5C9C4;
  --status-fail-foreground:   #9B2C22;

  /* ── Radius: 의도적 비균일 ── */
  --radius-sm:    6px;
  --radius-md:    8px;    /* button.tsx가 min(var(--radius-md), …)로 참조 */
  --radius-lg:    12px;
  --radius-xl:    20px;
  --radius-chip:  9999px;
}

.dark {
  --background:            #111310;
  --foreground:            #EDEBE4;
  --card:                  #1B1E19;
  --card-foreground:       #EDEBE4;
  --popover:               #1B1E19;
  --popover-foreground:    #EDEBE4;

  --primary:               #EDEBE4;   /* 다크에서는 반전 */
  --primary-foreground:    #14140F;

  --secondary:             #3A241C;
  --secondary-foreground:  #E8B9A5;

  --signal:                #C8F751;   /* 라임은 양쪽 동일 */
  --signal-foreground:     #14140F;
  --signal-subtle:         #2A3312;
  --signal-strong:         #A9DC2E;

  --muted:                 #22261F;
  --muted-foreground:      #9A968A;
  --accent:                #262B22;
  --accent-foreground:     #EDEBE4;
  --border:                #2C3129;
  --input:                 #2C3129;
  --ring:                  #A9DC2E;

  --destructive:            #E0685C;
  --destructive-foreground: #14140F;
  --success:                #4FB783;
  --warning:                #E0A63C;
  --info:                   #6D9EE0;

  --sidebar:                    #161914;
  --sidebar-foreground:         #EDEBE4;
  --sidebar-border:             #2C3129;
  --sidebar-accent:             #262B22;
  --sidebar-accent-foreground:  #EDEBE4;

  --status-wait:              #2E2611;
  --status-wait-border:       #4A3D16;
  --status-wait-foreground:   #E0C067;
  --status-draft:             #17222E;
  --status-draft-border:      #24374A;
  --status-draft-foreground:  #8FB8E0;
  --status-done:              #152A1E;
  --status-done-border:       #22432F;
  --status-done-foreground:   #7CCFA0;
  --status-fail:              #2E1815;
  --status-fail-border:       #4A2420;
  --status-fail-foreground:   #E89A90;
}

@theme inline {
  --color-background:            var(--background);
  --color-foreground:            var(--foreground);
  --color-card:                  var(--card);
  --color-card-foreground:       var(--card-foreground);
  --color-popover:               var(--popover);
  --color-popover-foreground:    var(--popover-foreground);
  --color-primary:               var(--primary);
  --color-primary-foreground:    var(--primary-foreground);
  --color-secondary:             var(--secondary);
  --color-secondary-foreground:  var(--secondary-foreground);
  --color-signal:                var(--signal);
  --color-signal-foreground:     var(--signal-foreground);
  --color-signal-subtle:         var(--signal-subtle);
  --color-signal-strong:         var(--signal-strong);
  --color-muted:                 var(--muted);
  --color-muted-foreground:      var(--muted-foreground);
  --color-accent:                var(--accent);
  --color-accent-foreground:     var(--accent-foreground);
  --color-border:                var(--border);
  --color-input:                 var(--input);
  --color-ring:                  var(--ring);
  --color-destructive:           var(--destructive);
  --color-destructive-foreground:var(--destructive-foreground);
  --color-success:               var(--success);
  --color-warning:               var(--warning);
  --color-info:                  var(--info);

  --color-sidebar:                   var(--sidebar);
  --color-sidebar-foreground:        var(--sidebar-foreground);
  --color-sidebar-border:            var(--sidebar-border);
  --color-sidebar-accent:            var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);

  --color-status-wait:              var(--status-wait);
  --color-status-wait-border:       var(--status-wait-border);
  --color-status-wait-foreground:   var(--status-wait-foreground);
  --color-status-draft:             var(--status-draft);
  --color-status-draft-border:      var(--status-draft-border);
  --color-status-draft-foreground:  var(--status-draft-foreground);
  --color-status-done:              var(--status-done);
  --color-status-done-border:       var(--status-done-border);
  --color-status-done-foreground:   var(--status-done-foreground);
  --color-status-fail:              var(--status-fail);
  --color-status-fail-border:       var(--status-fail-border);
  --color-status-fail-foreground:   var(--status-fail-foreground);

  --font-sans:    'Pretendard Variable', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-display: 'Instrument Serif', 'Pretendard Variable', serif;
  --font-mono:    'JetBrains Mono', ui-monospace, monospace;
}
```

### 왜 이 매핑이 중요한가

v0 컴포넌트가 이미 쓰고 있는 클래스가 **코드 수정 없이** 브랜드 색으로 바뀐다.

| v0 코드 (그대로 유지) | 렌더 결과 |
|---|---|
| `bg-primary text-primary-foreground` (로고 배지, 아바타, CTA) | 잉크 블랙 배지 |
| `text-primary` (Sparkles 등 아이콘) | 잉크 — 차분한 에디토리얼 톤 |
| `bg-primary/15 text-primary` (D-3 배지) | 웜 그레이 틴트 + 잉크 |
| `bg-sidebar border-sidebar-border` | 웜 페이퍼 사이드바 |
| `bg-status-wait border-status-wait-border` | 앰버 틴트 칸반 열 |
| `focus-visible:ring-ring/50` | **라임 포커스 링** |

**신규 작업**: AI 생성 액션만 `bg-signal text-signal-foreground`로 교체한다. 이게 유일한 색상 규칙 변경이다.

## 3. 타이포그래피

| 역할 | 폰트 | 스펙 |
|---|---|---|
| 디스플레이 (마케팅) | Instrument Serif + Pretendard | `clamp(2rem, 1.2rem + 3vw, 3.5rem)`, tracking -2% |
| 헤딩 | Pretendard Variable 600·700 | 20 / 24 / 30px |
| 본문·UI | Pretendard Variable 400·500 | 15px / line-height 1.6 |
| 보조 | Pretendard Variable 400 | 13px, `text-muted-foreground` |
| **수치·크레딧** | JetBrains Mono | `tabular-nums` **필수** |

v0 컴포넌트가 `text-sm`(14px)을 기본으로 쓰고 있다. 본문 기준을 15px로 올리려면 `--text-sm`을 재정의하지 말고 **Board·폼에서만 `text-[0.9375rem]`을 명시**한다 (v0 셸의 기존 밀도를 깨지 않기 위함).

로딩: 2 패밀리 + 모노 1개. `font-display: swap`. Pretendard 400/600만 preload. Instrument Serif는 마케팅 라우트에서만.

**Board 시트는 반드시 `tabular-nums`.** 숫자 폭이 흔들리면 시트로 읽히지 않는다.

## 4. 컴포넌트 규약

### 4-1. 신규 컴포넌트 작성 규칙

v0의 `components/ui/button.tsx` 패턴을 표준으로 삼는다.

```
1. Base UI 프리미티브를 감싼다 (접근성·키보드는 프리미티브에 위임)
2. cva로 variant / size 정의
3. cn()으로 className 병합
4. data-slot 속성 부여 (그룹 셀렉터용)
5. focus-visible 링을 전 variant 공통으로
```

단, **프로젝트 규약과 충돌하는 부분은 교정한다** (`AGENTS.md`):

| v0 코드 | 프로젝트 규약 | 조치 |
|---|---|---|
| `function Button({ className, variant, ...props })` | 단일 `props` 파라미터, `props.foo`로 접근 | 이관 시 교정 |
| 하드코딩 한국어 | next-intl 키 | 전량 교체 |
| `export default` 없음 (이미 named) | named export only | 유지 |

### 4-2. Button variant 확장

v0의 6개 variant(`default`/`outline`/`secondary`/`ghost`/`destructive`/`link`)에 **하나만 추가**한다.

```ts
signal: 'bg-signal text-signal-foreground hover:bg-signal/90',
```

용도: **AI 생성 실행 전용.** 카드뉴스 생성, Board 배치 실행, Slot 재생성. 그 외에는 절대 쓰지 않는다.

### 4-3. BoardCell (신규 · 최우선)

시트 조작감의 핵심. 일반 Input과 분리한 전용 컴포넌트.

| 상태 | 스타일 |
|---|---|
| 기본 | 보더 없음, 배경 투명, 내용만 |
| hover | `bg-accent` |
| focus | 2px `border-foreground`가 셀 경계를 정확히 덮음 (offset 0) |
| 편집 중 | `bg-card` + `shadow-sm` — 셀이 살짝 떠오름 |
| 선택 범위 | `bg-signal-subtle` + 범위 외곽만 2px `border-signal-strong` |
| 에러 | 우상단 3px 삼각 마커(`destructive`) + 툴팁 |

키보드: `↑↓←→` 이동 · `Enter` 편집/확정 · `Esc` 취소 · `Tab` 다음 셀 · `⌘C/V` · `⌘Z`.

### 4-4. CreditBadge (신규)

크레딧 불안을 제거하는 시그니처 컴포넌트.

```
[ ⬦ 264 cr ]  견적      → text-secondary-foreground / bg-secondary
[ ⬦ 500 cr ]  잔액 충분  → text-muted-foreground
[ ⬦ 42 cr  ]  20% 미만  → text-warning + 충전 링크
숫자는 항상 font-mono + tabular-nums
```

### 4-5. DryRunPanel (신규 · 필수 경로)

생성 실행 직전 **항상** 노출한다. 이 패널을 거치지 않고 크레딧이 차감되는 경로는 존재해선 안 된다.

```
┌──────────────────────────────────────────┐
│ 실행 견적                                 │
│ 원본 12건 × 15cr             180 cr      │
│ 파생 Cut 24건 × 5cr          120 cr      │
│ ────────────────────────────────────     │
│ 합계                         300 cr      │
│ 잔여 500 cr → 실행 후 200 cr             │
│                                           │
│  [ 취소 ]      [ ⚡ 36건 생성 ]  ← signal │
└──────────────────────────────────────────┘
```

### 4-6. 기존 v0 컴포넌트 이관 매핑

| v0 파일 | 이관 위치 | 변경 |
|---|---|---|
| `lib/utils.ts` | `src/lib/utils.ts` | 경로만 (별칭이 `src`를 가리킴) |
| `components/ui/button.tsx` | `src/components/ui/Button.tsx` | `signal` variant 추가, props 규약 교정 |
| `components/dashboard/dashboard-shell.tsx` | `src/components/dashboard/DashboardShell.tsx` | view 스위칭 → App Router 라우팅 |
| `components/dashboard/sidebar.tsx` | `src/components/dashboard/Sidebar.tsx` | **로고 `mirr` 제거**, nav 재구성, i18n |
| `components/dashboard/topbar.tsx` | `src/components/dashboard/Topbar.tsx` | 크레딧 배지 추가, i18n |
| `components/dashboard/nav-data.ts` | `src/components/dashboard/navData.ts` | **IA 전면 재구성** (§5) |
| `views/content-planning.tsx` | 폐기 → Board로 대체 | 칸반 3열 스타일은 Board 상태 표시에 재활용 |
| `views/content-creation.tsx` | `src/app/[locale]/(auth)/dashboard/deck/new/` | 카드 3종 → Deck 생성 진입점으로 축소 |
| `views/reference-research.tsx` | 폐기 (Phase 4 재검토) | 탭·필터 레이아웃 패턴은 템플릿 갤러리에 재활용 |
| `views/placeholder.tsx` | `src/components/ui/EmptyState.tsx` | **"mirr 워크스페이스" 문구 제거** |

## 5. IA 재구성

v0 `nav-data.ts`는 Mirr 메뉴 복제다. Board 중심으로 교체한다.

| v0 (Mirr 복제) | → | Panelo |
|---|---|---|
| AI로 기획 › 콘텐츠 기획 | → | **Board** › 이번 달 배치 |
| AI로 기획 › 레퍼런스 리서치(베타) | → | 폐기 (Phase 4) |
| AI로 콘텐츠 제작 › 콘텐츠 만들기 | → | **Deck** › 새로 만들기 / 내 Deck |
| — | → | **템플릿** › 갤러리 / 내 템플릿 / 디자인 학습 |
| 콘텐츠 캘린더 | → | 캘린더 *(Phase 3)* |
| 콘텐츠 성과 | → | 성과 *(Phase 3)* |
| 자동 DM | → | 폐기 (Phase 4) |
| 댓글 관리 | → | 폐기 (Phase 4) |

```ts
// src/components/dashboard/navData.ts (설계)
export const navGroups: NavGroup[] = [
  { id: 'board',     labelKey: 'Nav.board',     icon: LayoutGrid, href: '/dashboard/board' },
  { id: 'deck',      labelKey: 'Nav.deck',      icon: Images,     collapsible: true,
    children: [
      { id: 'deck-new',  labelKey: 'Nav.deck_new',  href: '/dashboard/deck/new' },
      { id: 'deck-list', labelKey: 'Nav.deck_list', href: '/dashboard/deck' },
    ] },
  { id: 'template',  labelKey: 'Nav.template',  icon: Palette,    collapsible: true,
    children: [
      { id: 'template-gallery', labelKey: 'Nav.template_gallery', href: '/dashboard/templates' },
      { id: 'template-learn',   labelKey: 'Nav.template_learn',   href: '/dashboard/templates/learn' },
    ] },
  { id: 'calendar',  labelKey: 'Nav.calendar',  icon: Calendar,   href: '/dashboard/calendar', phase: 3 },
  { id: 'analytics', labelKey: 'Nav.analytics', icon: LineChart,  href: '/dashboard/analytics', phase: 3 },
];
```

**`label`이 아니라 `labelKey`**다. v0의 하드코딩 한국어를 next-intl 키로 전환한다.

사이드바 하단 3버튼(SNS 연동 / 리뷰 / 친구 초대)은 Phase 1에서 **크레딧 잔액 + 플랜 업그레이드** 하나로 축소한다. 1인 사업자에게 바이럴 유도 버튼 3개는 소음이다.

## 6. 간격 · 레이아웃

v0 셸의 밀도를 기준으로 삼는다.

| 영역 | 값 (v0 기준 유지) |
|---|---|
| 사이드바 폭 | `w-64` (256px) |
| 톱바 높이 | `h-14` (56px) |
| 메인 패딩 | `p-4 md:p-6 lg:p-8` |
| 콘텐츠 최대폭 | `max-w-6xl` — **단 Board는 전폭 사용** |
| 카드 라운드 | `rounded-2xl` |
| Board 행 높이 | **40px** (compact 32px 토글) — 신규 |
| Board 셀 패딩 | 12px / 8px — 신규 |

브레이크포인트: 320 / 768 / 1024 / 1440 / 1920.
**Board는 1024px 미만에서 시트 대신 카드 리스트로 폴백**한다 (승인됨).

## 7. 모션

v0 셸은 CSS `transition-*`만 쓰고 있다. Framer Motion(`motion` 패키지)은 **Board와 Deck 에디터에만** 도입하고, 셸의 기존 CSS 트랜지션은 그대로 둔다.

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

export const modalIn = {
  initial: { opacity: 0, scale: 0.98, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.99, y: -4 },
  transition: { duration: 0.26, ease: [0.16, 1, 0.3, 1] },
} as const;
```

| 상황 | 스펙 |
|---|---|
| 사이드바 모바일 슬라이드 | **v0 기존 유지** (`transition-transform duration-300`) |
| 페이지 전환 | fadeUp 260ms |
| Board 행 추가 | `layout` + opacity, stagger 30ms |
| Board 행 재정렬 | `layoutId` 공유 전환 |
| 생성 진행 | **CSS 애니메이션** (JS 스레드 점유 회피) |
| hover | 140ms, transform·opacity만 |

금지: width·height·top·left·margin·padding·font-size 애니메이션.
`useReducedMotion()`이 true면 전역 래퍼가 duration 0 + 페이드만 남긴다.

## 8. 접근성 (WCAG 2.2 AA)

v0 셸은 `aria-label`, `aria-current`, `aria-expanded`, `aria-pressed`, `aria-hidden`을 이미 적절히 쓰고 있다. 이 수준을 유지·확장한다.

| 항목 | 기준 |
|---|---|
| 대비 | 본문 4.5:1. **`--signal`(#C8F751) 위에는 반드시 `--signal-foreground`(잉크).** 라임 위 흰 글자 금지 |
| 포커스 | 전 인터랙티브 요소에 `focus-visible` 링 (v0 button이 이미 구현) |
| 키보드 | **Board 전 기능이 키보드만으로 조작 가능해야 한다** |
| 터치 타깃 | 최소 44×44px (Board 셀은 예외 — 대신 compact 토글로 확대 제공) |
| 폼 | 모든 입력에 연결된 `<label>`. placeholder를 label로 쓰지 않는다 |
| 상태 전달 | 색만으로 상태를 전달하지 않는다 (아이콘·텍스트 병행) |
| 라이브 영역 | 생성 진행·완료를 `aria-live="polite"`로 알린다 |
| Board 마크업 | `<div>` 스택이 아니라 **`role="grid"`** — 스크린리더가 행·열 좌표를 읽어야 한다 |
| 검증 | Storybook `addon-a11y`(설치됨) + Playwright 접근성 스캔 |

## 9. 안티 템플릿 체크리스트

- [ ] v0 기본 톤(보라 primary)이 남아 있지 않은가
- [ ] hover / focus / active가 각각 다르게 설계되었는가
- [ ] 모든 요소가 같은 radius·shadow를 쓰고 있지 않은가
- [ ] 강조가 균일하지 않고 위계가 있는가
- [ ] **시그널 라임이 "AI 개입 지점"에만 쓰였는가**
- [ ] 라이트·다크 양쪽이 각각 의도적으로 보이는가
- [ ] `mirr` 문자열이 코드·문구·에셋에 남아 있지 않은가
