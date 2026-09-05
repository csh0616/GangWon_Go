# GANGWON GO — 실시간 조건 감시 에이전트 (PRD 3.6절)

`/server`의 `alertTrigger.js`/`scoring.js`/`directions.js`를 상대경로로 그대로 import해서 쓴다
(로직 중복 방지, PRD 3.6절 "같은 스코어링 로직"). 그래서 실행 전 `server/`에서 `npm install`이
먼저 되어 있어야 한다(같은 저장소 내 상대 require이므로 별도 패키지 배포는 하지 않음).

## 실행

```bash
cd server && npm install   # agent가 require하는 server/src/lib의 의존성 설치
cd ../agent
cp .env.example .env       # server/.env와 같은 값 채우기 (SUPABASE_*, KAKAO_MOBILITY_API_KEY, KMA_SERVICE_KEY)
npm install
npm start
```

## 블로커 (`docs/HANDOFF_LOG.md` 참고)

- `src/weather.js`의 `REGION_GRID`(기상청 격자 nx/ny)가 비어 있다 — 인제/홍천/평창 정확한 격자좌표를
  기상청 격자 변환기로 확인해서 채워야 실제 날씨 감시가 동작한다. 채우기 전엔 `fetchRainStatus`가
  명시적으로 에러를 던지고, `monitor.js`는 그 지역만 이번 주기를 건너뛴다(전체가 죽지 않음).
- `KAKAO_MOBILITY_API_KEY`가 없으면 traffic 감시가 동작하지 않는다 (구간마다 조회 실패 로그만 남기고 계속 진행).
- 라이브 데모에서 실제로 쓰는 건 이 자동 cron이 아니라 `POST /api/alerts/trigger`(결정론적 강제
  트리거, `docs/API_CONTRACT.md` §3)다 — 이 agent는 "실제 서비스라면 이렇게 자동으로 동작한다"는
  걸 보여주는 백엔드 완성도용이며, 데모 시연 자체는 이 cron의 타이밍에 의존하지 않는다.
