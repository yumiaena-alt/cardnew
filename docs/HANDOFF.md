# 인수인계 — 세션이 끊겨도 여기서부터

> **새 세션은 이 파일을 가장 먼저 읽는다.** 다 읽는 데 3분이면 된다.
> 기준 커밋 `2a9fbd2` · 마이그레이션 `0015`(생성만, **미적용**) · 테스트 540 통과 / 10 skip
>
> 관련 문서: [`CLAUDE.md`](../CLAUDE.md) 규칙 · [`project_status.md`](project_status.md) 리스크 대장 · [`04-TASKS.md`](04-TASKS.md) 단계별 계획 · [`08-TOON-PIPELINE.md`](08-TOON-PIPELINE.md) 인스타툰

---

## 1. 이 제품이 뭔가

**Panelo** — 혼자 SNS 여러 채널을 굴리는 1인 사업자가, 한 달에 한 번 앉아서 한 달치 카드뉴스를 만들고 예약까지 끝내는 도구.

차별화 축 셋: **Fan-out**(소재 1개 → 채널별 분기) · **월간 배치**(캘린더 빈칸 → 시트에서 일괄 생성) · **Dry-run 견적**(차감 전 항상 가격 노출).

---

## 2. 지금 상태 한 문단

화면과 기능은 **전 구간 구축 완료**. 생성·릴스·편집기·디자인 학습은 **실제로 돌려서 숫자까지 확인**했다.
남은 것은 기능이 아니라 **사장님이 직접 해야 하는 외부 연동 두 개**, 그리고 그 뒤에 열리는 검증들이다.

---

## 3. 실측으로 끝난 것 — 다시 의심하지 말 것

| 경로 | 확인된 값 |
|---|---|
| 생성 | 견적 15 → 차감 → 큐 인계 → 기획 → 사진 → 렌더 → 업로드 → 마감(환불 0). 카드 5장 / 약 90초 |
| 릴스 | 12초 mp4 · 1.9MB · `ftyp` · 화면 재생·내려받기 |
| 캔버스 편집 | 300px 드래그 → `y=0.2222`(=300÷1350) → 저장 → 스토리지 이미지 해시 변경 |
| 사진 교체 | Unsplash 교체 + **저작자 표기 자동 갱신**(provenance, `attributionRequired`) |
| 정렬 스냅 | 중앙에서 6px → 정확히 540으로 붙음, 안내선 1개 |
| 디자인 학습 | 참고 3장 → cover/body/cta 레이아웃 + 색·타이포, 18초 |
| 학습 적용 | 배경 `#1a1a1a`(기본 `#141210`) · 제목 위치 `0.400` 일치 · 템플릿 `learned-cover-0` 선택됨 |
| 기획 3소스 | 자체 창작 / 웹 검색(계절·시기) / 내 자료(기존 카드 후속) — 셋 다 결과가 다름 |
| 인프라 | 렌더 서비스 HTTPS 상시 구동(systemd) · ffmpeg · push → Vercel 자동 배포 |

---

## 4. 다음에 할 일 — 우선순위 순

### 🔴 사장님 조작이 필요하다 (제가 대신 못 함)

0. **인스타툰 마이그레이션 적용** — `migrations/0015_easy_stature.sql`
   테이블 3개(`toon_characters`·`toon_formulas`·`toon_storyboards`)와 `run_items`의 컬럼 2개를
   **더하기만 한다.** 파괴적 변경이 없어 읽고 바로 적용해도 되지만, SQL은 사람이 본 뒤 넣는 것이 규칙이다.
   프로덕션은 `.env.migrate.local`의 URL을 따로 지정해야 한다 — `db:migrate`는 로컬 PGlite로 간다.

1. **Trigger.dev 태스크 배포**
   키는 Vercel에 들어갔지만 워커가 태스크를 모른다. **Run이 큐에만 쌓이고 크레딧은 차감된다.**
   `npx trigger.dev@latest login` (브라우저 인증) → 그다음 `deploy`는 에이전트가 실행 가능.

2. **인스타그램 계정 연동** — `SNS 관리 → SNS 계정 연동`
   마지막 승인은 실제 계정 권한을 넘기는 동작이라 에이전트가 누르지 않는다.
   연동되면 아래 4개가 한 번에 검증 가능해진다.

3. **디자인 학습 파일 업로드** — 브라우저 파일 선택은 에이전트가 못 한다.
   참고 이미지 몇 장 올려 「견적 보기」 → 「학습하기」까지 눌러 주면 그 뒤는 검증 가능.

### 🟡 연동 후 검증 대기 (코드는 완성, 실동작 미확인)

- **인스타툰 전 구간** — `FAL_KEY`는 있지만 이 파이프라인으로 실제 호출한 적이 없다.
  주인공 1명 만들고 → 4컷으로 견적(14크레딧) → 생성 → 얼굴이 컷마다 같은지 눈으로 확인하는 것이 첫 검증.
  라이브 하네스(`toonLive.test.ts`)는 아직 없다 — [`08-TOON-PIPELINE.md`](08-TOON-PIPELINE.md) §10

- 토큰 암호화 저장 · 장기 토큰 교환(60일)
- 댓글 인박스가 실제 댓글을 가져오는가
- 자동 DM 규칙이 실제로 발동하는가
- **예약 발행 → 실제 게시** — 실행 전 반드시 사용자에게 다시 확인받을 것

### 🟢 만들면 좋은 것

- 편집기: 정렬 버튼(좌/중/우 일괄), 여러 레이어 동시 선택, 키보드 단축키
- 템플릿: 학습본의 레이아웃을 캔버스에서 직접 손보기
- 성과: 지표 수집 스케줄러

---

## 5. 환경 — 어떻게 돌리나

```bash
npm run build-local      # 빌드 (PGlite 포트 5432 충돌 시 dev 서버부터 끌 것)
npm run lint             # ultracite. 실패하면 npx ultracite fix <경로>
npm run check:types      # tsc
npm run check:i18n       # 미정의/미사용 i18n 키
npm run check:deps       # knip. 안 쓰는 export 를 잡는다
npm run test             # vitest 497건
npm run test:e2e         # playwright. dev 서버가 떠 있으면 포트 충돌로 실패한다
```

**dev 서버**: `.claude/launch.json`의 `panelo`. 에이전트는 `preview_start`로 띄운다.
로컬 DB는 PGlite(파일 `local.db`, 포트 5432)이고 스토리지·렌더는 **실제 서비스**를 쓴다.

### 실동작 하네스 (기본 skip — 실제 제공사 할당량을 쓴다)

```bash
RUN_LIVE_PIPELINE=1 npx vitest run --project unit src/features/run/pipelineLive.test.ts
```

| 파일 | 무엇을 확인하나 |
|---|---|
| `run/pipelineLive.test.ts` | 견적 → 차감 → 생성 → 저장 → 마감 |
| `deck/videoLive.test.ts` | 카드 → mp4 → 스토리지 → DB 기록 |
| `template/learnLive.test.ts` | 참고 이미지 → 레이아웃·토큰 추출 |
| `template/applyLive.test.ts` | 학습본이 실제 합성에 반영되는가 |
| `template/seedLive.test.ts` | 갤러리에 보여줄 템플릿 1개 심기 |

### 원격 VPS (렌더 서비스)

```bash
ssh root@155.94.154.102 "systemctl status panelo-render"
```

`CLAUDE.md` §7이 자율 조작을 허용한다. 서비스는 `/opt/node22/bin/tsx`로 뜨고 systemd 유닛은 `panelo-render`.
**시스템 node(18)를 건드리지 말 것** — 같은 호스트에서 n8n이 그걸 쓴다.

---

## 6. 함정 — 같은 곳에서 또 넘어지지 말 것

이 프로젝트에서 실제로 잡은 버그들의 **공통 패턴**이다. 새 코드를 쓸 때 여기부터 의심한다.

### 조용히 틀리는 것이 가장 위험하다

지금까지 잡은 11개 중 대부분이 **에러를 내지 않았다.**

- `providerCostUsd: 0` 하드코딩 → 마진 검증이 불가능한데 아무도 몰랐다
- 사진 교체 시 저작자 표기 미갱신 → 없어진 사진의 사진가를 계속 표기
- 이미지 검색 첫 실패에서 포기 → 카드 전부가 사진 없이 생성
- 캔버스 드래그가 앵커 무시 → "드래그가 안 먹는" 것처럼 보임
- `resolveTemplate`이 학습 세트를 버림 → 색만 맞고 배치는 내장 템플릿

**교훈: 실패 경로를 로그로만 두지 말고 값으로 확인한다.** 화면이 그럴듯하면 통과한 것처럼 보인다.

### 구체적인 지뢰

| 지뢰 | 내용 |
|---|---|
| Supabase 키 | 신형 `sb_secret_`은 **`apikey` 헤더가 필수**. bearer만 보내면 JWT로 파싱하다 400 |
| 카드 포맷 | **JPEG만.** 인스타는 8MB 초과·JPEG 외 거부. PNG 카드는 발행 자체가 불가능 |
| Unsplash | 영어 색인이다. 한글 검색은 결과가 얕으면 번역 후 재검색(`lib/images/query.ts`) |
| 앵커 좌표 | `layout.x/y`는 **앵커 기준 오프셋**. 픽셀을 그대로 쓰면 조판이 되돌린다 → `rectToOffset` |
| 조판 높이 | 텍스트 레이어는 `h`가 비어 있다. 실측 없이 배치하면 렌더와 어긋난다 → `typesetSlide` |
| 판별 유니온 | `Partial<Layer>` spread는 캐스팅을 부른다. 공통 필드 토글과 전체 교체로 나눌 것 |
| 포트 5432 | dev 서버와 `build-local`이 같은 포트를 쓴다. 하나를 끄고 돌린다 |
| 렌더 실행기 | `node --experimental-strip-types`로는 안 뜬다(JSX·확장자 없는 import). **tsx** |
| 캐릭터 앵커 | `anchor_prompt`는 **저장된 값을 쓴다.** 런타임에 다시 조립하면 항목 하나 편집이 과거 덱까지 소급된다 |
| 컷 시드 | 시드는 캐릭터 것이지 컷 것이 아니다. 컷마다 흔들면 3컷부터 다른 사람이 나온다 |
| 생성 이미지 원가 | `providerCostUsd`에 `generatedImageCount`를 안 넘기면 인스타툰이 거의 무료로 기록된다 |

### 가드레일 (`CLAUDE.md` §5)

- 크레딧 차감 경로는 **반드시 DryRun 견적을 거친다**
- 잔액 컬럼을 두지 않는다. 항상 `SUM(delta)`
- 벤치마킹 대상의 **CSS·색·문구·IA를 복제하지 않는다.** `grep -ri mirr src/` 0건 유지
- 클라이언트가 보낸 `orgId`를 신뢰하지 않는다. 서버 `auth()`에서만 확정

---

## 7. 파일 지도 — 어디를 봐야 하나

```
src/features/run/          생성 실행. pipeline.ts 가 중심. providerCost.ts 가 마진 검사
src/features/template/     디자인 학습. learn.ts(추출) actions.ts(견적·차감) brand.ts(토큰→스타일)
src/features/deck/         카드뉴스·영상. actions.ts 에 편집 저장·사진 교체
src/features/social/       계정 연동·댓글·DM. connect.ts 가 OAuth
src/features/toon/         인스타툰. pipeline.ts 가 중심. 카드뉴스와 같은 run/deck 위에 얹혀 있다
src/lib/toon/              스토리보드 계약·프롬프트·캐릭터 앵커·말풍선 조판
src/lib/slidedoc/          문서 스키마. geometry.ts 에 앵커 좌표 왕복
src/lib/renderer/          조판·템플릿. compose.ts / typeset.ts / learned.ts(학습본을 템플릿으로)
src/components/deck/canvas/  캔버스 편집기. PanelCanvas · LayerInspector · snap.ts
services/render/           별도 프로세스. VPS에서 systemd로 상주
```

**`panels.doc`(jsonb)이 편집기의 핵심이다.** 슬롯은 카드가 *무슨 말을 하는지*만 담고
*어디에 있는지*는 못 담는다. 레이아웃 편집은 이 컬럼에 저장된다.

---

## 8. 작업 방식 — 이 세션에서 통했던 것

- **커밋은 왜 그렇게 했는지를 적는다.** 무엇을 바꿨는지는 diff가 말한다.
- **고쳤다고 말하기 전에 값으로 확인한다.** 해시·좌표·건수. 화면 스크린샷만으로는 부족하다.
- 게이트는 커밋 전에 전부 돌린다: `lint → check:types → check:i18n → check:deps → test → build-local`
- 새 패키지는 **설치 전에 물어본다**(`CLAUDE.md` §4). 지금까지 승인받아 넣은 것: `konva`, `react-konva`
- 마이그레이션은 **SQL을 먼저 보여주고** 적용한다. 프로덕션은 `.env.migrate.local`의 URL을 따로 지정해야 한다
  (`db:migrate`는 `dotenv -c`라 로컬 PGlite로 간다 — 이걸 몰라서 한 번 헛돌았다)
