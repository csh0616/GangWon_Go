# GANGWON GO — Backend (Express + Supabase)

PRD 3장/4장, `docs/API_CONTRACT.md` 기준 구현. 담당: 백엔드 + 매니징 에이전트 + 데이터 동기화
(`/server`, `/agent`, `/scripts/sync`).

## 1. Supabase 프로젝트 세팅 (수동 — 계정/대시보드 작업, 이 리포에서 자동화 불가)

> 이 저장소의 코드는 Supabase 프로젝트가 **이미 만들어져 있다는 전제**로 동작합니다. 프로젝트 생성·
> OAuth 클라이언트 등록은 계정 로그인이 필요한 대시보드 작업이라 에이전트가 대신 수행할 수 없습니다 —
> 아래 순서대로 팀(승현님)이 직접 진행해주세요.

1. [supabase.com](https://supabase.com) 대시보드에서 새 프로젝트 생성 (리전: Seoul 권장)
2. **Project Settings → API**에서 아래 값을 복사해 `server/.env`에 채우기 (`.env.example` 참고):
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (절대 프론트/클라이언트 코드에 노출 금지)
3. **SQL Editor**에서 `server/db/migrations/0001_init_schema.sql` 내용을 그대로 실행해 스키마 생성
4. **Authentication → Providers → Google** 활성화:
   - [Google Cloud Console](https://console.cloud.google.com/apis/credentials)에서 OAuth 2.0 클라이언트 ID 생성
     (승인된 리디렉션 URI: Supabase가 제공하는 콜백 URL, Provider 설정 화면에 표시됨)
   - 발급받은 Client ID / Client Secret을 Supabase Google Provider 설정에 입력, 저장
5. **Authentication → URL Configuration**에서 Site URL / Redirect URLs에 프론트 배포 도메인(Vercel) +
   `http://localhost:3000` 등록

이 5단계가 끝나야 `POST /api/itineraries`(저장, Google 로그인 이후 흐름)가 실제로 동작합니다.
진행 상황/블로커는 `docs/HANDOFF_LOG.md`에 기록되어 있습니다.

## 2. 로컬 실행

```bash
cd server
cp .env.example .env   # 값 채우기
npm install
npm run dev
```

`GET /health`로 기동 확인.

## 3. 시드 데이터 채우기 (1주차 목업, PRD 8장)

TourAPI 실동기화 전, 프론트팀 작업을 막지 않기 위한 인제/홍천/평창 시드 POI. 스키마와 100% 동일하므로
나중에 `/scripts/sync`의 실제 동기화가 이 데이터를 덮어써도 프론트 코드 변경이 필요 없습니다.

```bash
cd scripts/sync
cp .env.example .env   # SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 채우기
npm install
node seed_pois.js
node seed_care.js
```

## 4. 디렉토리 구조

```
server/
  src/
    config/       — env, Supabase client
    middleware/    — auth(Bearer 토큰 검증), errorHandler
    lib/           — categories, geo(Haversine+2-opt), scoring, llm(Claude tool use),
                      alertAdjust, alertTrigger(매니징 자동 트리거 + Yes/No 응답), directions(카카오모빌리티)
    routes/        — itineraries, alerts, care
  db/migrations/   — SQL 스키마
```

`agent/`는 5~10분 주기 조건 감시 크론(node-cron)이며, `server/src/lib/alertTrigger.js`를 그대로
import해 재사용합니다(PRD 3.6절 "같은 스코어링 로직" — 로직 중복 방지).

## 5. API_CONTRACT.md와 다른 점 (구현 중 확정한 세부, HANDOFF_LOG.md에도 기록)

- `PATCH /api/itineraries/:id` 요청에 `target_poi_id`를 추가했습니다. 원본 계약(`{day, new_poi_id}`)만으로는
  하루에 스탑이 여러 개일 때 "어느 스탑을 교체하는지" 특정할 수 없습니다.
- `POST /api/alerts/trigger`, `POST /api/alerts/:alert_id/respond`, `POST /api/itineraries/regenerate-stop`은
  저장된(로그인) 일정 대상이라 `Authorization` 헤더를 필수로 구현했습니다 (계약에 명시는 없었으나 게스트
  상태의 코스는 애초에 이 엔드포인트들의 전제 조건인 "저장된 일정"이 아니므로 논리적으로 필요).
