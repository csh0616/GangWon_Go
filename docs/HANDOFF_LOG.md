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


## [2026-09-06 21:00] 전략기획팀(PM) — 1차 백엔드 아키텍처 점검 결과 + 수정 지시

1주차 백엔드 결과물을 스펙 정합성 / 알고리즘 정확성 / 보안·운영 세 방향으로 교차 점검했습니다.
아래 순서대로(P0 → P2) 수정해주세요. 각 항목의 파일:줄은 점검 시점(커밋 `ef51870`) 기준입니다.

**먼저, 점검에서 문제없다고 확인된 것** (다시 손대지 마세요): Haversine 수식·2-opt 종료 조건·`pinFirst`
동작, Supabase 토큰 검증 방식(anon 클라이언트로 GoTrue 왕복 — 로컬 디코딩 아님), `/api/itineraries/*`
라우트의 `user_id` 스코프, 2단계 확인 흐름(trigger는 alerts row만 생성, 적용은 respond의 yes 분기에서만),
중복 방지 키와 부분 유니크 인덱스, 3분 타임아웃이 `responded_at`을 NULL로 남기는 것, traffic 기준점 규칙,
쿼리 파라미터화(주입 없음), CORS 설정.

### P0 — 보안 (다른 작업보다 먼저)

1. **`/api/alerts/*` 소유권 검사 누락 (치명적)** — `routes/alerts.js:9-16, 41-47`이 `requireAuth`만 통과시키고
   `req.user.id`를 전혀 쓰지 않습니다. `lib/alertTrigger.js:57-62`(itinerary 조회), `:134`(alert 조회)는
   service-role 클라이언트라 RLS도 우회되므로, 로그인한 아무나 남의 `itinerary_id`/`alert_id`만 알면
   그 일정을 조회하고 `:170`에서 **덮어쓸 수 있습니다**. `itinerary_id`는 Realtime 채널명이라 비밀이 아닙니다.
   → `createProposedAlert`/`respondToAlert`에 `userId`를 넘기고, itinerary 조회에 `.eq('user_id', userId)`를
   체이닝. respond는 `alert.itinerary_id`로 itinerary를 먼저 사용자 스코프로 확인한 뒤 변경.
   본인 소유가 아니면 `NOT_FOUND`(404, API_CONTRACT §0.1 — 존재 여부를 노출하지 않기 위해 403이 아님).
   `routes/itineraries.js:103-110, 127-132, 170-175`가 이미 올바른 패턴이니 그대로 따라가면 됩니다.

2. **`.gitignore`가 저장소에 아예 없음** — `server/README.md:32`가 `cp .env.example .env`를 안내하는데,
   루트에 `.gitignore`가 없어 다음 `git add .` 한 번에 `SUPABASE_SERVICE_ROLE_KEY`(RLS 전부 우회하는 키)와
   `ANTHROPIC_API_KEY`가 공개 저장소로 올라갑니다. 아직 커밋된 시크릿은 없으니 **키 발급/셋업 전에** 루트
   `.gitignore`에 `.env`, `.env.*`(단 `.env.example` 제외), `node_modules/`를 추가해주세요.

### P1 — 데모가 실제로 안 되는 것

3. **Realtime 알림이 배달되지 않음** — 마이그레이션에 `alter publication supabase_realtime add table alerts;`가
   없습니다. Supabase는 publication에 등록된 테이블만 push하므로, 프론트 구독은 SUBSCRIBED로 성공하고
   아무것도 수신하지 못합니다(헤드라인 기능 무동작). 마이그레이션에 위 구문과
   `alter table alerts replica identity full;`(confirmed/dismissed UPDATE 이벤트에도 `itinerary_id` 필터가
   걸리도록) 추가.

4. **날짜 계산이 UTC 기준 — KST와 9시간 어긋남** (PRD 6장에 KST 규칙 신설했습니다) —
   `agent/src/monitor.js:11-19` `todayISO()`가 `toISOString()` 사용. 한국시간 00~09시에 전날 일정을 스캔하고,
   당일치기 일정은 그 시간대에 감시 대상에서 통째로 빠집니다. `agent/src/weather.js:19-31`도 `getHours()`(local)와
   `toISOString()`(UTC)을 섞어 써서 `base_date`가 1~2일 과거로 요청되고, 실패가 `monitor.js:38-41`에서
   조용히 삼켜져 rain 트리거가 아예 안 뜹니다. 두 곳 모두 명시적 KST 변환으로 수정.

5. **강제 트리거 버튼 두 번 누르면 빈 모달** — `routes/alerts.js:18-20`의 중복 경로가 `{alert_id, status, reused}`만
   반환합니다. API_CONTRACT §3을 "중복 시에도 신규와 동일한 응답 형태"로 명확화했으니, 기존 alert row의
   `previous_poi_id`/`proposed_poi_id`로 `message`/`proposed_stop`을 다시 조립해서 채워주세요.
   조건 감시 cron이 같은 알림을 먼저 만들어둔 경우에도 같은 경로를 탑니다.

6. **3분 타임아웃과 Yes 클릭의 경쟁이 500** — `alertTrigger.js:136-138`이 bare `Error`를 던져
   `errorHandler.js:6`에서 500이 됩니다. 시연 중 설명이 3분을 넘긴 뒤 Yes를 누르면 발생하는 정상 케이스이니
   `ALERT_EXPIRED`(409, API_CONTRACT §0.1)로 바꿔주세요.

7. **traffic 트리거가 500 나거나 3초를 넘김** — `lib/directions.js:33-46`이 후보 POI마다 순차 HTTP 호출을 하고,
   카카오 키 미설정/장애 시 모든 후보를 조용히 탈락시켜 `alertTrigger.js:92-94`에서 bare Error → 500이 됩니다.
   PRD 6장 폴백 원칙("실패한 조각만 조용히 대체")과 반대입니다. → 후보 호출을 `Promise.all`로 병렬화하고,
   **전부 실패하면 Haversine 거리 기준으로 폴백**(에러로 막지 않음). 후보가 진짜 없을 때만 `NO_CANDIDATE`(404).

8. **잘못된 `itinerary_json` 하나가 감시 에이전트 전체를 멈춤** — `monitor.js:95-97`이 per-itinerary `try` 바깥이라
   `days`가 없는 row 하나면 `tick` 전체가 중단되고, 그 뒤 일정은 매 주기 영원히 스킵됩니다.
   → `:95-97`을 try 안으로 옮기고, `routes/itineraries.js:69`에서 `itinerary_json.days`가
   `{day, stops[]}` 배열인지 저장 시 검증(`INVALID_STRUCTURED_INPUT`).

### P2 — 조용히 틀리는 것 (실데이터 들어오면 드러남)

9. **동기화 필드 케이싱 불일치** — `scripts/sync/category_mapping.js:48`은 `raw.contentTypeId`,
   `scripts/sync/sync_pois.js:26,34-36`은 `raw.contentid/contenttypeid/mapx`를 같은 객체에서 읽습니다.
   TourAPI `_type=json` 키는 전부 소문자라, 문서상 "가장 신뢰도 높은 신호"인 `CONTENT_TYPE_MAP`이 통째로
   dead code입니다(cat1/cat2로만 분류되고, cat 필드가 빈 축제 로우는 조용히 누락). 케이싱 통일 필요.

10. **`alerts`의 FK가 동기화와 충돌** — `0001_init_schema.sql:92-93`이 `previous_poi_id`/`proposed_poi_id`를
    `pois(id)` 하드 FK로 잡았는데, `sync_pois.js:51-55`/`seed_pois.js:17-21`이 delete+insert로 UUID를 새로
    발급합니다. 재동기화 후 기존 알림이 FK 위반으로 깨지고, 반대로 알림이 하나라도 있으면 그 시군 동기화가
    막힙니다. PRD 4장 스냅샷 정책상 POI id는 참조 무결성 대상이 아니므로 **FK 제거**(또는 `content_id` 기반
    upsert로 id 보존)가 맞습니다. `monitor.js:47`이 스냅샷 id로 `pois`를 재조회하는 것도 같은 이유로 깨집니다.

11. **축제 날짜 판정** (PRD 3.5절에 일자 단위 기준 명시했습니다) — `scoring.js:77-81`은 여행 기간 전체와의
    겹침만 보고, 일자 단위 검사(`festivalOverlapsDate`)는 앵커에만 걸려 있어 축제가 열리지 않는 날에
    축제 스탑이 배치됩니다. 부분 재구성(`itineraries.js:148`, `alertTrigger.js:76`)에는 날짜 필터가 아예 없어
    끝난 축제가 대체 후보 1순위로 나옵니다. 양쪽 모두 일자 기준 필터 적용.

12. **rain이 야외 POI를 대체 후보로 제안 가능** (PRD 3.5절 조정표를 "가중치 0"에서 "후보 제외"로 수정했습니다) —
    `alertAdjust.js:12-16`이 가중치만 0으로 만들어, 태그를 여러 개 가진 POI가 남은 점수로 1위가 될 수 있습니다.
    자유텍스트 없이 만든 코스는 가중치가 전부 0이라 DB 순서대로 아무거나 뽑히기까지 합니다.
    → 태그 기반 제외 필터를 먼저 적용하고, 가중치는 남은 후보 순위 결정에만 사용.

13. **앵커 날짜가 선호도를 무시** (PRD 3.5절에 명시했습니다) — `scoring.js:103-112`가 앵커 주변을 거리순으로만
    채우고 `__score`를 안 봅니다. 앵커 근처 POI를 먼저 소진해 다른 날 후보 품질까지 떨어뜨립니다.
    → 가중치 스코어를 1차 기준으로 하되 앵커와의 거리를 함께 고려.

14. **좌표 없는 TourAPI 로우가 (0,0)으로 저장** — `sync_pois.js:35-36`의 `Number('')`는 `0`이라
    아프리카 앞바다 좌표가 정상 POI처럼 삽입되고, 코스에 ~11,000km 구간이 생깁니다. 삽입 전 좌표 유효성
    검증(위경도 범위, NaN) 후 제외 + 로그.

15. **`sync_pois`의 delete+insert가 비원자적** — `sync_pois.js:51-55`에서 DELETE는 커밋되고 INSERT가 실패하면
    그 시군 POI가 0건이 됩니다(주석의 "마지막 성공 데이터 유지" 설명과 반대). upsert 또는 트랜잭션/스테이징
    테이블 방식으로 변경.

16. **auth 미들웨어의 unhandled rejection** — `middleware/auth.js:11-24`가 async인데 try/catch 없이 Express 4에
    넘겨져, Supabase 도달 실패 시 응답 없이 프로세스가 죽습니다(Node 15+ 기본값). try/catch → `next(err)`.

17. **날짜 형식 미검증** — `routes/itineraries.js:27`이 존재 여부만 봐서 `2026-13-45` 같은 값이
    `scoring.js:19-24`에서 NaN이 되고 **빈 일정이 200으로 반환**됩니다. `end_date < start_date`도 조용히
    1일로 collapse됩니다. API_CONTRACT §0.1의 `INVALID_STRUCTURED_INPUT` 조건대로 검증(형식, 순서, 10일 상한).

18. **기타 계약 불일치**: `regenerate-stop`에서 LLM 실패 시 저장된 `preference_weights`로 폴백해야 하는데
    전부 0을 씁니다(`itineraries.js:137-140`) — 전부 0 폴백은 §1 `/generate` 전용입니다.
    `respondToAlert`가 `alert` 전체 row를 응답에 실어 보냅니다(`alertTrigger.js:181`, 계약은 `{status, updated_stop}`).
    `PATCH`가 `target_poi_id`가 안 맞아도 `day_reordered:true`로 200을 반환합니다(`itineraries.js:183-191` →
    `STOP_NOT_FOUND` 404). 알림 문구가 서버에 하드코딩돼 있습니다(`alertTrigger.js:14-34`, PRD 6장 다국어 규칙 —
    키+치환값 형태로 변경). `lang`이 검증만 되고 사용되지 않으며 `users.preferred_lang`이 기록되지 않습니다.

### 시드 데이터

`pois_seed.json`에 `adult_only: true`인 로우가 0건이라 `family_with_kids` 필터가 검증 불가능하고,
`festival_event`가 평창 1건뿐이라 앵커 배치도 평창에서만 시연됩니다. 각각 2~3건씩 추가해주세요.
평창 효석문화제의 2026년 실제 개최 일정은 여전히 미확인 상태입니다(리허설 전 확인 필요).

- 블로커: 없음 (위 수정은 전부 서비스키 없이 진행 가능. 실동기화 검증만 키 발급 이후로 남습니다)
- 다음 액션:
  - 백엔드: P0 → P1 → P2 순서로 수정 후 `feat/backend-fixes-round1` 브랜치로 PR. 수정 완료분은 이 로그에 append.
  - PM: 수정 PR 올라오면 재점검. QA팀 세션 시작 시 TEST_PLAN에 위 항목별 회귀 테스트 케이스 추가 예정.
  - 승현님: Supabase 프로젝트 + Google OAuth, 서비스키 4종(TourAPI/의료관광정보/기상청/카카오모빌리티) 발급.

## [2026-09-06 22:30] 백엔드팀 — 1차 점검 P0~P2 수정 완료 + 서비스키 실검증 결과

`feat/backend-fixes-round1` 브랜치. 커밋 시점 기준 코드에 반영. PRD 6장 KST 규칙/3.5절 rain·축제
규칙/API_CONTRACT §0.1 에러코드 표준을 전부 다시 읽고 그 기준으로 고쳤습니다.

### P0 (완료)

1. **`/api/alerts/*` 소유권 검사**: `createProposedAlert`/`respondToAlert`에 `userId` 필수 파라미터
   추가, itinerary 조회에 `.eq('user_id', userId)` 체이닝(`alertTrigger.js`의 `fetchOwnedItinerary`).
   본인 소유가 아니면 `NOT_FOUND`(404) — 존재 여부 비노출. 라우트(`alerts.js`)는 `req.user.id`를
   그대로 넘기고, agent(`monitor.js`)는 스캔 중 이미 들고 있는 `itinerary.user_id`를 넘깁니다.
2. 스킵함 (PM이 이미 `.gitignore` 반영, PR #4/#5).

### P1 (완료)

3. **Realtime publication 누락**: 마이그레이션에 `alter publication supabase_realtime add table alerts;`
   + `alter table alerts replica identity full;` 추가.
4. **KST 미적용**: `server/src/lib/time.js` 신설(UTC+9 시프트 방식, `todayKstISO`/`todayKstYYYYMMDD`/
   `nowKstHourMinute`). `agent/src/monitor.js`의 "오늘" 판정, `agent/src/weather.js`의
   `nearestBaseTime()` 모두 이걸로 교체.
5. **중복 트리거 응답 불완전**: `createProposedAlert`가 중복이어도 기존 alert의 `previous_poi_id`/
   `proposed_poi_id`로 POI를 다시 조회해 `message`/`proposed_stop`을 완전히 재조립. 라우트의
   `isDuplicate` 분기 자체를 제거 — 항상 동일한 응답 형태.
6. **3분 타임아웃 경쟁 시 500**: `respondToAlert`가 `status !== 'proposed'`면 `ALERT_EXPIRED`(409) 반환.
7. **traffic 순차호출/전체실패 시 500**: `directions.js`의 `filterWithinDuration`을 `Promise.all` 병렬화,
   `{withinRange, allFailed}` 반환. 카카오 API 전부 실패 시에만 Haversine 10km 근사로 폴백(진짜
   후보 0건인 경우와 구분). 후보가 정말 없으면 `NO_CANDIDATE`(404).
8. **감시 에이전트 전체 정지**: `monitor.js`에서 `dayIndex`/`dayEntry` 조회까지 per-itinerary
   `try` 안으로 이동. 저장 시점 검증도 추가 — `server/src/lib/validators.js`의
   `isValidItineraryJson()`을 `POST /api/itineraries`에 적용, 구조가 어긋나면 `INVALID_STRUCTURED_INPUT`.

### P2 (완료)

9. **필드 케이싱 불일치**: `category_mapping.js`가 `raw.contentTypeId`(항상 undefined) 대신
   `raw.contenttypeid`(TourAPI `_type=json` 실제 소문자 키)를 읽도록 수정 — `CONTENT_TYPE_MAP`
   전체가 dead code였던 문제 해결.
10. **alerts FK 충돌**: `previous_poi_id`/`proposed_poi_id`의 `pois(id)` 하드 FK 제거(스냅샷 참조라
    참조무결성 대상 아님, PRD 4장/ERD_SEQUENCE.md §1과 동일 원칙). 컬럼은 그대로 uuid로 유지.
11. **축제 일자 판정**: `scoring.js` — 앵커로 안 뽑힌 festival_event POI는 일반 스탑 풀에서 완전히
    제외(그렇지 않으면 날짜 안 맞는 날에 배치될 수 있었음). `regenerate-stop`(`itineraries.js`)과
    자동 트리거(`alertTrigger.js`) 양쪽에 `dateForDayIndex`+`festivalOverlapsDate`로 그 날짜 필터
    재적용. 더미데이터로 검증: weight=0일 때 후보 풀 누출 없음, weight>0일 때 정확히 이벤트 날짜와
    겹치는 day에만 앵커 배치되는 것 확인.
12. **rain 처리 방식**: `alertAdjust.js`를 가중치 조정(`adjustWeightsForCondition`) 대신 후보 제외
    (`filterOutdoorForRain`)로 교체. 태그 여러 개 가진 POI(`["nature_hiking","food_local"]`)가
    남은 점수로 1위가 되던 문제 재현 테스트로 확인 후 수정 검증함.
13. **앵커 주변 채우기가 거리만 봄**: 점수를 1차 기준, 거리를 보조 페널티로 섞은 `__combined` 스코어로
    변경 (`ANCHOR_DISTANCE_PENALTY_WEIGHT = 0.3`).
14. **좌표 (0,0) 삽입**: `sync_pois.js` — `mapx`/`mapy` 빈 값 사전 제외 + 대한민국 대략 경계
    (lat 33~39, lng 124~132) 밖이면 제외.
15. **delete+insert 비원자성**: `sync_pois.js`/`sync_medical.js`/`seed_pois.js`/`seed_care.js` 전부
    INSERT 먼저 → 성공 시에만 `synced_at < 이번실행시각` 조건으로 이전 데이터 DELETE하도록 순서 변경
    (PM이 지적한 파일 외 나머지 3개도 동일 패턴이라 함께 고쳤습니다).
16. **auth 미들웨어 unhandled rejection**: `requireAuth` 전체를 try/catch로 감싸고 `next(err)`.
17. **날짜 미검증**: `validators.js`의 `validateTripDates`(형식/순서/10일 상한) + `isValidCompanions`를
    `/generate`와 `POST /api/itineraries` 양쪽에 적용.
18. **기타 계약 불일치**: (a) `regenerate-stop`의 LLM 실패 폴백을 저장된 `preference_weights`로
    바꿈(`llm.js`에 `extractWeightsRaw`/`extractStopWeights` 분리 — `/generate` 전용 전부-0 폴백과
    분리). (b) `respondToAlert` 응답을 `{status, updated_stop}`만 담게 축소. (c) PATCH가 `day`/
    `target_poi_id` 불일치 시 `STOP_NOT_FOUND`(404) 반환하도록 수정(기존엔 무조건 200). (d) 알림
    문구를 완성 문장 대신 `{key, params}` 구조로 변경 — `alertTrigger.js`의 `buildMessagePayload`.
    (e) `lang`을 `POST /api/itineraries`에서 선택적으로 받아 최초 저장 시 `users.preferred_lang`에 기록.

추가로 §0.1을 다시 읽다가 발견한 것: `errorHandler.js`가 인식 못한 에러(raw DB 에러 등)의
`err.message`를 그대로 클라이언트에 흘려보내고 있었습니다 — §0.1 "목록에 없는 실패는 로그에만
원문을 남기고 응답엔 `INTERNAL_ERROR`+일반화된 메시지만" 규정과 어긋나서 `apiError()`로 만든
에러만 지정 status/code/message를 쓰고, 나머지는 전부 `INTERNAL_ERROR` 500 + 일반 메시지로
바꿨습니다(`isApiError` 플래그로 구분). `/generate`의 `NO_POI_DATA`/`NO_CANDIDATE` 구분도 §0.1
정의대로 다시 나눴습니다(region에 POI 자체가 0건 vs relationship 필터로 다 걸러진 경우).

### API_CONTRACT.md 반영 제안 (직접 수정 안 함)

- §3 alerts payload의 `message` 예시가 완성 문장(`{en, zh}`)인데, PRD 6장(1주차 점검 신설)이
  "하드코딩 금지, 키+치환값" 규칙을 명시했습니다. 코드는 `{ key: "alert.rain", params: {
  previous_poi_name, candidate_poi_name } }` 형태로 이미 바꿨으니, §3 예시도 이 형태로 갱신 부탁드립니다.
- §2 `POST /api/itineraries` 요청에 선택 필드 `lang`(`en`|`zh`) 추가 제안 — 최초 저장 시
  `users.preferred_lang`에 기록하기 위함(18-e). 없으면 그냥 기록 안 하고 넘어가서 하위호환됩니다.

### 시드 데이터 보강 (완료)

- `adult_only: true` 3건 추가 — 인제 "내린천"(래프팅), 홍천 "힐리언스 선마을"(웰니스 리조트),
  평창 "알펜시아리조트"(스키점프 체험). **실제 연령 제한 정책을 확인한 값이 아니라 `family_with_kids`
  필터 검증용 테스트 픽스처**입니다 — 개연성 있는 액티비티 유형으로 골랐을 뿐, 세 시설의 실제 정책은
  미확인. QA 테스트 후 실제 정책으로 교체 필요.
- festival_event 2건 추가 — 인제 "자작나무숲 단풍축제(데모)"(09-15~16), 홍천 "억새축제(데모)"
  (09-17~18). **실존하지 않는 가상 축제**입니다(이름/category에 "데모" 명시). 인제·홍천에서도
  축제 앵커 로직을 시연할 수 있게 하려는 목적이며, 실제 TourAPI 축제 데이터가 들어오면 자연히 덮어써짐.

### 서비스키 실검증 결과 (일부만 가능했음 — 아래 블로커 참고)

- ✅ **카카오모빌리티 Directions API**: 실제 키로 호출 성공 확인. 인제전통시장→하늘내린센터
  구간 24초 응답 정상. 시드 데이터의 "소양호" 좌표(호수 한가운데 근사치)로 테스트했을 때는
  `result_code 103`(도착지 주변 도로 탐색 불가)이 났는데, 이건 API/키 문제가 아니라 좌표 정확도
  문제입니다 — 실제 TourAPI 동기화로 mapx/mapy가 정확해지면 자연히 해결됨.
- ✅ **기상청 격자좌표(nx/ny)**: 이전엔 REGION_GRID가 비어있어 명시적 에러를 던지게만 해뒀는데,
  이번에 기상청이 공개한 LCC 변환 공식을 `server/src/lib/kmaGrid.js`로 직접 구현해 인제읍/홍천읍/
  평창읍 좌표로 계산했습니다(암기값 하드코딩이 아니라 코드로 재현 가능). 알려진 검증 기준점인
  서울시청(37.5665, 126.9780) → (60, 127)로 공식 자체는 맞다는 걸 확인했습니다. 계산 결과:
  인제(80,138)/홍천(75,130)/평창(84,123). **실제 기상청 API 호출로 이 격자가 응답을 정상적으로
  주는지는 아래 네트워크 블로커 때문에 이번 세션에서 확인 못했습니다.**
- ❌ **TourAPI/기상청 실호출 (`apis.data.go.kr`)**: 이 세션의 실행 환경에서 이 도메인만 연결이
  전부 타임아웃됩니다 — GitHub/카카오모빌리티 등 다른 도메인은 정상 연결되는 걸로 봐서 특정
  호스트만 막히거나 응답이 없는 상태입니다(샌드박스 권한을 해제하고 재시도해도 동일, 3회 재시도도
  전부 타임아웃 — 일시적 문제로 보이지 않음). **`sigunguCode`(인제5/홍천3/평창7) 검증, 실제
  TourAPI 데이터로 시드 교체, 기상청 실호출 확인 전부 이 문제로 못 했습니다.**
- ⚠️ 요청하신 `SERVICE_KEY_IS_NOT_REGISTERED_ERROR`(Encoding/Decoding 키 오탐지) 여부도 같은
  이유로 확인 불가 — 연결 자체가 타임아웃이라 서버 응답을 아예 못 받았습니다. 이 에러는 서버가
  응답을 줘야 나타나므로, 이 세션의 결과만으로는 키 타입 문제인지 네트워크 문제인지 구분이 안 됩니다.
- ⚠️ **DB 스키마 미적용**: `scripts/sync/.env`로 실제 Supabase 프로젝트에 연결은 확인했지만
  (`pois`/`care_facilities` 테이블 조회 시 "not found in schema cache" — Supabase 프로젝트는
  존재하지만 `server/db/migrations/0001_init_schema.sql`이 아직 실행 안 된 상태), 마이그레이션이
  적용 전이라 `sync_pois.js`를 실행해도 어차피 실패했을 것입니다. 승현님이 Supabase SQL Editor에서
  이 마이그레이션 파일을 먼저 실행해야 이후 모든 쓰기 작업(시드/동기화/실제 앱 동작)이 가능합니다.

- 블로커:
  1. **DB 마이그레이션 미적용** — `docs/../server/db/migrations/0001_init_schema.sql`을 Supabase
     SQL Editor에서 실행 필요 (`server/README.md` §1 4번 단계). 이게 안 되면 sync/seed 스크립트
     전부 "table not found"로 실패합니다.
  2. **`apis.data.go.kr` 네트워크 불통** — 이 세션의 실행 환경 한정 문제로 보입니다. 승현님 본인
     PC(또는 다른 네트워크)의 터미널에서 아래를 직접 실행해 결과를 공유해주시면, 그 로그를 보고
     `SERVICE_KEY_IS_NOT_REGISTERED_ERROR` 여부·`sigunguCode` 정확성을 바로 진단하겠습니다:
     ```
     cd scripts/sync && node sync_pois.js
     ```
     (마이그레이션 먼저 적용한 뒤 실행할 것 — 위 1번)
- 다음 액션:
  - 승현님: (1) 마이그레이션 SQL 실행, (2) 본인 터미널에서 `sync_pois.js` 실행 후 로그 공유.
  - 백엔드: 로그 받으면 `SERVICE_KEY_IS_NOT_REGISTERED_ERROR`/sigunguCode 오류 여부 진단 후 필요시
    `tourapi_client.js`/`REGION_TO_SIGUNGU` 수정. 기상청 실호출도 같은 방식으로 로그 받아 확인.
  - PM: 위 API_CONTRACT.md 반영 제안 2건(§3 message 형태, §2 lang 필드) 확인 부탁드립니다.

## [2026-09-07 00:30] 전략기획팀(PM) — 라운드 1 검증 결과 + 라운드 2 수정 지시

라운드 1(`d89bce5`) 수정본을 항목별로 재검증했습니다. **P0 1번(alerts 소유권 검사), P1 3~8번,
P2 9·11~18번, 시드 데이터, kmaGrid LCC 공식까지 전부 제대로 반영된 것을 확인했습니다.** 특히
`time.js`의 KST 변환은 월/연/윤년 경계까지 실제 값으로 검증했고, `kmaGrid.js`는 서울시청(60,127)
외에 부산·대전·제주 교차검증까지 통과했습니다. rain이 가중치 조작이 아니라 태그 기반 후보 제외로
바뀐 것, 축제 일자 필터가 생성·부분재구성 양쪽에 들어간 것, 에러코드가 §0.1 10종으로 통일되고
Postgres 원문 누출이 차단된 것도 확인했습니다. **이 항목들은 다시 손대지 마세요.**

아래는 재검증에서 **새로 발견된 문제**와 이번 라운드에 확정된 외부 API 스펙입니다.
브랜치는 `feat/backend-fixes-round2`로 만들어주세요.

### 마이그레이션 규칙 (먼저 읽을 것)

`0001_init_schema.sql`은 **이미 Supabase에 적용 완료**되었습니다. 이 파일을 수정하면 DB와 파일이
어긋나므로, 이번 라운드의 스키마 변경은 전부 **`0002_` 새 마이그레이션 파일**로 작성하세요.

### P1 — 리허설/데모에서 드러날 문제

1. **자유텍스트 없이 생성하면 축제가 아예 배치되지 않음** — `scoring.js:97`의 앵커 조건이 `__score > 0`
   인데, `free_text`가 비면 가중치가 전부 0이라(API_CONTRACT §1) 조건을 못 넘습니다. 게다가 `:106`이
   앵커가 아닌 festival POI를 일반 풀에서 통째로 제외해서, 개최일이 맞는 축제도 코스에 못 들어갑니다.
   PRD 3.5절은 "일자 검사를 통과하면 배치"이지 "가중치 0이면 배치 금지"가 아닙니다. `TEST_PLAN.md`
   T-001이 정확히 "자유텍스트 없이 생성"이라 리허설에서 바로 드러납니다.
   → 앵커 조건에서 `__score > 0`을 떼고, 일반 스탑 경로에서도 festival POI를 제외하지 말고
   **일자 검사만 통과하면 배치 가능**하게 바꿔주세요.

2. **`/generate`가 200으로 준 코스를 저장할 때 400이 남** — `validators.js:42`의 `d.stops.length > 0`
   검증과 `scoring.js:143-147`이 충돌합니다. POI가 적은 시군에서 긴 일정을 만들면 스탑 0개인 day가
   생기는데(재현: POI 2건·4일 → `[1,1,0,0]`), 그 응답을 그대로 `POST /api/itineraries`에 보내면
   `INVALID_STRUCTURED_INPUT`으로 거부됩니다. 지금 시드(시군당 13~14건)로는 안 터지지만 실제
   TourAPI 데이터가 얇은 시군이 생기면 바로 드러납니다.
   → `buildItineraryDays`가 빈 day를 만들지 않도록(스탑 없는 날 제거 또는 최소 1개 보장) 고치는 쪽을
   권합니다. 검증을 느슨하게 푸는 건 8번 항목의 방어선을 약화시키므로 차선입니다.

3. **중복 알림 응답에서 `condition`과 `message`가 어긋남** — `routes/alerts.js:24-27`은 `trigger_type`/
   `condition`을 **요청값** 그대로 반환하는데, `message.key`는 `alertTrigger.js:85`에서 **기존 alert의**
   `condition`으로 만듭니다. cron이 rain 알림을 먼저 만들어둔 상태에서 데모 버튼을 traffic으로 누르면
   `condition:"traffic"` + `message.key:"alert.rain"`인 응답이 나갑니다.
   → 중복 경로에서는 `existing.trigger_type`/`existing.condition`을 반환하세요.

4. **POI id 미보존 (라운드 1의 P2-10 후속)** — FK는 제거됐지만 `content_id` 기반 upsert가 아니라서
   재동기화하면 모든 POI의 uuid가 새로 발급됩니다. 그러면 `monitor.js:46`의 `.in('id', poiIds)`가
   빈 결과를 반환하는데 `poiErr`가 아니라 정상 응답이라 `target=undefined`로 조용히 넘어가고,
   **rain 트리거가 로그 한 줄 없이 영구 무동작**이 됩니다. `alertTrigger.js:80`의 후보 재조회,
   `respondToAlert:195`의 `.single()`도 같은 이유로 깨집니다.
   → PRD 4장에 `pois.content_id`를 추가했습니다. `0002_`로 컬럼 추가 + unique 인덱스, `sync_pois.js`와
   `seed_pois.js`를 `content_id` 기준 upsert로 변경(시드에도 임의 content_id 부여). 추가로 `monitor.js`가
   재조회 결과가 0건이면 조용히 넘어가지 말고 경고 로그를 남기게 해주세요.

### P2 — 잔여 개선

5. `directions.js:41-53` `filterWithinDuration`에 동시성 상한이 없어 후보 수만큼 카카오 호출이 동시에
   나갑니다. 429 위험이 있으니 배치 크기(예: 5개씩)를 두세요.
6. `itineraries.js:236`, `alertTrigger.js:195`가 `.single()`이라 존재하지 않는 POI id면 500이 납니다.
   §0.1 기준 `NOT_FOUND`(404)가 맞습니다.
7. `alerts.js:12`에 `trigger_type`/`condition` enum 검증이 없어 잘못된 값이 오면 DB enum 에러 → 500이
   됩니다. 400 `INVALID_STRUCTURED_INPUT`으로 막아주세요.
8. `sync_pois.js`/`sync_medical.js`의 catch가 `err.message`만 찍어서 `fetch failed`밖에 안 보입니다.
   **`err.cause`까지 로깅**하세요 — 이번 TourAPI 장애 진단에 반나절이 걸린 직접적 원인입니다.
9. `agent/src/weather.js:3-6` 헤더 주석이 아직 "REGION_GRID를 채우기 전엔 에러를 던진다"로 남아 있는데
   `:25`에서 kmaGrid로 계산되도록 바뀌었습니다. 주석 갱신.
10. 시드의 "인제 자작나무숲 단풍축제", "홍천강 억새축제"가 각각 기존 POI(원대리 자작나무숲, 홍천강)와
    좌표가 완전히 동일해 지도에서 겹칩니다. 좌표를 조금 분리해주세요.

### 의료관광정보 API 스펙 (확정 — 공식 매뉴얼 v4.1 기준, 추측 금지)

현재 `sync_medical.js`는 전부 추측으로 작성돼 있습니다. 아래로 **전면 교체**하세요.

- **base URL**: `https://apis.data.go.kr/B551011/MdclTursmService` (기존 `MedicalTourismService`는 오타)
- **1단계 `/ldongCode`** — 지역코드 확보(1회성, 결과를 상수로 박아둘 것)
  - `lDongListYn=N` → 시도 목록이 `{rnum, code, name}`으로 옴. 여기서 강원 `code` 확보
  - `lDongListYn=Y&lDongRegnCd=<강원코드>` → 시군구 목록이 `{lDongRegnCd, lDongRegnNm, lDongSignguCd,
    lDongSignguNm}`으로 옴. 인제/홍천/평창의 `lDongSignguCd` 확보
  - 주의: 이름이 요청 언어로 옴(예: Seoul, Jongno-gu) → 영문명으로 매칭. 시군구 코드는 3자리("110")
- **2단계 `/areaBasedList`** — 시군별 시설 목록
  - 파라미터: `serviceKey, numOfRows, pageNo, MobileOS=ETC, MobileApp, langDivCd, arrange=C,
    lDongRegnCd, lDongSignguCd, _type=json`
  - **`/detailCommon`은 호출하지 마세요.** 목록 응답에 이미 `tel`, `mapX`, `mapY`, `title`,
    `baseAddr`가 포함됩니다(매뉴얼 확인 완료). detailCommon은 `overview`/`homepage`만 추가로 줄 뿐입니다.
  - `/mdclTursmSyncList`는 미러링 유지용이라 이번 스코프 밖입니다.
- **응답 필드는 camelCase**: `contentId`, `title`, `tel`, `mapX`, `mapY`, `baseAddr`, `detailAddr`,
  `zipCd`, `mdfcnDt`, `lDongRegnCd`, `lDongSignguCd`.
  **TourAPI KorService2는 전부 소문자(`contentid`, `mapx`)인데 이 API는 반대입니다** — 라운드 1에서
  고친 케이싱 버그와 같은 함정이 반대 방향으로 있으니 두 스크립트를 같은 규칙으로 통일하지 마세요.
- **언어**: `langDivCd`는 ENG/JPN/CHS/RUS만 있고 **한국어가 없습니다.** 시군당 ENG·CHS 2회 호출해
  `contentId` 기준으로 같은 row에 합치세요. PRD 4장 `care_facilities`에 `name_en`/`name_zh`/
  `address_en`/`address_zh`/`content_id`/`synced_at`을 반영했습니다(`0002_` 마이그레이션 대상).
- 응답에 시설 종류 구분이 없으므로 `category`는 일단 `hospital` 고정으로 두고, 필요해지면
  `/detailMdclTursm`(상세 의료관광 정보)으로 보강하는 걸 검토하세요.

### TourAPI 서버 장애 (진행 중, 백엔드 액션 아님)

`apis.data.go.kr`이 현재 응답하지 않습니다. 진단 결과: DNS 정상(27.101.236.63), 프록시 없음, IPv6 무관,
**TCP 443 연결은 성공하나 TLS ClientHello 이후 서버 무응답**, 80 포트도 0 bytes. curl/Node/Chrome
전부 동일하고 유선·핫스팟·LTE 전부 동일하며 `www.data.go.kr`은 정상 접속됩니다 — **API 게이트웨이
단독 장애로 확정**되었습니다. 승현님이 재시도 및 고객센터 문의 예정입니다.
따라서 이번 라운드는 **네트워크 호출 없이 코드만 정비**하고, 실호출 검증은 서버 복구 후로 미룹니다.
시드 데이터(`pois` 39건 / `care_facilities` 15건)는 이미 DB에 적재되어 있으므로 코스 생성·매니징
개발과 프론트 연동은 지금 그대로 진행 가능합니다.

- 블로커: TourAPI/의료관광정보/기상청 실호출 (서버 장애, 백엔드가 해결 불가)
- 다음 액션:
  - 백엔드: 위 P1 → P2 → 의료관광 스펙 순서로 `feat/backend-fixes-round2` 브랜치에 작업 후 PR.
    완료분은 이 로그에 append.
  - PM: 라운드 2 PR 재검증. QA 세션 시작 시 이번 P1 4건에 대한 회귀 테스트를 TEST_PLAN에 추가.
  - 승현님: TourAPI 재시도/고객센터 문의, Supabase Google provider 활성화, 카카오맵 JavaScript 키
    발급 + 도메인 등록(프론트 착수 전제).

## [2026-09-07 02:00] 전략기획팀(PM) — 라운드 2 검증 결과 + 라운드 3 수정 지시

라운드 2(`cd50eb6`)를 항목별로 재검증했습니다. **P1 #1·#3, P2 #5~#10, 의료관광 API 스펙 전면 교체는
전부 제대로 반영**됐고, 축제 배치와 중복 알림은 실제로 실행해 확인했습니다(가중치 전부 0 + 개최일이
겹치는 축제 → 앵커·일반 스탑 양쪽으로 배치됨. 수정 전 코드에서는 하나도 배치되지 않던 케이스).
의료관광 쪽은 TourAPI의 소문자 관례를 잘못 복사하지 않고 camelCase로 정확히 분리한 것까지 확인했습니다.
`0001`은 손대지 않고 `0002`로 분리한 마이그레이션 규칙도 지켜졌습니다. **이 항목들은 다시 손대지 마세요.**

브랜치는 `feat/backend-fixes-round3`으로 만들어주세요.

### 이미 손으로 처리된 것 (코드에 반영만 필요)

`0002`의 partial unique index(`where content_id is not null`)는 `ON CONFLICT`의 arbiter로 추론되지
않아 upsert 4종이 전부 42P10으로 실패합니다(로컬 PostgreSQL 16으로 재현 확인). **승현님이 이미
Supabase에서 아래 SQL을 직접 실행해 인덱스를 교체했고, 재시드까지 완료**되었습니다
(현재 DB: `pois` 41건 전부 `content_id` 보유, `care_facilities` 15건 전부 `name_en`/`name_zh` 보유).

```sql
drop index if exists idx_pois_content_id;
drop index if exists idx_care_content_id;
create unique index idx_pois_content_id on pois (content_id);
create unique index idx_care_content_id on care_facilities (content_id);
```

**`0002`는 이미 적용된 파일이므로 수정하지 말고, 위 내용을 `0003_fix_content_id_index.sql`로 커밋해
DB 상태와 마이그레이션 파일을 일치시켜 주세요.** (일반 unique index도 NULL을 서로 다른 값으로
취급하므로 `0002` 주석이 의도한 "NULL 예외"는 술어 없이 그대로 충족됩니다.)

### P1 — `days` 계약 변경 (프론트 착수 전 반영 필요, 최우선)

1. **`days`는 여행 기간 전 일자를 항상 반환하고, 각 날에 `date`를 포함한다** — `API_CONTRACT.md §1`에
   불변식을 명시했습니다(`days.length` === 여행일수, `days[i].day` === `i+1` 연속, `date`는 KST
   `YYYY-MM-DD`). 라운드 2에서 빈 day를 제거하는 방식으로 고쳤는데, 그러면 `day` 번호에 구멍이 생겨
   프론트가 방어 코드를 짜야 하고(3일 여행에 `[{day:3}]`만 오는 케이스 실제 확인) 날짜를
   클라이언트가 재계산하게 되어 KST 버그가 화면단에서 되살아납니다.
   → `scoring.js`의 빈 day 제거(`:166-173`)를 되돌리고, 대신 각 day에 `date`를 채워 전 일자를 반환.
   `validators.js:42`의 `d.stops.length > 0`은 제거하고 구조 검증만 남길 것(`days`가
   `{day, date, stops[]}` 배열인지). 이러면 "200으로 준 코스가 저장 시 400" 불일치도 함께 사라집니다.
   `itinerary_json`을 다루는 모든 경로(저장·부분 재구성·매니징 응답)에 동일 적용.

2. **후보가 0건이면 빈 `days`를 200으로 주지 말고 `NO_CANDIDATE`(404)** — 그 시군 POI가 전부 "여행
   기간 밖 축제"인 경우 `routes/itineraries.js:47,52`의 두 가드를 통과한 뒤 `scoring.js:81-85`에서
   풀이 비어 `days: []`가 200으로 나갑니다(재현 확인). 필터 적용 **후** 후보가 0건이면 `NO_CANDIDATE`로
   막아주세요(§0.1).

### P2

3. **`sync_pois.js`가 TourAPI에서 사라진 POI를 정리하지 않음** — delete+insert → upsert 전환의
   부작용입니다. `:85`의 정리가 `content_id is null` 레거시 로우만 지우므로, 한 번 들어온 뒤 목록에서
   빠진 POI(종료된 축제 등)가 영구히 남아 계속 코스에 배치됩니다. 지역별로 `synced_at < 이번 실행
   시각` 기준 정리(또는 `is_active` 플래그)를 추가해주세요. `sync_medical.js`도 동일.
4. **`monitor.js:54`의 경고가 0건일 때만 발동** — 4스탑 중 3건만 매칭되는 부분 불일치는 여전히 조용히
   넘어갑니다. 요청 id 수와 반환 건수가 다르면 경고하도록 넓혀주세요.
5. **`0002`/`0003` 멱등성** — `add column`/`drop column`에 `if not exists`/`if exists`가 없어 재실행 시
   에러입니다. 사람이 SQL Editor에서 직접 실행하는 방식이라 방어절을 넣어주세요(`0002`는 이미 적용됐으니
   수정하지 말고 `0003` 이후부터 적용).
6. **`sync_medical.js`에 좌표 sanity check 없음** — `sync_pois.js:17-26`의 `isValidKoreaCoord`에 대응하는
   검증이 없어 `"0"` 문자열이 통과하면 `lat:0`이 저장됩니다(1주차 #14와 같은 사고 유형).
7. **`trigger_type`/`condition` 조합 교차검증 없음** — `weather` + `festival_cancelled` 같은 모순 조합이
   통과합니다. 경미하지만 데모 트리거 버튼 오조작 방지 차원에서 조합 검증을 넣어주세요.

### 참고 — 데이터 부족 대응 방향 (PM 판단, 이번 라운드 작업 아님)

TourAPI 데이터가 부족할 경우의 대응으로 웹 크롤링이 거론되었으나 **채택하지 않습니다.** 제안서 3)절
제목이 "데이터 활용 방안 *한국관광공사 OpenAPI 활용 필수"이고 수집 계층을 "TourAPI 동기화 목록정보로
일 1회 자동 동기화"로 정의하고 있어, 크롤링 데이터는 공모전 요건과 어긋납니다. 데이터가 실제로
부족하다고 확인되면 제안서에 이미 명시된 **다른 공공 API**(행안부 공공데이터포털 강원 관련 API —
축제·둘레길·캠핑장, 산림청 등산로 정보 등)를 추가하는 방향으로 갑니다. 다만 **아직 TourAPI 실호출을
한 번도 못 해 데이터 양을 확인조차 못 한 상태**이므로, 서버 복구 후 시군별 실제 건수를 세는 것이 먼저입니다.

### TourAPI 서버 장애 (계속 진행 중)

`apis.data.go.kr`이 여전히 응답하지 않습니다. `www.data.go.kr`은 정상이라 API 게이트웨이 단독 장애로
확정되었습니다. 승현님이 재시도 및 고객센터 문의 예정. 이번 라운드도 네트워크 호출 없이 진행 가능합니다.

- 블로커: TourAPI/의료관광정보/기상청 실호출 (서버 장애, 백엔드 해결 불가)
- 다음 액션:
  - 백엔드: `0003` + P1 2건 → P2 5건 순서로 `feat/backend-fixes-round3` 브랜치 작업 후 PR.
  - 프론트팀: **`API_CONTRACT.md §1`의 `days` 불변식을 반드시 읽고 시작할 것.** 이 계약이 확정되어
    있으므로 백엔드 라운드 3과 병렬로 UI 착수 가능합니다.
  - PM: 라운드 3 재검증. QA 세션 시작 시 T-101(가중치 편차 실측) 우선 처리.
