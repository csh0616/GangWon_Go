# GANGWON GO — HANDOFF_LOG (빈 템플릿 + 예시)

> 각 팀 세션이 작업을 마칠 때 아래 형식으로 **append만** 합니다 (기존 로그를 지우거나 수정하지 않음 —
> `GANGWON_GO_PRD.md` 10장 협업 프로토콜). PM(전략기획팀 세션)이 이 로그를 확인해서 필요한 내용을
> `GANGWON_GO_PRD.md` / `API_CONTRACT.md` / `TEST_PLAN.md`에 반영합니다.
>
> 새 로그는 **파일 맨 아래**에 추가하세요 (최신 항목이 아래로 쌓이는 구조). 날짜는 최신순이 아니라
> 작성순으로 자연스럽게 정렬됩니다.

---

## 작성 형식

```
## [YYYY-MM-DD HH:MM] 팀명
- 변경: (무엇을 했는지)
- 블로커: (막힌 것, 없으면 "없음")
- 다음 액션: (다음 세션이 할 일)
```

---

## [예시] 아래는 형식을 보여주기 위한 샘플입니다. 실제 로그는 이 아래(구분선 밑)에 추가하세요.

## [2026-09-01 14:00] 백엔드팀
- 변경: Supabase 프로젝트 생성, `pois`/`itineraries`/`alerts` 테이블 1차 스키마 적용. TourAPI 배치 동기화
  스크립트 초안 작성 (`/scripts/sync/tourapi.js`) — 아직 카테고리 마스터 목록(PRD 3.5절) 매핑 전.
- 블로커: TourAPI 응답의 원본 카테고리 코드와 `nature_hiking`/`onsen_wellness` 등 7개 키 매핑 기준이
  아직 없음 — 데이터팀 논의 필요.
- 다음 액션: 매핑 규칙 정리 후 `API_CONTRACT.md`에 반영 요청. 프론트팀에는 `POST /api/itineraries/generate`
  스켈레톤 응답(더미 데이터)부터 먼저 열어줄 예정.

## [2026-09-01 16:30] 프론트팀
- 변경: Next.js 프로젝트 세팅, 반응형 레이아웃(모바일 바텀시트/데스크톱 2단) 기본 골격 구현.
- 블로커: `POST /api/itineraries/generate` 응답 스키마가 아직 실제로 안 열려 있어서 더미 JSON으로 작업 중.
- 다음 액션: 백엔드팀 스켈레톤 응답 열리면 연동. 카카오맵 SDK 연동은 내일 시작 예정.

---

<!-- 실제 로그는 여기부터 이어서 작성하세요 -->

## [2026-09-06 18:00] 백엔드팀

- 변경 (PRD 8장 1주차 마일스톤 순서대로):
  1. **Supabase 세팅**: 코드 쪽(client init, .env.example, Auth 토큰 검증 미들웨어)과 SQL 마이그레이션은
     준비 완료(`server/src/config/`, `server/src/middleware/auth.js`, `server/db/migrations/0001_init_schema.sql`).
     단 실제 프로젝트 생성/Google OAuth 클라이언트 등록은 계정 로그인이 필요한 대시보드 작업이라
     에이전트가 대신 할 수 없음 — `server/README.md` §1에 5단계 수동 절차를 남겨뒀고, 이 단계가
     끝나야 저장/로그인 흐름이 실제로 동작함 (아래 블로커 참고).
  2. **TourAPI/의료관광정보 배치 동기화**: `/scripts/sync` 구현 완료. TourAPI 원본 카테고리 → PRD
     3.5절 7개 키 매핑 규칙을 이번 세션에서 확정함 (`scripts/sync/category_mapping.js`,
     `scripts/sync/README.md`에 표로 정리):
     - `nature_hiking`=cat1 A01, `onsen_wellness`=cat2 A0202, `culture_history`=contentTypeId 14 또는
       cat2 {A0201,A0203~A0206}, `food_local`=contentTypeId 39/cat1 A05, `festival_event`=contentTypeId
       15/cat2 {A0207,A0208}, `shopping`=contentTypeId 38/cat1 A04, `leisure_sports`=contentTypeId 28/cat1 A03.
     - 어디에도 안 걸리면(숙박/여행코스 등) 동기화 대상에서 제외.
     - 의료관광정보 서비스는 실제 응답 스키마를 확인 못해 `sync_medical.js`는 공공데이터 API 공통 관례를
       따른 자리표시자 구조로 작성 — 서비스키 발급 후 필드명 매핑만 손보면 되는 상태.
  3. **동선 최적화 함수**: Haversine + 2-opt 구현 완료(`server/src/lib/geo.js`), k-means 기반 일자별
     지리 클러스터링 + 축제 앵커 주변 배치까지 포함해 `buildItineraryDays()`(`server/src/lib/scoring.js`)로
     통합. 더미 시드 데이터로 기능 검증 완료(지리적으로 묶인 일자별 코스, 축제 가중치>0일 때 앵커 배치,
     rain 조건 시 야외 카테고리 0 처리 모두 정상 동작 확인).
  4. **DB 스키마 초안**: `server/db/migrations/0001_init_schema.sql`. PRD 4장/ERD_SEQUENCE.md §1과
     100% 일치하되, 구현하면서 **2가지를 추가로 제안**함(PRD 4장 규칙 — "새 테이블 만들기 전 PRD에
     먼저 추가"에 따라 확정 아님, PM 확인 요청):
     - `pois.adult_only` (boolean) — PRD 3.5절이 예시로 든 "family_with_kids면 성인 전용 성격 POI
       제외" 필터용. tags[]는 7개 키 고정이라 이 값을 tags에 넣을 수 없어 별도 컬럼으로 뺐음.
     - `care_facilities` 테이블 (신규) — `GET /api/care`(API_CONTRACT.md §4)가 반환할 정적 큐레이션
       데이터를 저장. PRD 4장엔 아직 없음.
     - RLS: `alerts`/`itineraries`/`users`에 본인 소유만 SELECT 가능한 정책 추가 (PRD 6장 — Realtime
       채널이 다른 사용자 알림과 섞이면 안 된다는 요구사항의 DB 레벨 방어선).
  5. **인제/홍천/평창 시드 POI** (요청대로 최우선 처리): `scripts/sync/seed/pois_seed.json` —
     인제 13/홍천 12/평창 14, 총 39건, 7개 카테고리 분산. 좌표는 공개적으로 알려진 위치 기반 근사치
     (실제 TourAPI 동기화가 정확한 mapx/mapy로 덮어씀). `festival_event`는 "평창 효석문화제"(실제
     매년 9월 개최) 1건 포함, `event_start_date`/`end_date`를 2026-09-10~09-19로 설정해 3주차
     리허설 기간(9/14~9/20)과 겹치게 해뒀음 — **실제 2026년 정확한 개최 일정은 미확인, 리허설 전
     재확인 필요**. 매니징 리허설 문구용 2곳도 확정: 평창 "월정사 전나무숲길"(야외, 우천 시 교체
     대상) ↔ "평창무이예술관"(실내, 대체 후보) — 둘 다 시드 데이터에 실존.
     여행 케어 안내용 `care_seed.json`도 시군당 5건씩 총 15건 작성했으나, **병원/보건지소 전화번호는
     119 외엔 전부 null로 비워둠** — 잘못된 응급연락처를 보여주는 리스크가 커서, 실제 번호는
     `sync_medical.js` 실동기화로 채우는 게 맞다고 판단함 (아래 블로커).
  6. **스코어링 로직**: API_CONTRACT.md §1 구조화 출력 스키마(7개 키 + activity_level, additionalProperties
     false)를 Claude API tool use로 그대로 구현(`server/src/lib/llm.js`, 모델은 Haiku 4.5, 카테고리
     스키마는 prompt caching 대상으로 cache_control 설정). 1회 재시도 후 실패 시 전부 0 + medium 폴백도
     구현. `POST /api/itineraries/generate`, `regenerate-stop`, `PATCH`, `POST /api/alerts/trigger`,
     `POST /api/alerts/:id/respond` 전부 구현 완료 (`server/src/routes/`).

- API_CONTRACT.md 관련 — **직접 수정하지 않고 여기 제안만 남김**:
  - `PATCH /api/itineraries/:id` 요청에 `target_poi_id`를 추가 제안. 원안(`{day, new_poi_id}`)만으로는
    하루에 스탑이 여러 개일 때 "어느 스탑을 교체하는지" 특정할 수 없음(regenerate-stop 응답이 상태를
    들고 있지 않아서 서버가 추론 불가). 구현은 이미 `target_poi_id` 필수로 반영해뒀음.
  - `POST /api/alerts/trigger`, `POST /api/alerts/:alert_id/respond`, `POST /api/itineraries/regenerate-stop`
    3개는 계약에 인증 요구가 명시돼 있지 않았지만, 전제 조건이 "저장된(로그인) 일정"이라 `Authorization`
    헤더 필수로 구현함.

- 블로커:
  1. Supabase 프로젝트 생성 + Google OAuth 클라이언트 등록 — 계정 로그인이 필요해 에이전트가 대행 불가
     (`server/README.md` §1에 수동 절차 정리해둠, 승현님 액션 필요).
  2. TourAPI/의료관광정보/기상청 단기예보 서비스키 전부 미보유 — 발급 전이라 `scripts/sync`, `agent/`의
     실제 네트워크 호출은 이번 세션에서 검증하지 못했음(로직/스키마만 준비, syntax + 더미데이터 기능
     테스트는 통과).
  3. TourAPI `sigunguCode`(인제=5/홍천=3/평창=7, `tourapi_client.js`)와 기상청 격자 nx/ny
     (`agent/src/weather.js` REGION_GRID, 현재 비어있음)는 실제 서비스키로 한 번 검증 필요 — 틀리면
     엉뚱한 지역 데이터를 가져오는 조용한 실패라 검증 전엔 코드가 명시적 에러를 던지게 해뒀음.
  4. 카카오모빌리티 API 키 미보유 — traffic 트리거/실제 동선 표시 둘 다 이 키 필요.
  5. care_facilities 전화번호 미검증 (위 5번 항목 참고) — 데모 전 실제 번호로 교체 필요.
  6. LLM 가중치 연속값 vs 이산값 결정(`TEST_PLAN.md` T-101)은 QA팀 담당이라 스코어링 로직은 현재
     연속값(0~1) 그대로 사용하도록 구현함 — QA 결과 나오면 `llm.js`/`API_CONTRACT.md §5`에 반영 필요.

- 다음 액션:
  - PM: `pois.adult_only`, `care_facilities` 테이블을 PRD 4장에 반영할지 확인 후 알려주시면 확정.
    `PATCH /api/itineraries/:id`에 `target_poi_id` 추가하는 것도 API_CONTRACT.md에 반영 부탁드립니다.
  - 승현님: Supabase 프로젝트 생성 + Google OAuth 등록 (`server/README.md` §1), TourAPI/의료관광정보/
    기상청 서비스키 발급.
  - 백엔드: 서비스키 발급되는 대로 `scripts/sync/sync_pois.js` 실행해 sigunguCode 검증 + 실제
    TourAPI 데이터로 시드 교체, `agent/src/weather.js`의 기상청 격자좌표 채우기.
  - 프론트팀: `POST /api/itineraries/generate` 응답 스펙 그대로 연동 가능(스켈레톤 아님, 시드 데이터로
    실제 동작). `docs/API_CONTRACT.md`의 `PATCH` 요청 바디에 `target_poi_id`가 추가된 점 참고 부탁.

