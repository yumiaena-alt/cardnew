# 렌더 서비스

`SlideDoc` → PNG/JPEG. Playwright로 렌더하고 sharp로 변환한다.

**왜 별도 프로세스인가.** Chromium은 Vercel 서버리스 함수에 들어가지 않고, 장시간 실행에도 맞지 않는다. 로컬에서 동작하더라도 배포에서 갈린다.

**왜 리포 안에 두는가.** 렌더 코드(`src/lib/renderer`, `src/lib/slidedoc`)를 웹 앱과 공유한다. 워크스페이스로 분리하면 CI·린트·의존성 검사를 전부 손봐야 하는데, 지금 필요한 건 서버 사이드 PNG 하나뿐이다. 상대경로로 같은 소스를 읽고, 필요해지면 그때 분리한다.

## 엔드포인트

| 경로 | 용도 |
|---|---|
| `POST /render` | `SlideDoc` → 이미지 |
| `POST /inspect` | 조판 결과만 반환 (렌더 없이) |
| `GET /health` | 헬스체크 |

## 환경변수

| 이름 | 기본값 | 설명 |
|---|---|---|
| `PORT` | `4000` | |
| `RENDER_SERVICE_TOKEN` | — | **필수.** 웹 앱과 공유하는 시크릿 |
| `RENDER_POOL_SIZE` | `2` | 브라우저 재사용 풀 크기 |

> **IP allowlist는 쓸 수 없다.** Vercel의 egress 주소가 고정이 아니다. 접근 통제는 이 토큰이 전부이므로, 길게 만들고 HTTPS 밖으로 내보내지 않는다.

## 배포 (RackNerd VPS)

```bash
# 1. Chromium과 의존 라이브러리
npx playwright install --with-deps chromium

# 2. 구동
node --experimental-strip-types services/render/src/server.ts
```

앞단에 Caddy를 두고 서브도메인으로 HTTPS를 종단한다. 인증서는 자동 발급된다.

```
render.<도메인> {
  reverse_proxy localhost:4000
}
```

그다음 Vercel 환경변수에 `RENDER_SERVICE_URL`과 `RENDER_SERVICE_TOKEN`을 등록한다.

## 반드시 지킬 것

- **스크린샷 전에 `document.fonts.ready`와 모든 이미지 로드 완료를 기다린다.** 빠뜨리면 폴백 폰트로 렌더되거나 이미지 자리가 빈다.
- **`computeDocHash()`에 결과 픽셀에 영향을 주는 모든 입력을 넣는다.** 문서·포맷·배율·품질·워터마크·렌더러 버전. 하나라도 빠지면 바뀐 문서에 옛 이미지가 나간다.
