# 렌더 서비스

`SlideDoc` → PNG/JPEG. Playwright로 렌더하고 sharp로 변환한다. 렌더된 카드를 이어붙여 릴스 mp4도 만든다(ffmpeg).

**왜 별도 프로세스인가.** Chromium은 Vercel 서버리스 함수에 들어가지 않고, 장시간 실행에도 맞지 않는다. 로컬에서 동작하더라도 배포에서 갈린다.

**왜 리포 안에 두는가.** 렌더 코드(`src/lib/renderer`, `src/lib/slidedoc`)를 웹 앱과 공유한다. 워크스페이스로 분리하면 CI·린트·의존성 검사를 전부 손봐야 하는데, 지금 필요한 건 서버 사이드 PNG 하나뿐이다. 상대경로로 같은 소스를 읽고, 필요해지면 그때 분리한다.

## 엔드포인트

| 경로 | 용도 |
|---|---|
| `POST /render` | `SlideDoc` → 이미지 |
| `POST /inspect` | 조판 결과만 반환 (렌더 없이) |
| `POST /video` | 카드 이미지(base64) → mp4. 브라우저를 쓰지 않는다 |
| `GET /health` | 헬스체크. `ffmpeg` 유무를 함께 알린다 |

**`/video`가 생성형 영상 API가 아닌 이유.** 이 제품의 릴스는 *우리가 만든 카드*가 움직이는 것이다. 생성 API는 카드와 무관한 영상을 만들어 내므로 팬아웃(소재 1개 → 채널별 변형)이라는 축이 성립하지 않는다. 이미 렌더된 PNG를 재사용하니 추가 원가도 0이다. 장면 전환은 아직 컷 전환뿐이다 — `xfade`는 입력 수만큼 필터 체인을 만들어야 해서 다음 판으로 미뤘다.

## 환경변수

| 이름 | 기본값 | 설명 |
|---|---|---|
| `PORT` | `4000` | |
| `RENDER_SERVICE_TOKEN` | — | **필수.** 웹 앱과 공유하는 시크릿 |
| `RENDER_POOL_SIZE` | `2` | 브라우저 재사용 풀 크기 |
| `FFMPEG_PATH` | `ffmpeg` | 실행 파일 경로가 다른 호스트용 |

> **IP allowlist는 쓸 수 없다.** Vercel의 egress 주소가 고정이 아니다. 접근 통제는 이 토큰이 전부이므로, 길게 만들고 HTTPS 밖으로 내보내지 않는다.

## 배포 (RackNerd VPS)

```bash
# 1. Chromium과 의존 라이브러리
npx playwright install --with-deps chromium

# 2. ffmpeg (릴스 영상용). 없으면 /video만 500이 나고 /render는 정상 동작한다.
apt-get install -y ffmpeg

# 3. 구동
node --experimental-strip-types services/render/src/server.ts
```

`GET /health`의 `ffmpeg: true`로 설치를 확인한다.

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
