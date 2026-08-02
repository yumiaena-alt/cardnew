# Panelo 설계 문서

카드 한 장부터 캠페인 전체까지 — 1인 사업자를 위한 SNS 콘텐츠 배치 스튜디오.

기준일: 2026-08-02 · 상태: **설계 확정 (v0.3)** · 구현 착수 대기

## 문서 구성

| 문서 | 내용 | 대상 |
|---|---|---|
| **[project_status.md](project_status.md)** | **현재 진행 상태 · 다음 작업 · 세션 핸드오버** — 새 세션은 여기부터 | 전체 |
| [01-PRD.md](01-PRD.md) | 문제 정의, 타깃, 핵심 기능, IA, 성공 지표, 스코프 경계 | 전체 |
| [02-ARCHITECTURE.md](02-ARCHITECTURE.md) | **v0 자산 실사**, 시스템 구조, 인증·RBAC, 생성 파이프라인, i18n, 관측 | 개발 |
| [03-DATA-MODEL.md](03-DATA-MODEL.md) | Drizzle 스키마 전문(21개 테이블), 인덱스 전략, 마이그레이션 정책 | 개발 |
| [04-TASKS.md](04-TASKS.md) | Phase 0~4 태스크리스트와 완료 기준 | 전체 |
| [05-DESIGN-SYSTEM.md](05-DESIGN-SYSTEM.md) | v0 토큰 매핑, 타이포, 컴포넌트 규약, 모션, a11y | 디자인·개발 |

## 확정 사항

| # | 결정 |
|---|---|
| 1 | **브랜드**: Panelo (`panelo.app` 우선) — 상표 실검색은 Phase 0에서 선행 |
| 2 | **차별화 축**: Board — 1소재 다채널 팬아웃 + 월간 배치 세션 |
| 3 | **1차 타깃**: 1인 사업자 (Standard $19 / 500cr / SNS 2계정) |
| 4 | **Phase 1 유료 플랜**: Standard 단독. Pro·Agency는 Phase 3 말 |
| 5 | **잡 큐**: Trigger.dev v3 |
| 6 | **모바일**: Board는 1024px 미만에서 카드 리스트 폴백 |
| 7 | **컬러**: 잉크 블랙(`--primary`) + 시그널 라임(`--signal`, AI 지점 전용) |
| 8 | **UI 뼈대**: v0 대시보드 셸 (Base UI + cva + 시맨틱 토큰) — 토큰 이름 유지, 값만 교체 |

## 착수 전 차단 조건

아래 두 가지가 해소되기 전에는 기능 개발을 시작하지 않는다.

1. **Phase 0** — 상표·도메인 검색 완료 ([04-TASKS](04-TASKS.md) §Phase 0)
2. **Phase 1-Z** — v0 자산 이관 및 `tsc --noEmit` 오류 0건 ([02-ARCHITECTURE](02-ARCHITECTURE.md) §0-2)

## 용어 사전

제품·UI·DB 전반에서 아래 용어만 사용한다. 동의어 혼용 금지.

| 용어 | 정의 | 테이블 |
|---|---|---|
| **Panel** | 카드 1장 (슬라이드) | `panels` |
| **Deck** | 카드뉴스 1건 = Panel 묶음 | `decks` |
| **Cut** | 하나의 소재에서 파생된 채널별 변형 Deck | `board_row_outputs` |
| **Board** | 여러 Deck을 한 화면에서 다루는 스프레드시트 | `boards` |
| **Run** | 생성 실행 1회 = 크레딧 차감 단위 | `runs` |
| **Slot** | Panel 안의 편집 가능한 최소 단위 (텍스트·이미지) | `panels.slots` |
