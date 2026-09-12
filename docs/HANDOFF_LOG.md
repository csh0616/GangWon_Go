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

## [2026-09-07 02:00] 백엔드팀 — 라운드 2 수정 완료 (P1 4건 → P2 6건 → 의료관광 API 전면 교체)

`feat/backend-fixes-round2` 브랜치. `0001_init_schema.sql`은 지시대로 손대지 않았고, 스키마 변경은
전부 `0002_content_id_and_care_i18n.sql`로 새로 작성했습니다. **아직 Supabase에 적용 안 된 상태 —
SQL Editor에서 실행 필요합니다 (아래 블로커 참고).** "라운드 1 검증 통과" 목록도 손대지 않았습니다.

### P1 (완료, 전부 더미데이터로 재현 후 수정 확인)

1. **자유텍스트 없이 생성 시 축제 미배치**: `scoring.js`의 앵커 조건에서 `__score > 0` 게이트 제거
   — "일자 검사만 통과하면 배치"가 PRD 3.5절 규칙이지 "가중치 0이면 배치 금지"가 아니라는 지시대로
   수정. 앵커에 못 든 festival_event도 일반 스탑 풀에서 더는 blanket 제외하지 않고, k-means
   클러스터링 단계에서만 제외(지리적 편향 방지)한 뒤 클러스터→날짜 배정 이후 `isDateEligible()`로
   그 날짜와 맞는지 재검증해서 leftover 재분배까지 반영. 재현 테스트: weights 전부 0으로 생성해도
   09-15/16 축제가 정확히 해당 day에 배치되는 것 확인.
2. **`/generate` 200 → 저장 400 모순**: `buildItineraryDays`가 스탑 0개인 day를 만들지 않도록 수정
   — day 번호는 갱기지 않고(달력 날짜 대응 유지) 스탑 없는 날만 결과 배열에서 제외. 재현 테스트:
   POI 2건·4일 조건에서 예전엔 `[1,1,0,0]`이 나왔는데 이제 `day:1`/`day:2`만 반환되는 것 확인.
3. **중복 알림의 `condition`/`message` 불일치**: `routes/alerts.js`가 요청값 대신 `result.alert.trigger_type`/
   `result.alert.condition`(중복이면 기존 alert 값)을 반환하도록 수정.
4. **POI id 미보존**: `pois.content_id`/`care_facilities.content_id` 추가(`0002_` 마이그레이션,
   partial unique index — NULL은 유니크 제약 예외). `sync_pois.js`/`seed_pois.js`/`sync_medical.js`/
   `seed_care.js` 전부 `content_id` 기준 upsert로 전환 + 해당 region의 NULL-content_id 레거시 로우
   정리 로직 추가. `agent/src/monitor.js`의 `checkRain`이 pois 재조회 결과 0건이면(에러가 아니라
   정상 빈 응답이라 `poiErr`로 안 걸러짐) 경고 로그를 남기도록 추가.

### P2 (완료)

5. `directions.js`의 `filterWithinDuration`을 5개씩 배치로 나눠 순차 처리하도록 수정(동시성 상한,
   429 위험 방지).
6. `.single()` → `.maybeSingle()` + `NOT_FOUND`(404)로 교체 2곳: `itineraries.js` PATCH의
   `new_poi_id` 조회, `alertTrigger.js` `respondToAlert`의 `proposed_poi_id` 조회. 코드베이스 전체
   `.single()` 재점검 결과 나머지 2곳(신규 insert 직후 `.select().single()`)은 항상 정확히 1건이
   반환돼 안전함을 확인.
7. `routes/alerts.js`에 `trigger_type`/`condition` enum 검증 추가(`alertTrigger.js`에서
   `ALLOWED_TRIGGER_TYPES`/`ALLOWED_CONDITIONS` export) — 잘못된 값이 Postgres enum 에러로 500
   나던 것을 400 `INVALID_STRUCTURED_INPUT`으로.
8. `sync_pois.js`/`sync_medical.js`(+ 김에 `ldong_lookup.js`도 동일 패턴)의 catch에 `err.cause`
   로깅 추가.
9. `agent/src/weather.js` 헤더 주석을 kmaGrid 계산 방식 반영해 갱신.
10. 시드 데이터의 "인제 자작나무숲 단풍축제(데모)"/"홍천강 억새축제(데모)" 좌표를 각각 원대리
    자작나무숲/홍천강 실제 POI와 겹치지 않도록 약 300m 분리.

### 의료관광정보 API 스펙 전면 교체 (완료, 지시된 확정 스펙 그대로 구현 — 추측 없음)

- `scripts/sync/medical_client.js` 신설: base URL을 `MdclTursmService`로 정정, `/areaBasedList`를
  시군×언어(ENG/CHS)로 호출, `/detailCommon` 호출 제거, 응답 필드 camelCase(`contentId`/`mapX`/`mapY`)
  그대로 사용(TourAPI KorService2의 소문자 관례와 통일하지 않음 — 지시대로 반대 방향 케이싱 함정 회피).
- `scripts/sync/ldong_lookup.js` 신설: `lDongRegnCd`/`lDongSignguCd`는 API 자체 부여 코드라 추측
  불가(지시 — "추측 금지") — 실제 서비스키로 1회 실행해 값을 확인하는 유틸리티만 준비하고,
  `medical_client.js`의 `REGION_TO_LDONG`은 `null` placeholder로 남겨뒀습니다. **TourAPI/기상청과
  같은 서버 장애로 이 세션에서 실행하지 못했습니다 — 서버 복구 후 1회 실행 필요.**
- `sync_medical.js` 전면 재작성: ENG·CHS 두 번 호출해 `contentId` 기준으로 병합, `content_id` 기준
  upsert, `category`는 지시대로 `hospital` 고정.
- `care_facilities` 스키마 개편(`0002_` 마이그레이션): `name` 컬럼 제거, `name_en`/`name_zh`/
  `address_en`/`address_zh`/`content_id` 추가. `GET /api/care`(`routes/care.js`)도 이 스키마에 맞춰
  select 컬럼 목록을 갱신했습니다 — **이건 지시 목록엔 없었지만, care_facilities 스키마가 바뀐 이상
  이 라우트가 그대로면 컬럼 없음 에러로 깨지는 게 확실해서 같이 고쳤습니다.** `lang` 쿼리 파라미터는
  추가하지 않고 `name_en`/`name_zh` 둘 다 반환 — 프론트가 이미 아는 현재 로케일로 고르면 되므로.
- `seed/care_seed.json` 재작성: `name_en`/`name_zh`/`address_en`/`address_zh`/`content_id`로 전환.
  이름은 읍/면/보건지소/보건의료원의 표준 영문·한자 표기로 기계적 번역했고(예: "인제군보건의료원"
  → "Inje County Public Health Medical Center"/"麟蹄郡保健医疗院"), 주소는 정확한 지번이 없어
  시군/읍면 단위 일반 주소만 넣었습니다 — 실제 API 데이터가 들어오면 그대로 덮어씀.

### 시드 데이터로 확인한 것 (네트워크 호출 없이)

- `buildItineraryDays()`: weights=0에서도 축제 정확한 날짜에 배치, 얇은 POI 풀에서 빈 day 안 생김,
  기존(라운드1) 지리적 클러스터링/앵커 배치/rain 후보 제외 전부 회귀 없음 확인.
  KMA 격자 공식(서울시청 60,127) 회귀 확인.
- `seed/pois_seed.json`(41건)·`care_seed.json`(15건) JSON 유효성 + `content_id` 전부 유니크 확인.
- 모든 변경 파일 `node --check` 통과, require 시점 모듈 와이어링(순환참조/오타 없음) 확인.
- **DB에 실제로 쓰는 것(upsert 동작 자체)은 검증 못 했습니다** — `0002_` 마이그레이션이 아직
  Supabase에 적용 전이라 `content_id` 컬럼이 없는 상태이고, 이 세션은 SQL을 직접 실행할 권한/경로가
  없습니다(1주차에도 동일 — Supabase SQL Editor는 사람이 직접 실행).

- 블로커:
  1. **`0002_content_id_and_care_i18n.sql` 미적용** — Supabase SQL Editor에서 실행 필요. 이게 안 되면
     `content_id` 컬럼이 없어서 이번에 고친 `sync_pois.js`/`seed_pois.js`/`sync_medical.js`/
     `seed_care.js`가 전부 실패합니다(컬럼 없음 에러). **적용 전까지는 라운드1 시드(39건 pois, content_id
     없음)가 그대로 유효하니 코스 생성 데모 자체는 지장 없습니다** — `content_id` 관련 부분만 막힘.
  2. TourAPI/의료관광정보/기상청 서버 장애 지속 — `ldong_lookup.js` 실행, `sync_pois.js`/
     `sync_medical.js` 실동기화, 기상청 실호출 검증 전부 서버 복구 후로 미룸.
  3. API_CONTRACT.md §4 `GET /api/care` 응답 예시가 아직 `name`(단수) 형태로 남아있음 — `name_en`/
     `name_zh`로 반영 필요 (아래 PM 액션).

- 다음 액션:
  - 승현님/PM: `server/db/migrations/0002_content_id_and_care_i18n.sql`을 Supabase SQL Editor에서
    실행. TourAPI/의료관광정보 서버 복구되면 알려주시면 `ldong_lookup.js` 실행 + `sync_pois.js`/
    `sync_medical.js` 실동기화 진행하겠습니다.
  - PM: `docs/API_CONTRACT.md` §4 `GET /api/care` 응답 예시를 `name_en`/`name_zh` 필드로 갱신 부탁드립니다.
  - QA: 이번 P1 4건(축제 무배치/빈 day/중복알림 불일치/POI id 미보존) 회귀 테스트를 TEST_PLAN에
    추가할 때, 0002 마이그레이션 적용 후 실제 재동기화 시나리오까지 포함해주시면 좋겠습니다.

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

## [2026-09-07 09:00] 전략기획팀(PM) — 라운드 3 지시서 (최종본, 이전 02:00 항목 대체·확장)

TourAPI 서버가 복구되어 **실호출 검증을 전부 마쳤습니다.** 그 결과 이전 라운드 3 지시(02:00 항목)에
더해 데이터 전환 작업이 추가됩니다. 브랜치는 `feat/backend-fixes-round3`.

### 실호출로 확정된 사실

- **`serviceKey`가 이중 인코딩되고 있었음 (P0, 아래 1번)** — 세 방식을 비교 실측한 결과:
  - `URLSearchParams`로 조립(현재 코드) → **HTTP 403 `SERVICE_KEY_IS_NOT_REGISTERED_ERROR`**
  - URL에 키를 **그대로 붙임 → HTTP 200, 실데이터 정상 수신**
  - `decodeURIComponent` 후 붙임 → 403
  발급받은 키가 Encoding 키라 `URLSearchParams`가 한 번 더 인코딩(`%2B`→`%252B`)한 것이 원인.
- **TourAPI 실데이터 규모 (`areaBasedList2`, `areaCode=32`)**: 인제 94 / 홍천 46 / 평창 122, **총 262건**.
  콘텐츠타입별 — 인제(관광지 32/문화 8/축제 0/레포츠 7/쇼핑 1/음식 40), 홍천(26/1/0/3/2/10),
  평창(64/1/2/20/0/22). `sigunguCode`(인제 5·홍천 3·평창 7)는 **정확함**(평창 조회 시 평창 데이터 반환 확인).
- **TourAPI 축제 데이터는 사실상 없음**: 대상 3개 시군 축제 콘텐츠타입 합계 2건, `searchFestival2`로
  2026-09 이후 강원 전체 조회 시 0건.
- **전국문화축제표준데이터에는 2026년 강원 축제 28건이 존재**하며 좌표도 포함. 특히
  **평창효석문화제 2026-09-04~09-13 (37.61410983, 128.371554)** 확인. 단 과거 연도 로우는 좌표가
  비어 있는 경우가 많음.
- **시드의 효석문화제 날짜가 틀렸음**: 시드는 2026-09-10~09-19, 실제는 **2026-09-04~09-13**.
  (백엔드가 "실제 일정 미확인"으로 남겨둔 항목 — 이제 확정됨. 다만 아래 3번에 따라 시드 자체를 걷어냄.)

### P0 — 실데이터 진입을 막고 있는 것

1. **`serviceKey` 이중 인코딩 수정 (3개 파일 전부)** — `scripts/sync/tourapi_client.js:25`,
   `scripts/sync/medical_client.js:24`, `agent/src/weather.js:54`가 모두 `serviceKey`를
   `URLSearchParams`에 넣고 있습니다. **`serviceKey`만 URLSearchParams에서 빼고 URL 문자열에 그대로
   붙이세요**(나머지 파라미터는 지금처럼 인코딩). 세 API 모두 같은 포털 키 체계라 동일하게 적용됩니다.
   수정 후 `node sync_pois.js`로 실동기화가 되는 것까지 확인할 것.

### P1 — 데이터 전환

2. **실데이터로 전환하고 시드는 DB에서 제거** (PRD 8장에 방침 반영함) — 실동기화 성공을 확인한 뒤
   `content_id LIKE 'seed-%'` 로우를 `pois`/`care_facilities`에서 삭제하세요. 시드에는 필터 테스트용
   가상 축제("인제 자작나무숲 단풍축제", "홍천강 억새축제")가 들어 있어 실데이터와 섞이면 심사에서
   설명할 수 없습니다. `seed_pois.js`/`seed_care.js` 스크립트는 개발·테스트용으로 남기되 README에
   "데모 DB에는 적재하지 않음"을 명시할 것.
   **전환 직후 반드시 확인**: 리허설 문구용 2곳(**월정사 전나무숲길**, **평창무이예술관**)이 실데이터에
   존재하는지. 없으면 실데이터 중 우천 부적합 야외 스탑 1곳 + 실내 대체 1곳을 골라 후보로 제안해주세요
   (PM이 11.5절/`TEST_PLAN.md`에 반영합니다).
   이 전환으로 라운드 3 02:00 항목의 P2 #3(사라진 POI 정리)에서 "시드 예외 처리"는 불필요해집니다 —
   지역별 `synced_at < 이번 실행 시각` 기준으로 단순하게 정리하면 됩니다.

3. **전국문화축제표준데이터 동기화 추가** (`scripts/sync/sync_festivals.js` 신규, PRD 5장에 반영함)
   - 인증키/엔드포인트는 `.env`의 `FESTIVAL_SERVICE_KEY`/`FESTIVAL_BASE_URL` (승현님이 발급 완료,
     `.env.example`에도 키 이름 추가할 것). **1번과 동일하게 키는 인코딩하지 말고 그대로 붙일 것.**
   - 응답 구조: `body.items.item[]`, 총 1,305건. 지역 파라미터가 없으므로 `numOfRows=1000`으로 2페이지
     받아 전량 수집 후 주소로 필터.
   - 필드 매핑: `fstvlNm`→`name`, `fstvlStartDate`→`event_start_date`, `fstvlEndDate`→`event_end_date`,
     `latitude`→`lat`, `longitude`→`lng`, `rdnmadr`/`lnmadr`→시군 판별(인제/홍천/평창), `tags`는
     `['festival_event']` 고정.
   - **좌표가 빈 로우는 반드시 제외**(과거 연도 상당수가 공란). `sync_pois.js`의 `isValidKoreaCoord`를
     재사용하세요.
   - **`content_id` 생성 규칙 주의**: 이 데이터셋에는 고유 ID 필드가 없습니다. `insttCode` +
     `fstvlNm` + `fstvlStartDate`를 조합한 안정적인 키를 만들어 쓰세요(예: `fest-${insttCode}-${해시}`).
     매 동기화마다 값이 달라지면 upsert가 깨지고 중복이 쌓입니다.
   - 과거 연도 축제가 다수 포함되지만 코스 배치 시 일자 필터에 걸려 자동 제외되므로 무해합니다.

### P1 — `days` 계약 (02:00 항목과 동일, 프론트 착수 전 필요)

4. `days`는 여행 기간 전 일자를 반환하고 각 날에 `date`(KST `YYYY-MM-DD`)를 포함. 빈 날은 `stops: []`.
   `validators.js`의 `d.stops.length > 0` 제거하고 구조 검증만. (`API_CONTRACT.md §1` 불변식 참조)
5. 필터 적용 후 후보가 0건이면 빈 `days`를 200으로 주지 말고 `NO_CANDIDATE`(404).

### P2 (02:00 항목 유지)

6. `0003_fix_content_id_index.sql` 커밋 — 승현님이 이미 Supabase에서 실행한 인덱스 교체(partial unique
   index의 `where` 절 제거)를 파일로 남겨 DB와 일치시킬 것. `0001`/`0002`는 수정 금지.
7. `sync_pois.js`/`sync_medical.js`에 지역별 `synced_at` 기준 정리 추가(2번으로 시드 예외는 불필요).
8. `monitor.js`의 pois 재조회 경고를 "요청 수 ≠ 반환 수"로 확대(현재는 0건일 때만).
9. `0003` 이후 마이그레이션에 `if not exists`/`if exists` 방어절.
10. `sync_medical.js`에 좌표 유효성 검증 추가(`"0"` 문자열이 `lat:0`으로 저장되는 것 방지).
11. `trigger_type`/`condition` 조합 교차검증(`weather`+`festival_cancelled` 같은 모순 조합 차단).

- 블로커: 없음 (서버 복구 완료, 모든 키 확보)
- 다음 액션:
  - 백엔드: P0 → P1 → P2 순서. 실동기화 후 **시군별 최종 건수와 카테고리 분포**를 이 로그에 남겨주세요.
    리허설 장소 2곳 존재 여부도 함께.
  - PM: 라운드 3 재검증. 리허설 장소 확정되면 11.5절/`TEST_PLAN.md` 갱신.
  - 프론트팀: `API_CONTRACT.md §1` `days` 불변식 기준으로 착수 가능(백엔드 라운드 3과 병렬).

## [2026-09-10 23:30] 백엔드팀 — 라운드 3 완료 (P0 실측 + 실데이터 전환 + days 계약 + P1/P2 전체)

`feat/backend-fixes-round3` 브랜치. `0001`/`0002`는 손대지 않았고, 스키마 변경은 `0003_fix_content_id_index.sql`
하나만 새로 작성했습니다. "라운드 2 검증 통과" 목록은 손대지 않았습니다.

### P0 — serviceKey 이중 인코딩 (완료, 실측 검증)

지시대로 `tourapi_client.js`/`medical_client.js`/`agent/src/weather.js` 3곳 전부 `serviceKey`를
`URLSearchParams` 밖으로 빼서 URL에 직접 붙이도록 수정했습니다. `node sync_pois.js`로 실제 데이터가
들어오는 것까지 확인했습니다 (아래 "실데이터 현황" 참고). `sync_festivals.js`(신규)에도 처음부터
같은 패턴을 적용했습니다.

**이 과정에서 발견한 별도의 치명적 버그(지시서엔 없었지만 즉시 수정)**: `serviceKey` 수정 후 실호출을
해보니 **`sigunguCode`가 전부 틀려 있었습니다.** `tourapi_client.js`의 `REGION_TO_SIGUNGU`(인제=5/
홍천=3/평창=7)는 라운드1부터 "공개 자료 기준 추정치"로 남아있던 값인데, `areaCode2?areaCode=32`를
직접 호출해 확인한 결과 **인제=5는 실제로 속초시, 홍천=3은 동해시, 평창=7은 양양군**이었습니다 —
"평창" 89건을 동기화했더니 대관령/진부/봉평/월정사 등 평창 지명이 단 하나도 없고 양양송이축제/
낙산사/남애항처럼 양양 지명만 나온 것으로 처음 알아챘습니다. `areaCode2` 응답 전체(18개 시군)로
올바른 값(**인제=10, 홍천=16, 평창=15**)을 확정해 교정했고, 재동기화로 잘못된 데이터는 자동
정리됐습니다(아래 synced_at 기준 정리 로직). PM이 라운드2까지 "sigunguCode 정확함"이라고 검증한
기록이 있는데, 그건 실호출 없이 문서상 재확인이었을 것으로 보입니다 — 이번이 최초의 실제 데이터
검증입니다.

### P1 — 데이터 전환 (완료)

- **실데이터 전환 + 시드 제거**: `sync_pois.js` 재동기화(올바른 sigunguCode로) 후 `pois`의 시드
  41건은 synced_at 기준 정리 로직에 의해 **자동으로 전부 제거**되었습니다(시드가 이번 실행보다
  오래된 걸로 처리됨 — 별도 명령 불필요). `care_facilities`는 아래 "실데이터 현황"에 설명한 이유로
  시드를 유지했습니다.
- **`sync_festivals.js` 신설**: 전국문화축제표준데이터 실동기화 완료. 응답 최상위가 `response.body`가
  아니라 `body` 바로 아래라는 것, 파라미터가 `type=json`(TourAPI의 `_type`과 다름)이라는 것 전부
  실측으로 확인 후 반영했습니다. `content_id`는 지시대로 `insttCode`+축제명+시작일 해시로 결정론적
  생성. `geo_validate.js`를 신설해 `isValidKoreaCoord`를 `sync_pois.js`에서 뽑아 `sync_medical.js`/
  `sync_festivals.js`가 공유하도록 했습니다.
- **리허설 장소 2곳**: 실데이터에 **둘 다 없습니다** (아래 상세).

### P1 — `days` 계약 (완료)

- `scoring.js`: 라운드2에서 넣은 "빈 day 제거" 로직을 되돌리고, `days.length` === 여행일수,
  `day`는 1부터 연속, 각 day에 `date`(KST YYYY-MM-DD) 포함하도록 수정. 더미데이터로 4일 요청 시
  정확히 4개 day가 순서대로(빈 day는 `stops:[]`로) 반환되는 것 확인.
- `validators.js`: `d.stops.length > 0` 요구 제거, 대신 `d.date`가 유효한 날짜 문자열인지 검증
  추가(구조만 검증, 빈 stops는 통과).
- `itineraries.js`: 필터 적용 후 **전체** 스탑 합계가 0일 때만 `NO_CANDIDATE`(404) — 일부 day만
  비는 정상 케이스와 구분.
- 실제 Supabase 데이터로 end-to-end 확인: 평창 지역 실데이터로 축제 날짜(09-09~09-11 여행, 효석문화제
  09-04~09-13)를 겹치게 요청하니 `평창효석문화제`가 day 1에 정확히 앵커로 배치되고, 근처 스탑으로
  "메밀꽃사랑"/"까페지수인봉평"(전부 실제 봉평면 소재 — 이효석의 고향이자 축제 무대)이 뽑혔습니다.

### P2 (완료)

6. `0003_fix_content_id_index.sql` 커밋 — 승현님이 이미 Supabase에서 실행한 내용(partial unique
   index → 일반 unique index)을 파일로 기록. `create unique index if not exists` 등 방어절 포함.
7. `sync_pois.js`/`sync_medical.js`/`sync_festivals.js` 전부 지역별 `synced_at < 이번 실행 시각`
   기준 정리로 통일 — 목록에서 사라진 POI(폐업/종료 축제 등)가 이제 자동 정리됩니다. **주의**:
   `seed_pois.js`는 의도적으로 이 패턴을 쓰지 않습니다(실수로 실데이터 위에 돌리면 실데이터가
   전부 삭제되는 걸 막기 위함, 파일 내 주석 참고).
8. `monitor.js`의 pois 재조회 경고를 "요청 id 수 ≠ 반환 건수"로 확대. 덤으로 `days` 계약 변경과의
   상호작용 버그 하나를 미리 잡았습니다 — `stops:[]`인 날이 이제 정상 상태인데, 예전 코드면 이 날에
   대해서도 `checkRain`이 "poiRows 0건" 경고를 오탐으로 쏟아냈을 것이라 `scanAndTrigger`에서 빈
   day는 아예 건너뛰도록 가드를 추가했습니다.
9. `0003`에 `if exists`/`if not exists` 방어절 적용.
10. `sync_medical.js`에 `geo_validate.js`의 `isValidKoreaCoord` 적용 — 좌표 있는데 범위 밖이면 그
    row만 제외(좌표 자체가 없는 row는 주소 텍스트가 유효하니 null로 유지).
11. `alertTrigger.js`에 `VALID_TRIGGER_CONDITION_PAIRS` 추가, `routes/alerts.js`에서 교차검증 —
    `weather`는 `rain`만, `traffic`은 `traffic`만, `festival`은 `festival_cancelled`만 허용.

### 실데이터 현황 (요청하신 3가지)

**1) 시군별 최종 POI 건수와 카테고리(7종) 분포** (2026-09-10 실측, `pois` 테이블 — 시드 0건, 전부 실데이터)

| 시군 | 합계 | nature_hiking | onsen_wellness | culture_history | food_local | festival_event | shopping | leisure_sports |
|---|---|---|---|---|---|---|---|---|
| 인제 | 64 | 19 | 1 | 12 | 4 | 3 | 1 | 24 |
| 홍천 | 80 | 8 | 9 | 21 | 8 | 2 | 1 | 31 |
| 평창 | 85 | 9 | 0 | 4 | 65 | 2 | 1 | 4 |
| **합계** | **229** | | | | | | | |

`shopping`은 PM이 우려하신 대로 여전히 3개 시군 전부 1건씩으로 거의 비어 있습니다(라운드3 지시서의
"인제 1/홍천 2/평창 0"과 수치가 다른데, 그건 `sigunguCode` 버그가 있던 시점의 잘못된 지역 데이터
기준이었기 때문 — 지금 값이 올바른 인제/홍천/평창 기준입니다). `shopping` 위주 요청 시 스코어링이
다른 카테고리로 자연스럽게 채우는지는 여전히 QA 확인 필요합니다. 평창은 `food_local`(65건, 대부분
식당)이 압도적으로 많고 `culture_history`/`onsen_wellness`가 적어 편중이 더 심합니다 — 활동 강도
`high`로 문화/온천 위주 요청 시 스탑이 빈약할 수 있어 QA 확인 권장.

**2) 리허설 문구용 2곳 실존 여부**: `월정사 전나무숲길`, `평창무이예술관` **둘 다 실데이터에 없습니다**
(이름/유사명 검색 전부 0건). 대체 후보를 제안합니다 — 둘 다 실제 평창 대관령 일대 실데이터이고
서로 약 8km 거리입니다:
- **야외(우천 시 교체 대상)**: `국립한국자생식물원` (nature_hiking, 대관령면, 37.707/128.615)
- **실내(대체 후보)**: `대관령 스키 역사관` (culture_history, 대관령면, 37.663/128.682)

PM 확인 후 11.5절/`TEST_PLAN.md`에 반영 부탁드립니다.

**3) 축제 동기화 결과** — TourAPI(contentTypeId=15) + 전국문화축제표준데이터(`sync_festivals.js`) 합산:

| 시군 | 축제명 | 출처 | 기간 |
|---|---|---|---|
| 인제 | 제42회 합강문화제 | 전국문화축제표준데이터 | 2024-10-11~2024-10-13 |
| 인제 | 2024 캠프레이크 페스티벌 | 전국문화축제표준데이터 | 2024-06-14~2024-06-23 |
| 인제 | 제6회 인제가을꽃축제 | 전국문화축제표준데이터 | 2024-09-28~2024-10-20 |
| 홍천 | 홍천 사과축제 | TourAPI | 2025-10-30~2025-11-02 |
| 홍천 | 홍천강 꽁꽁축제 | TourAPI | 2026-01-09~2026-01-25 |
| 평창 | 평창효석문화제 | 전국문화축제표준데이터 | **2026-09-04~2026-09-13** |
| 평창 | 평창송어축제 | 전국문화축제표준데이터 | 2026-01-09~2026-02-09 |

**평창효석문화제 2026-09-04~09-13가 공공데이터로 확정**됐습니다(라운드3 지시서 기재값과 일치).
과거 연도 축제(2024/2025)도 그대로 적재했는데, 지시대로 코스 배치 시 일자 필터에 걸려 자동
제외되니 무해합니다 — 실제로 위 P1 테스트에서 2026-09 기간 요청 시 효석문화제만 앵커로 잡히는 것
확인했습니다. **홍천 전국문화축제표준데이터 6건(산나물/찰옥수수/맥주/인삼한우/사과/꽁꽁축제)은
전부 좌표가 비어 있어 제외**됐지만, 다행히 사과축제·꽁꽁축제는 TourAPI 쪽에 좌표 포함 데이터가
있어 홍천도 축제 앵커 시연이 가능합니다.

### 추가로 발견한 것 (지시서엔 없었음)

- **`care_facilities`는 실데이터로 전환 못 함** — `sync_medical.js`를 인제/홍천/평창에 대해
  실행하면 **3개 시군 전부 0건**입니다. 원인 진단: 강원도 전체(`lDongRegnCd=51`, 시군 필터 없이)로
  조회해도 등록된 의료관광 인증 시설이 원주시 2곳(세브란스기독병원, 성지병원)뿐이었습니다 — API/
  파라미터 문제가 아니라 이 지역엔 의료관광 인증 시설 자체가 없는 것으로 보입니다. `ldong_lookup.js`도
  `langDivCd` 파라미터가 없으면 `NO_MANDATORY_REQUEST_PARAMETERS_ERROR1`가 나는 걸 발견해 고쳤고,
  실행해서 나온 진짜 코드(`lDongRegnCd=51`, 인제=810/홍천=720/평창=760)로 `medical_client.js`를
  채웠습니다. **`care_facilities` 시드는 그대로 유지하기로 판단했습니다** — SOS/의료 안내는 로그인
  여부와 무관하게 항상 접근 가능해야 하는 안전 기능이라(PRD 2.1절), 대체할 실데이터가 없는 상황에서
  시드를 지우면 이 기능이 완전히 비어버립니다. PRD 8장의 "실데이터 확보 시 시드 제거" 원칙과
  상충하는 판단이라 **PM 확인 요청**드립니다 (`seed_care.js` 파일 내 주석에도 남겨뒀습니다).
- **기상청 API는 serviceKey를 고쳤는데도 여전히 403** — `SERVICE_KEY_IS_NOT_REGISTERED_ERROR`가
  그대로 납니다. TourAPI/의료관광정보/전국문화축제표준데이터는 전부 같은 인코딩 수정으로 성공했기
  때문에, 이건 인코딩 문제가 아니라 **이 `KMA_SERVICE_KEY`가 단기예보 API 상품에 대해
  활용신청/승인이 안 된 상태**일 가능성이 높습니다. 공공데이터포털에서 해당 상품의 활용신청 상태
  확인 부탁드립니다.

- 블로커:
  1. **`care_facilities` 실데이터 없음** — 위 설명대로 시드 유지 여부 PM 확인 필요.
  2. **기상청 API 403 지속** — 활용신청 상태 확인 필요 (승현님).
  3. `shopping` 카테고리 편중(3개 시군 전부 1건) — QA 확인 필요(에러 아닌 정상 폴백인지).
- 다음 액션:
  - 승현님: 기상청 API 활용신청 상태 확인. `care_facilities` 실데이터 부재에 대한 판단(시드 유지
    동의 또는 다른 방향 지시).
  - PM: 리허설 장소 대체안(국립한국자생식물원 / 대관령 스키 역사관) 확인 후 11.5절/`TEST_PLAN.md` 반영.
  - QA: `shopping`/`onsen_wellness`/`culture_history` 편중 시군에서 활동강도 `high` + 해당 카테고리
    위주 요청 시 스코어링이 에러 없이 다른 카테고리로 자연 폴백하는지 확인.

---

## [2026-09-10 15:30] PM (전략기획팀) — 라운드 3 검수 + 심사 방식 확정 + 마이페이지 신규

라운드 3 보고 잘 받았습니다. 먼저 정정할 것부터.

### 0. `sigunguCode` 버그 — PM 검증 실패였습니다

지적이 맞습니다. 라운드 2까지 제가 "sigunguCode 정확함"이라고 적은 건 **실호출 없이 문서만 대조한
것**이었고, 그 결과 인제=속초 / 홍천=동해 / 평창=양양 데이터를 사흘간 정상으로 착각했습니다.
`areaCode2` 실호출로 잡아낸 건 제 검증이 못 한 일이고, "평창 89건에 평창 지명이 하나도 없다"를
이상하게 여긴 판단이 정확했습니다. **앞으로 코드값·엔드포인트 검증은 "문서에 그렇게 적혀 있다"를
근거로 쓰지 않겠습니다.**

이에 따라 PRD 8장의 262건(인제 94/홍천 46/평창 122)은 무효 수치로 표시하고, 보고해주신 실측
분포표(총 229건)로 교체했습니다.

### 1. 즉답이 필요한 블로커 3건

**(a) `care_facilities` — 시드 유지가 아니라 데이터 소스를 교체합니다**

"안전 기능이 비면 안 된다"는 판단에는 동의합니다. 다만 **존재 여부가 검증되지 않은 의료시설을 안전
기능에 표시하는 건 비어 있는 것보다 나쁩니다.** 실제로 찾아갔는데 없으면 그게 사고입니다.

진단해주신 내용을 보면 이건 API 문제가 아니라 **데이터셋 선택 실수**입니다 — `MdclTursmService`는
외국인 환자 유치용 *의료관광 인증 시설* 목록이라 대형병원 위주이고, 군 단위 지역엔 등록 대상이
없습니다. 우리가 필요한 건 "여행 중 아플 때 갈 수 있는 가까운 곳"이므로 아래로 교체합니다.

| 데이터셋 | 용도 |
|---|---|
| 국립중앙의료원 전국 응급의료기관 조회 서비스 (`B552657/ErmctInfoInqireService`) | 응급실. 실좌표 + 응급실 직통번호 |
| 전국보건기관표준데이터 (행안부 표준데이터) | 보건소·보건지소·보건진료소 — 군 단위의 실질적 1차 의료기관 |

두 번째는 방금 성공적으로 붙이신 전국문화축제표준데이터와 **완전히 같은 패턴**(`type=json`,
`body.items.item[]`, 주소로 시군 필터, 좌표 빈 로우 제외)이라 `sync_festivals.js`를 복제하는 수준입니다.

> **다국어 처리 — 번역하지 마세요 (확정)**: 두 데이터셋 다 한국어 명칭만 줍니다. `care_facilities`에
> `name_ko`/`address_ko`를 추가하고 **한국어 명칭을 주 표시값으로 씁니다.** 영문 번역을 만들지 않는
> 이유는, 응급 상황에서 외국인이 택시 기사나 행인에게 보여줘야 하는 건 한국어 상호이지 영어 번역이
> 아니기 때문입니다. 시설 종류(`emergency_room`/`health_center`/`health_subcenter`/`hospital`)와 UI
> 문구만 다국어 키로 처리하고, `name_en`/`name_zh`는 값이 있을 때만 보조 표기합니다.
> `phone`이 `null`이면 전화 버튼 자체를 렌더링하지 않습니다 — 틀린 응급연락처보다는 없는 게 낫습니다.
> (`API_CONTRACT.md` §4 응답 스키마 갱신 완료)

`sync_medical.js`와 실측한 `lDongRegnCd`/`langDivCd` 지식은 버리지 말고 보조 소스로 유지해주세요
(원주 2곳처럼 `name_en`이 있는 시설은 그 값을 씁니다).

**(b) 기상청 403 — 승현님이 활용신청 상태를 확인합니다**

진단에 동의합니다. 같은 인코딩 수정으로 다른 3개 API가 전부 성공했으니 키 상품 승인 문제가 맞습니다.

> **다만 이게 심사를 막지는 않습니다.** 심사 방식이 아래 2번처럼 확정되면서, 심사위원이 보는 경로는
> `POST /api/alerts/trigger`(condition을 직접 지정)입니다. **기상청 API가 죽어 있어도 이 경로는
> 정상 동작합니다.** 기상청은 자동 스캔(`monitor.js`)에만 필요하므로 우선순위를 P1로 내립니다.
> 복구되면 좋고, 안 되면 자동 스캔만 조용히 무동작입니다.

**(c) `shopping` 편중 — 더 큰 문제가 따로 있습니다 (P0 조사)**

`shopping` 1건씩은 QA 확인 사항이 맞습니다. 그런데 분포표를 보다 **평창이 더 심각합니다.**

```
평창 85건 = food_local 65 (76%) / nature_hiking 9 / culture_history 4 / onsen_wellness 0
```

평창에 월정사·오대산·대관령 양떼목장·삼양목장이 있는데 `nature_hiking`이 9건일 수는 없습니다.
**콘텐츠타입 커버리지(12 관광지 / 14 문화시설 / 28 레포츠 등)를 전부 조회하고 있는지,
`numOfRows`/`pageNo` 페이지네이션에서 잘리고 있지 않은지 확인 부탁드립니다.** 지금 상태로 평창 코스를
만들면 하루 스탑 대부분이 식당이 됩니다. 이건 QA 이전에 동기화 커버리지 문제로 보입니다.

부수 효과도 있습니다 — 평창 `onsen_wellness` 0 + `culture_history` 4라, rain 트리거의 실내 대체
후보가 4건에 전부 의존합니다. 그 4건이 이미 코스에 들어가 있으면 `NO_CANDIDATE`로 떨어집니다.

### 2. 심사 방식 확정 — 무대 시연 없음, 심사위원 URL 직접 접속

**(a) 리허설 장소 2곳 확정 항목을 폐기합니다** — 제안해주신 국립한국자생식물원 / 대관령 스키 역사관
조합은 확인했고 적절합니다만, **더 이상 고정할 필요가 없어졌습니다.** 심사위원이 어떤 시군·날짜·취향을
넣을지 통제할 수 없으므로, 고정하는 건 문구 템플릿뿐이고 장소명은 런타임에 실데이터로 채워집니다.
그 두 곳은 QA 스모크 테스트용 예시로만 쓰시면 됩니다.

**(b) `POST /api/alerts/trigger`의 성격이 바뀝니다 (PRD 3.6절)** — "데모 전용 강제 트리거 버튼" →
**사용자에게 노출되는 정식 기능 "지금 코스 점검하기"**. 심사위원 접속 시점에 비가 오지 않으면 자동
스캔은 아무 알림도 만들지 않고, 그러면 Must-have인 실시간 매니징이 화면에 존재조차 하지 않습니다.
스코어링 로직과 `alerts` row가 자동 트리거와 동일하므로 기능을 가장하는 게 아닙니다.
**UI 문구에 "테스트"/"강제"/"디버그" 표현 금지.**

**(c) PRD 11.5절 / `TEST_PLAN.md` 5장을 "심사위원 첫 접속 동선" 7단계로 교체**했습니다. 점검 방법도
바꿨습니다 — 이 프로젝트를 만들지 않은 사람에게 URL만 주고 설명 없이 써보게 하고, 막히는 지점을
결함으로 기록합니다.

**(d) 라이브 API 폴백(PRD 6장)을 "여유 있으면"에서 3주차 필수 검증으로 올렸습니다.**

### 3. 마이페이지 — 신규 확정 (백엔드 작업)

PRD 2.1절 Must-have에 추가했습니다. **`itineraries.status`의 `completed`/`cancelled`가 이미 설계돼
있어서 새 개념이 아니라 기존 상태 모델을 노출하는 것뿐입니다.** 그리고 지금 구조에는 결함이 있습니다 —
로그인 사용자가 재방문했을 때 자기 코스로 돌아갈 경로가 0개입니다(`GET /api/itineraries/:id`는 id를
알아야 부르는 API인데, 랜딩은 "다시 로그인하면 저장한 코스를 이어볼 수 있어요"를 안내하고 있습니다).

| 엔드포인트 | 요지 |
|---|---|
| `GET /api/itineraries` | 목록. `itinerary_json` 전체 대신 `stop_count`만. `cancelled` 제외. `start_date DESC` |
| `DELETE /api/itineraries/:id` | 소프트 삭제 — `status='cancelled'` UPDATE. row와 `alerts` 로그 유지. 멱등 |

> **P0 — IDOR**: 둘 다 service_role 클라이언트라 **RLS가 안 걸립니다.** 반드시 토큰에서 검증한
> `auth.uid()`로 `where user_id = :uid`. 라운드 1에서 `GET /api/itineraries/:id`에 대해 지적했던
> 것과 같은 패턴입니다. QA T-012로 계정 2개 교차 검증합니다.

> **`completed` 상태 전환 배치를 만들지 마세요.** `monitor.js`가 이미
> `status='active' AND 오늘이 start_date~end_date 사이`만 스캔하므로 여행이 끝나면 감시는 조건식만으로
> 멈춥니다. 목록의 진행/지난 구분도 프론트가 `end_date`로 계산합니다. **이번 데모에서 `completed`는
> 실제로 기록되지 않는 값입니다.**

### 4. 그 외 검수 통과

`days` 계약(빈 day `stops:[]` 유지, `NO_CANDIDATE`는 전체 합계 0일 때만), `0003` 방어절,
`synced_at` 기준 정리 통일과 `seed_pois.js`를 의도적으로 제외한 판단, `VALID_TRIGGER_CONDITION_PAIRS`
교차검증 — 전부 지시대로입니다. 특히 **빈 day에서 `checkRain`이 오탐 경고를 쏟을 것을 미리 잡아
`scanAndTrigger`에 가드를 넣은 것**은 지시서에 없던 건인데 정확한 판단이었습니다.
축제 앵커 배치 end-to-end 확인(효석문화제 2026-09-04~09-13 실데이터 확정)도 확인했습니다.

- 블로커: 없음 (기상청은 P1로 강등).
- 다음 액션:
  - **백엔드 (우선순위 순)**: ① 평창 콘텐츠타입 커버리지/페이지네이션 조사(1-c) ② `care_facilities`
    데이터 소스 교체 + `name_ko`/`address_ko` 컬럼(1-a) ③ `GET /api/itineraries` +
    `DELETE /api/itineraries/:id`(3, IDOR 스코핑 필수).
  - **승현님**: 기상청 API 활용신청 상태 확인(급하지 않음), 응급의료기관·보건기관 표준데이터 활용신청.
  - **QA**: T-101(LLM 가중치 편차 실측 — 1주차 항목인데 아직 미착수) 최우선. 이후 T-012·T-015.
  - **프론트**: `days` 불변식 + 마이페이지 2개 엔드포인트 기준으로 착수 가능.
  - **PM**: UI 아트보드 검수는 승현님 판단 대기 — 요청 시에만 재개.

---

## [2026-09-10 17:00] PM (전략기획팀) — UI 아트보드 검수 결과: 계약 누락 4건 + 다중 시군 지원

프론트 착수 직전 UI 아트보드(21장)를 **계약과 대조**해 검수했습니다. 화면 구성이 아니라 **화면이
요구하는 데이터가 계약에 있는지**를 봤고, 여기서 P0 4건이 나왔습니다. 이 상태로 프론트가 착수하면
스탑 카드의 절반이 빈 채로 렌더링됩니다.

### 1. 계약 누락 4건 — `API_CONTRACT.md §1` 갱신 완료

기존 스탑 스키마는 `{poi_id, name, category, lat, lng, order}` 뿐이었는데, 아트보드는 스탑마다
설명·이동시간·실내여부를 그리고 있었습니다.

| 신규 필드 | 내용 | 구현 방식 |
|---|---|---|
| `stops[].blurb` | 스탑 한 줄 설명 `{ko,en,zh}` | **기존 narration LLM 호출에 통합** — 추가 호출·지연 0 |
| `stops[].travel_from_prev` | `{mode, minutes}`, 그날 첫 스탑은 `null` | 카카오모빌리티 Directions (PRD 5장, 이미 계획됨) |
| `narration.ko` | 한국어 코스 요약 | 위와 같은 호출. **기존 스키마에 `ko`가 없어 한국어 화면 요약문에 출처가 없었음** |
| `stops[].is_indoor` | 실내 여부 | `pois.is_indoor` 컬럼 신설, 동기화 시 콘텐츠타입+카테고리 매핑으로 채움 |

> **`blurb` 생성 시 반드시 지킬 것**: 프롬프트에 **장소명·카테고리·시군만** 넘깁니다. 영업시간·가격·
> 연락처·휴무일처럼 검증 불가능하고 변하는 정보는 넘기지도, 생성하게 하지도 마세요 — 할루시네이션이
> 그대로 화면에 나갑니다. 40자 상한, 권유·홍보 문구 금지. `blurbs[]`의 `poi_id`가 실제 코스 스탑과
> 매칭되지 않으면 **그 항목은 버립니다**(LLM이 지어낸 장소가 코스에 끼어드는 것 차단).
> LLM/카카오모빌리티 실패 시 각각 `null`로 두고 코스는 정상 반환 — 프론트는 그 줄을 아예 그리지
> 않습니다. 추정값을 지어내지 않습니다.

> **`is_indoor`는 표시 전용입니다.** rain 트리거의 후보 제외 판정은 지금처럼 카테고리 기준
> (`nature_hiking`/`leisure_sports`/`festival_event`)을 유지하세요. 판정 근거를 둘로 나누면
> 화면에 보이는 이유와 실제 로직이 어긋납니다.

### 2. 다중 시군 지원 — 신규 (승현님 결정)

"여행 기간을 먼저 정하고 여러 시군에 걸쳐 일정을 짜고 싶다"는 요구가 들어왔고, 검토 결과 **가능하고
변경 폭도 작습니다.** `region_codes`는 원래부터 배열이었고 막고 있던 건 검증뿐이었습니다.

**채택 방식 — 시군을 날짜에 배정 (좌표 클러스터링 아님)**

```
3일 + 인제·홍천·평창  →  1일차 인제 / 2일차 홍천 / 3일차 평창
4일 + 홍천·평창       →  1~2일차 홍천 / 3~4일차 평창
```

1. 중복 제거 후 **위도 내림차순**(북→남: 인제 38.07 → 홍천 37.70 → 평창 37.37) 정렬
2. 여행 일수를 시군 수로 나눠 **연속 날짜 블록** 배분. 나머지는 앞쪽 시군부터 하루씩 더
3. `region_codes.length > 여행 일수`면 400 `INVALID_STRUCTURED_INPUT`
4. **그 다음부터는 각 날짜가 배정된 단일 시군만 보고 기존 3단계 이하를 그대로 수행**

> **전체 POI를 한 풀에 넣고 k-means를 돌리지 마세요.** 인제↔평창이 약 80km라 좌표만 보면
> 오전 평창·오후 인제 같은 날이 나옵니다. 날짜 배정 방식은 **스코어링·클러스터링·2-opt 로직을
> 하나도 바꾸지 않습니다** — 각 날짜에 대해 지금과 똑같은 계산을 돌릴 뿐입니다.
> 응답에 `days[].region_code`가 추가됩니다(항상 단일 값).
>
> **부작용(수용)**: 축제 앵커는 그 축제가 속한 시군에 배정된 날에만 배치됩니다. 효석문화제는
> 평창 날짜 블록이 9/4~9/13과 겹칠 때만 앵커가 됩니다. 단일 시군 요청은 지금과 동일 동작.

부수 효과로 **PRD 11.2절 프레이밍이 화면으로 증명됩니다** — "3개 시군만 된다"가 아니라 "3개 시군을
가로지르는 코스가 실제로 만들어진다"를 보여줄 수 있고, 배정 로직은 시군 개수에 무관하므로 "데이터만
채우면 18개"라는 설명이 뒷받침됩니다.

### 3. 여행 케어 — 병행 표기 확정 (승현님 결정)

`name_ko`만 쓰는 대신 **한국어와 사용자 언어를 항상 함께** 표시합니다. 한국어는 택시 기사·행인에게
보여주기 위해, 자국어는 어디로 가는 곳인지 본인이 알기 위해 — 둘 중 하나만으로는 안 됩니다.

`name_en`/`name_zh`는 **배치 동기화 시점에 1회 생성**합니다(런타임 번역 아님, 시설 수십 건 규모).
**시설 종류 접미사(보건소/보건지소/보건진료소/응급실)는 LLM이 아니라 고정 사전으로 강제 매핑**하고
지명만 생성하세요 — 안전 기능이라 "보건지소"가 clinic과 health center로 들쭉날쭉하면 안 됩니다.
생성 실패 시 그 언어만 `null`, `name_ko`는 항상 표시. `phone`/`lat`/`lng`/`address_ko`는 원본 그대로.

### 4. QA 케이스 추가 (`TEST_PLAN.md` 1장)

- T-016 다중 시군 날짜 배정 (한 날의 스탑이 전부 같은 시군인지)
- T-017 **이동시간 회귀 (P0)** — 단일 시군 3일 vs 3시군 3일의 하루 이동시간 합계 비교.
  다중 시군 때 튀면 날짜 배정이 아니라 좌표 클러스터링으로 동작 중이라는 뜻
- T-018 `region_codes.length > 일수` 차단, 중복 값 처리
- T-019 `blurb`/`travel_from_prev` 폴백 (null일 때 줄을 아예 안 그리는지)
- T-020 **`blurb` 내용 안전성** — 영업시간·가격·연락처 같은 검증 불가 정보가 없는지 육안 검사
- T-021 케어 병행 표기 (둘 중 하나만 나오면 실패)

- 블로커: 없음.
- 다음 액션:
  - **백엔드 (우선순위 순)**: ① 평창 콘텐츠타입 커버리지/페이지네이션 조사(이전 항목 1-c — 여전히
    최우선, `food_local` 76%면 코스가 식당 도배가 됩니다) ② 스탑 4종 필드(`blurb`/`travel_from_prev`/
    `narration.ko`/`is_indoor`) ③ 다중 시군 날짜 배정 ④ `care_facilities` 소스 교체 + 병행 표기
    ⑤ 마이페이지 2개 엔드포인트(IDOR 스코핑 필수).
  - **프론트**: **위 ②③이 나오기 전까지 스탑 카드 확정 금지.** 화면 골격·라우팅·지도·언어 전환은
    지금 착수 가능합니다.
  - **QA**: T-101(LLM 가중치 편차 실측 — 1주차 항목, 아직 미착수) 최우선. 이후 T-017·T-020.
  - **PM**: 아트보드 수정 프롬프트(계약 반영본 기준) 대기 — 승현님 요청 시 제공.

---

## [2026-09-10 18:30] PM (전략기획팀) — 장소명 다국어 확정 + 프론트 필수 상태 명세

프론트 착수 직전 마지막 정리입니다. 아트보드를 **사용자 흐름 관점**으로 다시 보면서 P0 하나와
아트보드에 화면이 없는 상태 여러 개를 찾았습니다.

### 1. 장소명 다국어 — `pois.name_en` / `pois.name_zh` 신설 (P0)

`ResultEN`/`ResultZH` 아트보드는 영문·중문 장소명을 보여주는데 **`pois`에는 한국어 `name` 하나뿐**
이었습니다. 다국어 정밀 지도가 Must-have인데 **언어를 바꿔도 스탑 카드와 지도 마커가 전부 한국어로
남는** 상태였습니다.

**다국어관광정보서비스(`EngService2`/`ChsService2`)는 검토 후 폐기했습니다** — 승현님이 확인한 결과
국문 대비 커버리지가 20% 미만이라, 어떤 장소는 영어로 어떤 장소는 한국어로 나오는 더 나쁜 화면이
됩니다.

**확정 방식: 배치 동기화 시 LLM 1회 생성 + 병행 표기**

- **런타임 번역 금지.** 같은 장소가 요청마다 다른 영문명으로 보이면 안 되고, 3초 예산에 번역 호출을
  얹을 수도 없습니다. `sync_pois.js`에서 `name_en`/`name_zh`를 채웁니다.
- **표기 관례 고정**: 고유명사는 국립국어원 로마자 표기법, 보통명사는 의미 번역
  (`월정사 전나무숲길` → `Woljeongsa Fir Forest Trail`). 중국어는 한자 지명이면 한자, 아니면 음역.
- **시설·지형 접미사는 LLM이 아니라 고정 사전으로 강제 매핑**하세요 — 사/寺(Temple), 계곡(Valley),
  폭포(Falls), 시장(Market), 박물관(Museum), 자연휴양림(Recreational Forest), 목장(Ranch) 등.
  같은 접미사가 장소마다 다르게 번역되면 목록이 일관성을 잃습니다. `care_facilities`와 같은 원칙.
- **`name`(한국어)은 절대 덮어쓰지 마세요.** 병행 표기의 기준값이자 오역 시 최후 방어선입니다.

**계약 변경 ⚠**: `stops[].name`이 **문자열 → `{ko, en, zh}` 객체**가 됐습니다.
`candidate_poi`, `regenerate-stop` 후보도 같은 형태입니다.

### 2. `blurb`/`narration`은 3개 언어를 전부 생성합니다 (수정)

직전 라운드에서 "요청 `lang`과 `ko`만 채운다"고 했는데 **틀렸습니다.** 그러면 사용자가 화면에서 언어를
전환했을 때 설명과 요약이 전부 사라집니다 — 이미 만든 코스를 위해 LLM을 다시 부를 수는 없으니까요.
40자 × 스탑 수 × 3언어라 출력량이 작아 3초 예산에 영향 없습니다.

### 3. `lang` 파라미터에 `ko`를 추가했습니다

기존 계약이 `en`/`zh`만 받았는데, 서비스 기본 언어가 한국어이고 한국어 화면도 서버가 만든 문구를
그대로 씁니다. PRD 2.3절의 "영/중 2개만 지원"은 **한국어 외 추가 언어가 2개**라는 뜻입니다.

### 4. 지도 언어 — 확인 항목 (프론트팀)

**카카오맵 JS SDK가 타일 언어 옵션을 제공하는지 실측 확인이 필요합니다.** 착수 초반에 확인하고
결과를 이 로그에 남겨주세요. 지원하지 않아도 **지도를 교체하지 않습니다** — 스탑 마커는 우리가 그리는
커스텀 오버레이라 마커 라벨은 선택 언어로 표시할 수 있고, 사용자가 실제로 읽는 것도 마커 쪽입니다.
최악의 경우 배경 타일만 한국어로 남으며 수용 가능합니다. (지도 SDK 교체는 PRD 3장 기술 스택 변경이라
PM 확인 없이 진행 금지)

### 5. 아트보드에 화면이 없는 필수 상태 (PRD 6장에 명세 추가)

전부 실제로 발생하는데 아트보드에 대응 화면이 없습니다.

| 상태 | 요지 |
|---|---|
| 코스 생성 실패 | `NO_POI_DATA` / `NO_CANDIDATE` / `INTERNAL_ERROR` 각각 다른 안내. **빈 날(`stops: []`)과 다른 상태** |
| 코스 화면 밖 알림 | Realtime은 전역인데 모달은 코스 화면에만. 전역 배너 → 누르면 모달로 이동 |
| 3분 타임아웃 | 남은 시간 표시 + 경과 시 모달 자동 닫힘. 안 하면 `ALERT_EXPIRED`(409)를 만남 |
| 게스트 코스 소실 | 메모리에만 있어 새로고침 한 번에 사라짐 → `sessionStorage` |
| 저장 코스 주소 | `/itinerary/:id` — 뒤로가기·새로고침 성립 |
| Realtime 구독 시점 | 로그인이 아니라 **저장 성공 응답 직후** |
| 후보 3개 미만 | 계약은 "최대 3개". 평창 `culture_history` 4건이라 실제로 1~2개가 옴 |
| "반영한 취향" 칩 | **0.5 이상, 최대 3개**, 내림차순. 없으면 칩 영역 자체를 렌더링 안 함 |

### 6. QA 케이스 추가 (T-022~T-028)

T-022 언어 전환 시 재생성 없이 3언어 전환(**P0**), T-023 번역 일관성 전수 검사,
T-024 지도 언어, T-025 생성 실패 3종, T-026 코스 화면 밖 알림, T-027 게스트 새로고침 보존,
T-028 3분 경과 후 응답.

- 블로커: 없음.
- 다음 액션:
  - **백엔드 (우선순위 순)**: ① 평창 콘텐츠타입 커버리지/페이지네이션 조사 ② `pois.name_en`/
    `name_zh` 생성 ③ 스탑 4종 필드(`name` 객체화 포함) + `blurb`/`narration` 3언어 ④ 다중 시군
    날짜 배정 ⑤ `care_facilities` 소스 교체 + 병행 표기 ⑥ 마이페이지 2개 엔드포인트(IDOR 스코핑).
  - **프론트 (신규 세션)**: 계약 기준으로 목업 응답을 직접 만들어 착수. 실제 API가 나오는 순서대로
    연결. 착수 초반에 카카오맵 언어 옵션 확인 결과를 이 로그에 남길 것.
  - **QA**: T-101(LLM 가중치 편차 실측 — 1주차 항목, 아직 미착수) 최우선. 이후 T-017·T-020·T-022.

---

## [2026-09-10 20:00] PM (전략기획팀) — 기상청 403 해결 + 코스 점검 버튼 폐기 + "어디든지" 확정

### 1. 기상청 403 — 해결 (원인: 키를 잘못 넣었음)

`.env` 파일들의 서비스키 지문을 대조해서 찾았습니다.

| 키 | 길이 | sha1 앞 8자 |
|---|---|---|
| TourAPI / 의료관광 / 축제 | 98 | `80713f86` (셋 다 동일) |
| **기상청 (수정 전)** | **99** | **`c98b9d5a`** |

공공데이터포털은 계정당 일반 인증키 한 쌍을 발급하고 그 하나로 승인된 모든 API를 쓰는데, 기상청만
다른 값이 들어 있었습니다. 승현님이 포털에서 올바른 키로 교체해 **정상 동작 확인했습니다.**
현재 다섯 개 키가 전부 `80713f86`로 통일됐고, **외부 API 4종(TourAPI·의료관광정보·축제표준데이터·
기상청)이 모두 살아 있습니다.**

> 백엔드팀: `agent/src/weather.js` 상단의 블로커 주석(라운드3에서 남긴 "활용신청 안 된 상태로 추정")은
> 이제 사실이 아니므로 지워주세요. 코드 자체는 문제가 없었습니다 — 엔드포인트(`VilageFcstInfoService_2.0/
> getVilageFcst`), 격자 변환, `base_date`/`base_time` KST 계산 전부 정상이었습니다.
> 이제 `monitor.js` 자동 스캔을 실호출로 검증할 수 있습니다.

### 2. 코스 점검 버튼 — 폐기 (승현님 결정)

직전 라운드에서 "지금 코스 점검하기"를 UI에 넣기로 했는데 **폐기합니다.**

판단 근거: 사용자가 코스를 고치고 싶을 때 쓰는 경로는 이미 **코스 부분 수정**(2.1절 Must-have,
`regenerate-stop`)으로 존재합니다. 점검 버튼은 그 경로와 중복이고, "자동으로 감시한다"는 제품의 핵심
주장과 어긋나 보입니다. 기상청이 살아난 것도 이 결정을 뒷받침합니다 — 자동 스캔이 실제로 동작합니다.

> **`POST /api/alerts/trigger` 엔드포인트 자체는 유지합니다.** QA가 T-003/T-007/T-008을 검증하려면
> 알림을 결정론적으로 만들 방법이 필요한데 실제 강수를 기다릴 수는 없기 때문입니다. **QA는 UI가
> 아니라 API를 직접 호출**합니다 — `TEST_PLAN.md`의 해당 케이스 절차를 그렇게 고쳤습니다.

> **남은 제약 (수용)**: 자동 스캔은 `status='active' AND 오늘이 여행 기간 안`인 일정만 봅니다.
> 심사위원이 미래 날짜로 코스를 만들면 알림을 못 볼 수 있습니다. "기능이 구현되어 있다는 사실 자체가
> 중요하다"는 판단으로 수용하며, 대신 발표자료에서 동작 조건을 명확히 설명합니다(11.5절).

### 3. "어디든지" — 다중 선택이 아니라 니즈 기반 시군 선택 (승현님 의도 반영)

제가 다중 선택으로 잘못 이해했던 걸 바로잡았습니다. **"어디든지"는 사용자가 지역을 고르지 않고,
자유 텍스트의 니즈에 맞는 시군을 서버가 골라주는 기능**입니다. PRD 3.5절에 **2.4단계**를 신설했습니다.

```
1. 시군별 카테고리 분포를 정규화  share(r,c) = count(r,c) / total(r)
   ← 절대 건수를 쓰면 POI 많은 시군이 항상 이김
2. score(r) = Σ_c weights[c] × share(r,c)
3. 1위 점수의 60% 이상인 시군만, 점수 내림차순 최대 min(여행 일수, 3)개
4. 고른 시군을 region_codes로 삼아 2.5단계(날짜 배정)로 넘김
```

**계약 변경**: `region_codes`에 **빈 배열 `[]`** 이 오면 "어디든지"입니다. 응답에
`selected_regions: {auto, region_codes}`가 추가됩니다.

> **자유 텍스트가 비면 "어디든지"를 쓸 수 없습니다.** 가중치가 전부 0이라 고를 근거가 없습니다.
> 프론트가 선택지를 비활성화하고, 서버도 `region_codes: []` + 빈 `free_text`를 400으로 막습니다.
> 근거 없이 아무 시군이나 골라놓고 추천인 척하지 않습니다.

> **고른 이유를 반드시 보여줍니다**: `narration.region_reason`(`{ko,en,zh}`)을 추가했습니다.
> "숲길과 조용한 전시를 원하셔서 평창과 홍천을 골랐어요" 같은 한 줄이며, 기존 narration LLM 호출에서
> 함께 받습니다(추가 호출 없음). **사용자가 시군을 직접 고른 경우엔 `null`** — 사용자가 고른 것을
> 시스템이 골라준 것처럼 말하면 안 됩니다.

### 4. 생성 실패 화면 — 3장에서 1장(문구 변형 2개)으로 축소

`NO_POI_DATA` 화면은 **불필요합니다** — 데이터가 없는 시군은 선택 자체가 비활성이라 사용자가 도달할
수 없습니다(API 레벨 방어로만 남깁니다). 남는 건 ① 서버·네트워크 오류 ② 조건에 맞는 곳 없음
두 가지입니다. **로딩 스피너가 무한히 도는 상태가 없어야 한다**는 게 이 화면의 존재 이유입니다.

### 5. 코스 화면 밖 알림 — 배너 + 브라우저 알림 병행

브라우저 알림(`Notification` API)을 추가하되 **앱 내 배너를 대체하지 않습니다.** 둘은 다루는 상황이
다릅니다 — 탭이 보이는 상태에서는 브라우저가 알림을 억제하므로 배너가 유일한 경로이고, 다른 탭을
보고 있을 때는 브라우저 알림이 유용합니다. 권한 거부 사용자와 iOS Safari(홈 화면 추가 없이는 웹 푸시
불가)에서는 배너가 폴백입니다.

**Service Worker와 푸시 서버는 쓰지 않습니다** — 페이지가 열려 있는 동안만 동작하는 `Notification`
API로 충분하고, 웹 푸시는 PRD 2.3절에서 이미 스코프 밖입니다. 알림 권한은 앱 진입 즉시가 아니라
**코스를 저장한 직후**에 묻습니다(그때 처음 의미가 생깁니다).

### 6. QA 케이스 추가 (T-029~T-031) + 절차 변경

- T-029 "어디든지"가 요청에 따라 다른 시군을 고르는지 (레포츠/문화/미식 3종 입력)
- T-030 자유 텍스트 없이 "어디든지" 차단
- T-031 직접 고른 코스는 `region_reason`이 `null`인지
- T-003/T-007/T-008/T-013/T-026 절차를 **UI 버튼 → API 직접 호출**로 변경
- T-025 실패 화면을 3종 → 2종으로 축소

- 블로커: 없음. **외부 API 4종 전부 정상.**
- 다음 액션:
  - **백엔드 (우선순위 순)**: ① 평창 콘텐츠타입 커버리지/페이지네이션 조사 ② `pois.name_en`/`name_zh`
    생성 ③ 스탑 4종 필드 + `blurb`/`narration`/`region_reason` 3언어 ④ "어디든지" 시군 자동 선택
    (2.4단계) + 다중 시군 날짜 배정(2.5단계) ⑤ `care_facilities` 소스 교체 + 병행 표기
    ⑥ 마이페이지 2개 엔드포인트(IDOR 스코핑) ⑦ `weather.js` 블로커 주석 제거 + `monitor.js` 실호출 검증.
  - **디자인**: 수정 프롬프트 재발행 예정(점검 버튼 삭제, "어디든지" 재설계, 실패 화면 1장으로 축소 반영).
  - **프론트 (신규 세션)**: 계약 기준으로 목업을 직접 만들어 착수. 카카오맵 언어 옵션 확인 결과를
    이 로그에 남길 것.
  - **QA**: T-101(1주차 항목, 아직 미착수) 최우선. 기상청이 살아났으므로 `monitor.js` 자동 스캔
    검증도 이제 가능.

---

## [2026-09-10 22:00] PM (전략기획팀) — UI 아트보드 2차 검수 통과 + 시군 이동 필드 신규

디자인 라운드 결과(31장)를 계약과 대조해 검수했습니다. **프론트 착수 가능 판정**이며, 막는 항목은
아래 P0 하나뿐이고 그것도 다중 시군 화면에만 걸립니다.

### 검수 통과

- **앱 JS 0줄** (31장 전수, `support.js`는 캔버스 런타임)
- **PRD 11.3절 제외 기능 0건**, 코스 점검 버튼 없음
- **병행 표기**: 요청 이상으로 반영됨 — `name.en`이 `null`인 케이스("대관령한우타운")를 EN/ZH 화면에
  일부러 섞어놔서, 프론트가 번역 누락 상태를 미리 보고 만들 수 있습니다.
- **"어디든지" 3상태 전부**: 선택(Main) / 미선택(MainRequired) / 자유 텍스트 없어 비활성(MainNoText).
  상호배타도 MainTooMany에서 시군 3개 선택 + 어디든지 해제로 표현됨.
- **`region_reason`이 다중 시군 화면에만** 있음(ResultDesktop O, ResultMobile X) — 계약대로.
- **7개 카테고리 전부 화면에 등장** (용평리조트를 레포츠/액티비티로 넣어 마지막 하나 충족).
- Care 3장 병행 표기 + CareEN, MyPage 휴지통 + 확인 모달, 후보 2곳 변형, 취향 칩 없는 변형,
  Login 약관 링크 스타일 제거, 알림 권한을 저장 직후에 묻기 — 전부 반영 확인.

### P0 — `days[].travel_from_prev_day` 신규 (계약 + 화면)

**다중 시군 코스에서 날이 바뀌며 시군도 바뀌는 구간의 이동이 화면에 없었습니다.** ResultDesktop이
홍천 2일 + 평창 1일인데, DAY 2 마지막(삼봉약수, 홍천 내면)에서 DAY 3 첫(월정사, 평창 진부면)까지
차로 한 시간이 넘는 구간에 아무 표시가 없습니다. 하루 안에서는 "차로 32분"을 꼬박꼬박 보여주면서요.

계약 결함이기도 합니다 — `travel_from_prev`는 그날 첫 스탑에서 항상 `null`이라 이 구간을 담을
필드가 없었습니다. `API_CONTRACT.md §1`에 추가했습니다.

```json
"travel_from_prev_day": {
  "from_region_code": "hongcheon", "to_region_code": "pyeongchang",
  "mode": "car", "minutes": 70
}
```

> **백엔드 구현 주의**
> - `day: 1`은 항상 `null`.
> - 전날 `stops`가 비어 있으면(`stops: []`) **그보다 이전의, 스탑이 있는 마지막 날**을 기준으로
>   계산하세요. 빈 날 때문에 이동 정보가 끊기면 안 됩니다.
> - `from_region_code`와 `to_region_code`가 **같아도 값을 내려보냅니다** — 같은 시군 안에서도 날이
>   바뀌며 이동이 생깁니다. 시군 이름 표시 여부는 프론트가 두 값을 비교해서 정합니다.
> - 카카오모빌리티 실패 시 **필드 전체를 `null`** (추정값 금지).

**사용자 관점에서 이 정보의 의미**: 숙소를 옮겨야 하는지를 결정하는 값입니다. 다중 시군을 넣기로 한
이상 이게 빠지면 기능이 반쪽입니다.

### P1 — `is_indoor` 표시 위치 규칙 확정

아트보드에서 실내 여부가 **두 방식으로 섞여** 있었습니다 — 매니징 제안 모달·후보 목록에서는 카테고리
옆 배지("문화/역사 · 실내"), 코스 결과 화면에서는 `blurb` 문장 안("축제장 바로 옆, 비 와도 괜찮은 실내").

`blurb`는 LLM이 만든 문장이라 **실내인데도 그 단어가 안 들어간 장소는 아무 표시가 없게 됩니다.**
규칙을 확정했습니다(PRD 4장 `is_indoor` 주석, `API_CONTRACT.md §1`):

> **교체 후보를 고르는 맥락(매니징 제안 모달, "이 장소 바꾸기" 후보 목록)에서만 배지로 표시.**
> 코스 결과 화면의 스탑 카드에는 배지를 붙이지 않고 `blurb`에 맡깁니다. 그 두 곳에서만 실내/야외가
> 선택의 근거이기 때문입니다.

### P2 (디자인 세션에 전달)

- `AlertExpiring`의 "다음 점검 때 다시 보내드려요" → "점검"은 버튼을 뺀 뒤 사용자에게 없는 개념이
  됐습니다. "조건이 다시 맞으면 알려드려요"로.
- `AlertBanner`에 닫기(X) 없음 — 3분 뒤 사라지긴 하지만 지금 볼 생각이 없는 사용자가 치울 방법이 없음.

### QA 케이스 추가 (T-032~T-034)

- T-032 시군 이동 표시 (**P0**) — `day: 1` 미표시, 같은 시군일 때 이름 생략, 실패 시 줄 제거
- T-033 빈 날을 건너뛰고 이전 날 기준으로 계산되는지
- T-034 실내 배지가 ②③에만 붙고 결과 화면엔 없는지

- 블로커: 없음.
- 다음 액션:
  - **프론트**: **단일 시군 화면 27장은 지금 착수 가능** (Main/Loading/Result/EmptyDay/Alert/Login/
    MyPage/Care 계열). 보류는 ResultDesktop 날짜 헤더의 시군 이동 한 줄뿐이며, 작업 마지막에 붙이면
    됩니다.
  - **백엔드**: 기존 우선순위에 `travel_from_prev_day` 추가 — 카카오모빌리티 연동 작업과 같은
    묶음이라 `travel_from_prev`와 함께 구현하세요.
  - **디자인**: P0/P1/P2 반영 프롬프트 전달 예정.

---

## [2026-09-13 16:20] 프론트팀 — 1차 착수: 31장 전체 화면 + 데이터 레이어 + 목업

### 1. 카카오맵 SDK 언어 옵션 — 실측 확인 완료 (착수 초반 확인 요청 항목)

**타일 언어 옵션 없음.** 공식 문서(`developers.kakao.com/docs/en/kakaomap/common`,
`apis.map.kakao.com/web/documentation`) 어디에도 SDK 로드 시 언어를 지정하는 파라미터나
옵션이 없습니다. PRD 6장이 이미 예상한 최악의 경우(배경 타일은 한국어로 남음)를 그대로
수용합니다. 스탑 마커는 커스텀 오버레이(`CustomOverlay`)라 마커 라벨은 선택 언어로 그리도록
[MapView.tsx](../components/result/MapView.tsx) 에 구현해뒀습니다 — 실제 카카오맵 앱키가
없어 라이브 렌더링은 아직 못 봤고, 지도 SDK 자체는 교체하지 않았습니다(PRD 3장 그대로).

### 2. 이번 세션에서 만든 것

`/app`, `/components`만 건드렸고 담당 디렉토리 밖(`/server`, `/agent`, `/scripts`, `/tests`,
`docs/GANGWON_GO_PRD.md`, `docs/API_CONTRACT.md`, `design/artboards/`)은 손대지 않았습니다.

- **셋업**: Next.js 16(App Router, Turbopack) + Tailwind v4 + next-intl(en/zh) + TypeScript.
  루트에 `next.config.ts`/`middleware.ts`/`i18n/`/`package.json` 등 프레임워크가 요구하는
  설정 파일이 새로 생겼습니다(다른 팀 디렉토리 아님, 앱 전체 빌드에 필요).
- **데이터 레이어**: [app/lib/api.ts](../app/lib/api.ts) 한 곳에 전부 모았습니다.
  `NEXT_PUBLIC_API_BASE_URL`이 비어있으면(지금 상태) `app/lib/mock/*`를 반환하고, 값이
  채워지면 자동으로 실제 `fetch`를 탑니다 — 호출부(컴포넌트)는 안 바뀝니다. `.env.example`에
  키 이름만 추가했습니다(`NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_KAKAO_MAP_KEY`).
- **목업 데이터**: `app/lib/mock/`에 요청하신 케이스를 전부 만들었고, 실제 폼 입력(날짜·지역)에
  반응해서 재현되도록 엔진화했습니다(고정 JSON 나열이 아님) — `generate.ts`가 PRD 3.5절
  2.5단계(위도 내림차순 날짜 배정) 규칙을 그대로 흉내냅니다.
  - 평창 단독 3일(스탑 8곳) · 홍천+평창 다중 시군(시군 이동 줄 포함) · "어디든지"(region_reason
    포함) · 4일차 마지막 날 `stops: []` · `name.en`/`blurb.en`이 null인 스탑(평창
    "대관령한우타운", 홍천 딸기마을 체험장) · 인제 단독 요청 시 blurb·travel_from_prev 전부
    null(LLM/모빌리티 실패 시뮬레이션) · `free_text`에 `[[NO_CANDIDATE]]`/`[[INTERNAL_ERROR]]`를
    넣으면 해당 에러 강제 재현 · `region_codes:[]`+빈 텍스트 및 시군 수>일수는 400
    `INVALID_STRUCTURED_INPUT`
  - `GET /api/itineraries` 목록: 진행 중 2건(오늘 포함 1건 + 미래 1건) + 지난 여행 1건
  - `GET /api/care`: 시군별 5건, `name_en` null 섞음(인제/홍천/평창 소방서), `phone` null 섞음
  - 알림 payload: 평창 코스 DAY1 첫 스탑(월정사, 야외) → 알펜시아 스카이워크(실내) 제안
- **인증/저장 목업**: `app/lib/mock/auth.ts`가 Google 로그인을 흉내냅니다 —
  **세션당 첫 로그인 시도는 항상 실패**하도록 만들어서 LoginRetry 화면을 매번 결정론적으로
  볼 수 있게 했습니다. 저장된 코스는 `app/lib/mock/sessionSavedStore.ts`가 `sessionStorage`에
  실어서 새로고침·뒤로가기에도 살아남습니다(진짜 DB가 없는 동안의 임시 방편).

### 3. 화면 — 아트보드 31장, 상태 변형으로 흡수

아트보드 1장 = 화면 1개가 아니라, 실제 라우트는 5개뿐이고 나머지는 **같은 컴포넌트의 상태
변형**으로 만들었습니다(요청·입력에 따라 자연스럽게 재현됨, 화면별 진입 방법은 아래 4번 참고).

| 라우트 | 흡수한 아트보드 |
|---|---|
| `/` | Main, MainRequired, MainNoText, MainTooMany |
| `/result` (게스트, sessionStorage) | Loading, ResultMobile, ResultDesktop, ResultExpanded, ResultNoPref, ResultEN/ZH, EmptyDay, GenerateError, MapFallback |
| `/itinerary/:id` (저장됨) | SavedDone, AlertModal, AlertExpiring, AlertApplied, ReplaceStop, ReplaceStopTwo |
| `/mypage` | MyPage, MyPageDelete |
| `/care` | Care, CareEN, CareNoLocation, CarePermission |

SaveLogin/Login/LoginRetry/NotifyPermission은 `/result`·`/itinerary/:id` 위에 뜨는 모달
시퀀스(`components/save/SaveFlowModal.tsx`)로 만들어서, 저장 버튼 클릭 한 번으로 로그인
실패→재시도→성공→`/itinerary/:id` 리다이렉트→저장완료 토스트→알림 권한 모달까지 이어집니다.
AlertBanner는 전역 컴포넌트(`components/managing/AlertListener.tsx`, 루트 레이아웃에 상시
마운트)로, 코스 화면 밖에 있을 때만 뜨고 코스 화면 위에서는 AlertModal이 바로 뜹니다.

### 4. 아트보드에 화면이 없던 필수 상태 — 처리 방식

- **게스트 새로고침 보존**: `sessionStorage` (`app/lib/storage.ts`)
- **저장 코스 주소**: `/itinerary/:id` (동적 라우트, `app/[locale]/itinerary/[id]/page.tsx`)
- **Realtime 구독 시점**: 저장 성공 응답 직후 `useWatch().setWatchedId(id)` 호출 (로그인 시점 아님)
- **대체 후보 1~2개**: `mockRegenerateCandidates`가 자연 필터링으로 재현(고정 개수 아님).
  실제로 시군 POI 풀을 다 써버린 코스는 0개까지도 나옵니다 — `ReplaceStopModal`이 "지금
  대체할 곳을 찾지 못했어요" 문구로 처리
- **취향 칩 규칙**: `app/lib/weights.ts`의 `topPreferenceChips()` (0.5 이상·최대 3개·내림차순),
  해당 없으면 `PrefChips`가 `null` 반환
- **blurb/travel_from_prev null**: 각 컴포넌트가 값 없으면 그 줄 자체를 안 그림 (지어내지 않음)
- **알림 권한 요청 시점**: 저장 직후에만 (`NotifyPermissionModal`, 앱 진입 시 안 물어봄)
- **AlertBanner vs 브라우저 알림**: 배너가 기본, 브라우저 `Notification`은 `document.hidden`일
  때만 보조 (`AlertListener.tsx`)

### 5. 아트보드에 없어서 직접 판단한 것 2가지 (프론트 세션 프롬프트 지정 항목)

1. **Loading 문구 분기**: 단일 시군은 "{시군}에서 갈 만한 곳을 고르고 있어요", 다중 시군은
   시군명을 나열, "어디든지"는 "맞는 지역을 찾고 있어요"로 분기(`LoadingScreen.tsx`). 요약
   카드의 지역 줄도 "어디든지"일 땐 "확인 중"으로 비웠습니다.
2. **ALERT_EXPIRED 토스트**: `AlertModal`이 3분 카운트다운을 로컬에서도 세고, 0이 되면
   스스로 닫히면서(`onExpired`) "시간이 지난 제안입니다" 토스트를 띄웁니다(다국어 키
   `managing.expiredToast`).

### 6. 아트보드와 약간 다르게 구현한 것 (판단 근거)

- **"바꾸기" 버튼**: ResultDesktop 아트보드는 저장 전(`저장 안 됨`) 상태에서도 스탑마다
  "바꾸기"가 보이는데, `regenerate-stop`은 계약상 저장된 일정에서만 동작합니다(API_CONTRACT.md
  §3). 그래서 버튼은 항상 보이게 두되 게스트 상태에서 누르면 저장 흐름으로 먼저 유도하는 대신
  — **지금은 `editable`을 저장된 코스에서만 true로 켜서 게스트 결과 화면에는 버튼 자체가
  없습니다.** 모바일에서는 데스크톱처럼 별도 버튼 대신 스탑 행 전체를 탭하면 같은 편집
  시트가 열립니다(공간 제약, 데스크톱은 아트보드 그대로 pill 버튼).
- **"오늘" 배지·감시 상태**: `end_date < 오늘`이면 "지난 여행", `start_date <= 오늘 <= end_date`면
  "지켜보는 중", 그 외(미래)는 "저장됨"만 표시(PRD 3.6절 감시 대상 조건과 동일 기준). 이때 "오늘"은
  **뷰어의 브라우저 타임존이 아니라 KST로 고정**했습니다(`app/lib/date.ts`의 `todayYmd()` —
  `Intl.DateTimeFormat`으로 `Asia/Seoul` 강제) — 프론트 세션 중 로컬시간 기준으로 짰다가 마이페이지의
  "지켜보는 중" 배지가 지난 여행에도 붙는 버그를 직접 겪고 고쳤습니다. PRD 6장의 KST 원칙이
  서버뿐 아니라 "오늘" 판정이 들어가는 프론트 로직에도 그대로 적용되어야 한다는 근거입니다.

### 7. 확인해주세요 (블로커는 아님)

- **카카오맵 실제 렌더링 미검증**: 앱키가 없어 `MapView.tsx`는 목업 환경에서 항상 MapFallback
  경로만 탑니다. 실키가 생기면 `.env.local`에 `NEXT_PUBLIC_KAKAO_MAP_KEY`만 넣으면 바로
  실제 지도 경로를 타는데, 그 상태의 라이브 확인은 아직 못 했습니다.
- **`middleware.ts` deprecation 경고**: Next.js 16이 "proxy 컨벤션으로 옮기라"는 경고를
  띄웁니다(빌드는 정상). 제공된 자동 코드모드(`@next/codemod middleware-to-proxy`)가 이
  구조에서는 파일을 못 찾아 변경을 안 만들었습니다 — 동작에 지장 없어 이번엔 보류합니다.
- **디자인 폴백**: 지금 파비콘은 Next.js 기본 아이콘입니다. 브랜드 파비콘이 나오면
  `app/favicon.ico`만 교체하면 됩니다.

### 8. 다음 액션

- **백엔드**: `app/lib/api.ts`의 각 함수 시그니처가 `API_CONTRACT.md`를 그대로 따르므로,
  엔드포인트가 준비되는 대로 `NEXT_PUBLIC_API_BASE_URL`만 채우면 목업→실제 전환이 됩니다.
  함수별로 실제 엔드포인트 경로·헤더까지 이미 넣어뒀습니다(주석 없이 바로 fetch 분기).
- **프론트(다음 세션)**: 실제 카카오맵 앱키로 라이브 렌더링 확인, `middleware→proxy` 전환
  재검토, 파비콘/OG 이미지 교체, 실백엔드 연동 후 회귀 테스트.
- **QA**: 이번 세션에서 만든 목업 트리거(`[[NO_CANDIDATE]]`/`[[INTERNAL_ERROR]]` free_text
  마커, `window.__ggoTriggerAlert()` 개발 전용 훅)를 참고해 프론트 단독으로도 에러·알림
  화면을 재현할 수 있습니다. 실백엔드 붙기 전까지 프론트 화면 자체의 수용기준 점검에
  활용해주세요.
- 블로커: 없음.
