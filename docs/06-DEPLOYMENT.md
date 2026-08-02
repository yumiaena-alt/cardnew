# 06. 배포 — Panelo

기준일: 2026-08-02 · Vercel + Supabase

## 1. 현재 상태

| 항목 | 상태 |
|---|---|
| GitHub remote | ✅ `yumiaena-alt/next-boilerplate-drizzle-clerk` |
| 로컬 커밋 | ✅ 4개 준비됨 (미푸시) |
| Vercel CLI 인증 | ✅ `yumiaena-alt` (팀: `limigogos-projects`) |
| Vercel 프로젝트 | ❌ 미생성 |
| `vercel.json` | ✅ 생성됨 |
| Supabase 프로젝트 | ❌ 미생성 — **배포 차단 요인** |

## 2. 배포가 지금 실패하는 이유

`next.config.ts` 첫 줄이 `import './src/libs/Env'`다. **빌드 시점에 Zod가 환경변수를 검증**하므로, 아래 3개가 없으면 빌드가 시작하자마자 죽는다.

| 변수 | 검증 | 성격 |
|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `min(1)` | 공개 값 |
| `CLERK_SECRET_KEY` | `min(1)` | **시크릿** |
| `DATABASE_URL` | `min(1)` | **시크릿 (자격증명 포함)** |

나머지(`ARCJET_KEY`, PostHog, Better Stack, Sentry)는 전부 optional이라 없어도 빌드된다.

### 빌드 커맨드 문제

`package.json`의 기본 빌드는 이렇다.

```
"build": "run-s db:migrate build:next"
```

Vercel이 이걸 그대로 쓰면 **매 배포마다 프로덕션 DB에 마이그레이션이 실행된다.** 동시 배포 시 경쟁이 생기고, Supabase pooler(6543)는 DDL에 적합하지 않다.

→ `vercel.json`에서 `buildCommand`를 **`next build`로 오버라이드**했다. 마이그레이션은 배포 파이프라인과 분리해 수동/전용 잡으로 돌린다.

## 3. 배포 절차

### 3-1. 사전 준비 (사용자가 직접 수행)

시크릿 입력은 소유자만 할 수 있다.

**① Supabase 프로젝트 생성**

1. https://supabase.com/dashboard → New project
2. 리전은 반드시 **Northeast Asia (Seoul) `ap-northeast-2`** — `vercel.json`의 `icn1`과 맞춘다
3. Database Password를 생성해 **비밀번호 관리자에 저장**한다 (연결 문자열에 들어간다)
4. 생성 후 **Project Settings → Database → Connection string**에서 두 가지를 구분해 확보한다

| 용도 | 포트 | 어디에 쓰나 |
|---|---|---|
| **Transaction pooler** | `6543` | Vercel `DATABASE_URL` — 런타임 |
| **Direct connection** | `5432` | 로컬 마이그레이션 전용. DDL은 pooler로 돌리지 않는다 |

**② Clerk 애플리케이션 생성**
- Publishable key / Secret key 확보
- **Organizations 기능 활성화** (Phase 1-B에서 필요)
- Webhook 엔드포인트는 배포 URL이 나온 뒤 등록한다 → `CLERK_WEBHOOK_SECRET`

**③ 최초 마이그레이션 (로컬에서 direct 연결로)**

마이그레이션 파일은 이미 준비돼 있다.

| 파일 | 대상 스키마 | 내용 |
|---|---|---|
| `0000_init-db.sql` | `public` | 보일러플레이트 `counter` 테이블 (제거 예정) |
| `0001_org_billing_system.sql` | **`cardnews`** | `CREATE SCHEMA "cardnews"` + 테이블 10개 · enum 4개 · `plan_limits` 시드 4행 |

애플리케이션 테이블은 `public`이 아니라 **전용 스키마 `cardnews`** 에 만들어진다. Supabase가 관리하는 객체와 섞이지 않게 하려는 것이다.

```bash
DATABASE_URL="<direct 5432 URL>" npm run db:migrate
```

적용 후 Supabase Table Editor 좌상단의 **schema 선택기를 `public`에서 `cardnews`로 바꿔야** 테이블이 보인다. `cardnews.plan_limits`에 free/standard/pro/agency 4행이 들어갔는지 확인한다.

> Supabase의 자동 REST API(PostgREST)는 기본적으로 `public`만 노출한다. `cardnews`는 노출되지 않지만, 우리는 Drizzle로 직접 연결하므로 무관하다. 오히려 애플리케이션 테이블이 실수로 공개 API에 뚫리지 않는다는 이점이 있다.

### 3-2. Vercel 프로젝트 생성 및 연결

```bash
npx vercel link
```

### 3-3. 환경변수 등록

```bash
npx vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production
npx vercel env add CLERK_SECRET_KEY production
npx vercel env add DATABASE_URL production
```

각 명령이 값을 물으면 직접 입력한다. Preview 환경도 쓸 거라면 `production`을 `preview`로 바꿔 한 번 더 등록한다.

선택 항목 (없어도 빌드된다):
```bash
npx vercel env add ARCJET_KEY production
npx vercel env add NEXT_PUBLIC_POSTHOG_KEY production
npx vercel env add NEXT_PUBLIC_POSTHOG_HOST production
npx vercel env add SENTRY_AUTH_TOKEN production
```

Sentry 소스맵 업로드를 아예 끄려면:
```bash
npx vercel env add NEXT_PUBLIC_SENTRY_DISABLED production   # 값: 1
```

### 3-4. 배포

```bash
npx vercel --prod
```

또는 GitHub 저장소를 Vercel에 연결해 `main` 푸시마다 자동 배포되게 한다 (권장 — 커밋 이력과 배포가 1:1로 맞는다).

### 3-5. 배포 후 확인

- [ ] `/` 마케팅 페이지 렌더
- [ ] `/dashboard` 로그인 리다이렉트 → Clerk 로그인 → 셸 렌더
- [ ] `/dashboard/board` 시트 렌더, 키보드 이동·붙여넣기 동작
- [ ] 라이트/다크 토글
- [ ] `/en/dashboard` 영어 로케일
- [ ] `robots.txt`에서 `/dashboard` 차단 확인

## 4. 알려진 배포 리스크

| # | 리스크 | 영향 |
|---|---|---|
| D1 | `src/app/api/counter` 등 보일러플레이트 데모가 DB를 쓴다 | 마이그레이션 전이면 500. 마케팅 페이지 정리 시 함께 제거 |
| D2 | `db:migrate`를 빌드에서 뺐다 | 스키마 변경 시 **수동 마이그레이션 필요**. Phase 2에서 전용 잡으로 자동화 |
| D3 | `.env`가 git 추적 대상 | 시크릿을 절대 넣지 않는다. `.env.local` 또는 Vercel 환경변수만 사용 |
| D4 | Clerk 프로덕션 인스턴스는 도메인 검증이 필요 | 커스텀 도메인 연결 시 Clerk 대시보드에서 도메인 등록 |
| D5 | 브랜드명 `Panelo` 상표 미검증 (R1) | 공개 URL에 브랜드가 노출된다. 상표 확정 전이면 비공개 배포 권장 |

## 5. 지금 당장 라이브 URL만 필요하다면

Supabase 없이 데모 URL을 먼저 띄우는 우회 경로다. **임시 방편이며 DB 기능은 동작하지 않는다.**

1. `DATABASE_URL`에 형식만 맞는 더미를 넣는다 (Zod는 `min(1)`만 본다)
   ```
   postgresql://placeholder:placeholder@localhost:5432/placeholder
   ```
2. Clerk 키 2개는 실제 값을 넣는다 (테스트 인스턴스로 충분)
3. `npx vercel --prod`

이 경우 대시보드 셸·Board 시트·i18n·테마는 정상 동작하고, DB를 쓰는 `/counter`와 `/api/counter`만 실패한다. Board는 아직 서버 데이터를 읽지 않고 시드 행으로 렌더되므로 문제없다.
