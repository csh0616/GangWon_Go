# GANGWON GO (강원고)

『2026 관광데이터 활용 공모전』 — 웹·앱 개발 부문 출품작
**팀명: GangWonGo**

강원 인제·홍천·평창 여행 코스를 3초 이내에 자동 생성하고, 여행이 끝날 때까지 날씨
변화를 감시해 코스 변경을 먼저 제안하는 다국어(한/영/중) 여행 플래닝·매니징 웹
서비스입니다.

- 배포: https://gang-won-go.vercel.app
- 백엔드: Railway (프론트에서는 `/backend/*` same-origin 리라이트로만 호출)
- DB·인증: Supabase

## 핵심 기능

1. **맞춤 여행 코스 자동 생성** — 날짜·인원·동행 유형과 자유 문장을 받아, 최대 3개
   시군을 날짜에 배정하고 클러스터링 + 2-opt 경로 최적화로 일자별 코스를 생성합니다.
2. **실시간 매니징** — 저장한 코스를 여행 기간 동안 5~10분 주기로 감시하다가 강수
   예보를 만나면 실내 대체 후보를 미리 계산해 변경 여부를 먼저 묻습니다. 사용자가
   승인해야 그 스탑만 교체됩니다.
3. **다국어 정밀 지도** — 카카오맵 SDK 기반 한/영/중(간체) 전환. 장소명은 번역명과
   한국어 원문을 병기하고, 위치 권한을 허용하면 내 위치 ↔ 코스 보기를 토글할 수
   있습니다.
4. **여행 케어 안내 & SOS** — 3개 시군 병·의원·응급의료기관 안내(로그인 불필요),
   SOS 버튼으로 119 즉시 연결.

## 기술 스택

| 영역 | 구성 |
|---|---|
| 프론트엔드 | Next.js (App Router) · Tailwind CSS · next-intl (ko/en/zh) |
| 백엔드 | Node.js · Express |
| 매니징 에이전트 | node-cron (5~10분 주기 스캔) |
| DB·인증 | Supabase (Postgres + RLS + Realtime + Google OAuth) |
| 지도·경로 | 카카오맵 JS SDK · 카카오모빌리티 Directions API |
| AI | Anthropic Claude API (코스 내레이션·자유 문장 파싱) |

## 프로젝트 구조

```
app/, components/, i18n/    프론트엔드
server/                     백엔드 API (Express)
agent/                      실시간 매니징 에이전트 (server/의 로직을 재사용)
scripts/sync/               공공데이터 배치 동기화 스크립트
docs/                       기획·계약·테스트 문서 (docs/STATUS.md부터)
```

## 로컬 실행

### 프론트엔드

```bash
npm install
cp .env.example .env.local   # 값 채우기
npm run dev
```

`NEXT_PUBLIC_API_BASE_URL`을 비워두면 목업 데이터로 동작합니다.

### 백엔드 · 에이전트 · 데이터 동기화

Supabase 프로젝트 생성 등 사전 세팅이 필요합니다. 각 디렉토리의 README를 참고하세요.

- [`server/README.md`](server/README.md)
- [`agent/README.md`](agent/README.md)
- [`scripts/sync/README.md`](scripts/sync/README.md)

## 활용 데이터

- 한국관광공사 국문 관광정보 서비스 (TourAPI)
- 기상청 단기예보 조회서비스
- 국립중앙의료원 전국 병·의원 찾기 / 응급의료기관 조회 서비스
- 행정안전부 전국문화축제표준데이터
- 카카오맵 JavaScript SDK · 카카오모빌리티 Directions API

## 더 알아보기

현재 상태·유효한 결정·팀별 작업 경계는 [`docs/STATUS.md`](docs/STATUS.md)에서
가장 먼저 확인하세요.
