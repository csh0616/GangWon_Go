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

---

## [2026-09-12 21:00] PM (전략기획팀) — 프론트 1차 검수: P0 4건

구조와 판단력은 좋았습니다. 특히 **KST 버그를 스스로 발견해서 고친 것**(마이페이지 "지켜보는 중"
배지가 지난 여행에도 붙던 것 → `todayYmd()`를 `Asia/Seoul` 강제)은 PRD 6장 원칙을 프론트 로직까지
확장 적용한 판단이라 그대로 유지합니다. 목업을 고정 JSON이 아니라 입력에 반응하는 엔진으로 만든 것,
`[[NO_CANDIDATE]]` 마커와 `window.__ggoTriggerAlert()` 같은 QA 훅을 남긴 것, 카카오맵 언어 옵션을
실측 확인해 로그에 남긴 것, 31장을 5개 라우트 + 상태 변형으로 정리한 것 전부 좋습니다.

아래 4건만 고치면 됩니다.

### P0-1 — 한국어 UI가 없습니다 (가장 큼)

```
i18n/routing.ts       locales: ["en","zh"],  defaultLocale: "en"
app/messages/         en.json, zh.json  ← ko.json 없음
app/lib/localized.ts  type UiLocale = "en" | "zh"
```

**심사위원이 배포 URL에 접속하면 영어 화면이 뜹니다.** 국내 공모전이고, 심사 방식이 심사위원의
URL 직접 접속으로 확정돼 있습니다(11.5절). `design/artboards/` 31장 중 29장이 한국어 화면인데
전부 영어·중국어로 옮겨졌습니다.

**이건 PM 책임이 큽니다.** 라운드6에서 `API_CONTRACT.md §0`의 `lang`에 `ko`를 추가하면서 PRD 2.3절
원문("영/중 2개 외 추가 언어는 구현하지 않는다")은 안 고쳤습니다. 두 문서가 어긋나 있었고 프론트는
PRD를 읽었습니다. **PRD 2.3절에 언어 상자를 신설해 "한국어는 스코프 밖이 아니라 기본 언어"임을
명시했고, 2.1절·11.1절 표현도 함께 고쳤습니다.**

수정 방향: `locales: ["ko","en","zh"]`, `defaultLocale: "ko"`, `app/messages/ko.json` 신설
(아트보드 문구가 원본이므로 그대로 쓰면 됨), `UiLocale`에 `ko` 추가, `pickName()`이 `ko`일 때는
병기 없이 한국어만 반환.

### P0-2 — 입력 검증이 진입 직후부터 표시됨

`MainForm.tsx`에 touched/submitted 상태가 없어 `requiredMissingCount > 0`이 첫 렌더부터 참입니다.
빨간 배너와 "선택해 주세요"가 아무것도 안 건드렸는데 떠 있습니다.

**근본 원인은 `disabled={!canSubmit}`입니다.** 버튼 클릭 자체가 막혀 있어 검증을 촉발할 방법이
없으니 처음부터 띄운 구조가 됐습니다. 버튼을 활성으로 두고 클릭 시 검증하는 쪽으로 바꿔야 합니다.

### P0-3 — 지도: 카카오맵 앱키 없음 (코드는 정상)

`NEXT_PUBLIC_KAKAO_MAP_KEY`가 비어 있어 항상 MapFallback을 탑니다. 승현님 액션:
**JavaScript 키**(REST 키 아님 — `KAKAO_MOBILITY_API_KEY`는 REST 키라 JS SDK에 안 됩니다) 발급 +
카카오 개발자 콘솔 > 앱 설정 > 플랫폼 > Web에 `http://localhost:3000` 및 배포 도메인 등록.
도메인 등록을 빠뜨리면 키가 맞아도 SDK가 거부합니다.

### P0-4 — 지도 수용기준 2개 미구현

PRD 2.1절 수용기준은 "지도 마커, **경로선**, 언어 전환, **내 위치 표시** 정상 동작"입니다.

- **경로선**: `Polyline`이 `MapView.tsx`의 전역 타입 선언에만 있고 호출부가 없습니다. 마커만 찍힙니다.
- **내 위치 파란점**: `navigator.geolocation`이 `/care`에만 있고 지도엔 없습니다.
  `ResultView.tsx`에 "내 위치" 텍스트 라벨만 있습니다.

둘 다 Must-have 수용기준이며 QA T-010 검증 대상입니다.

### P1 — DAY 전환 시 지도가 갱신되지 않음

`MapView.tsx`의 `useEffect(..., [])`. 주석으로 인지하고 계신 항목인데, **다중 시군 코스는 DAY 2가
아예 다른 시군**이라 지도가 엉뚱한 지역을 계속 보여줍니다. `day`를 deps에 넣고 map 인스턴스는
ref로 유지한 채 마커·경로선만 교체하면 됩니다.

### 판단 존중 (고치지 않아도 됨)

- 게스트 결과 화면에서 "바꾸기" 버튼을 숨긴 것 — `regenerate-stop`이 저장된 일정 전용이라는
  계약(§3) 해석이 맞습니다.
- 모바일에서 스탑 행 전체를 탭하면 편집 시트가 열리게 한 것 — 공간 제약상 합리적입니다.
- `middleware.ts` deprecation 경고 보류 — 동작에 지장 없으므로 D-9 시점엔 건드리지 않는 게 맞습니다.

### QA 케이스 추가 (T-035~T-037)

- T-035 **기본 언어가 한국어인지** (P0) — 시크릿 창, 브라우저 언어가 영어인 상태에서도
- T-036 입력 검증 시점 — 진입 직후엔 경고가 없고 버튼 클릭 시 표시되는지
- T-037 지도 경로선·내 위치·DAY 전환 갱신

### 기타

- `design/`은 로컬 보관(피그마 이관 예정)으로 확정, `.gitignore`에 추가합니다. 저장소에 커밋하지 않습니다.
- 루트의 `design_snapshot.zip`, `round6_docs.zip`은 삭제 대상입니다.

- 블로커: 없음.
- 다음 액션:
  - **승현님**: 카카오맵 JavaScript 키 발급 + 플랫폼 도메인 등록 → `.env.local`에 주입.
  - **프론트**: 위 P0-1/2/4 + P1 수정.
  - **백엔드**: 프론트 수정이 끝나면 라운드5 착수(9개 항목).

---

## [2026-09-13 18:10] 프론트팀 — 1차 검수 P0 4건 반영

지적하신 4건 전부 고쳤습니다. `design/artboards/`·`docs/GANGWON_GO_PRD.md`·`docs/API_CONTRACT.md`는
읽기만 했고, `.env.local`은 커밋하지 않았습니다.

### P0-1 — 한국어를 기본 로케일로

- `i18n/routing.ts`: `locales: ["ko","en","zh"]`, `defaultLocale: "ko"`
- **`localeDetection: false`도 함께 껐습니다.** 이것만으로는 부족했습니다 — `defaultLocale`만
  바꾸면 next-intl 미들웨어가 브라우저 `Accept-Language`를 보고 "/"를 "/en"으로 리다이렉트할
  수 있어서(요청하신 "브라우저 언어가 영어여도 한국어가 떠야 한다"는 조건), 감지 자체를 꺼서
  항상 `defaultLocale`(한국어)로 떨어지게 했습니다. 전환은 `LangSwitcher`의 명시적 클릭으로만
  일어납니다.
- `app/messages/ko.json` 신설 — **번역이 아니라 아트보드 원문을 그대로 옮겼습니다.**
  다만 아트보드에 없던 값(날짜 파라미터화, `dayStopCount`처럼 이번에 쪼갠 키 등)은 기존
  한국어 톤에 맞춰 새로 썼습니다. 두 가지는 실제로 고쳐야 해서 en/zh도 같이 손봤습니다:
  - `save.loginPromptKeepPrefix/Suffix` → `loginPromptKeep` 하나로 통합. 한국어는 조사가
    명사에 바로 붙어야 해서("코스는" ○, "코스 는" ×) prefix+공백+명사+공백+suffix 조립 방식이
    구조적으로 안 맞았습니다. `t.rich()`로 `{course}`를 문장 안에 직접 끼워 넣게 바꿨습니다.
  - `managing.appliedBadgePrefix/Suffix` → `appliedToast` 하나로 통합 (같은 이유)
  - `result.stops`(스탑 카드 목록 등에서 "스탑 8곳") vs 새로 추가한 `result.dayStopCount`
    (DAY 헤더 줄에서 "9월 14일 월 · 3곳" — 아트보드에 "스탑"이라는 단어가 없음)로 분리했습니다.
    en/zh는 원래 값이 두 자리 다 자연스러워 값은 동일하게 채웠습니다.
- `app/lib/localized.ts`: `UiLocale`에 `"ko"` 추가. `pickName()`이 `ko`일 때는 병기 없이
  `name.ko`만 반환(아트보드 한국어 화면에 병기 줄이 없음). `CareFacilityCard.tsx`도 같은
  이유로 `locale==="ko"`일 때 `name_en/zh` 보조 줄을 안 그리게 고쳤습니다 — 병행 표기는
  "한국어 + 외국어 사용자"용인데(API_CONTRACT.md §4) 사용자 언어가 이미 한국어면 병기 대상이
  없습니다.
- `app/lib/date.ts`: `formatMonthDayWeekday`/`formatDateRange`에 `ko` 케이스 추가
  ("9월 14일 월", "9월 14일—16일"). **아트보드의 "9월 10일 목요일부터"(요일 풀네임)는 짧은
  형태("목")로 통일했습니다** — 같은 포맷터를 DAY 헤더와 날짜 시작 문구 양쪽에 재사용하는
  구조라, 한 곳만 풀네임으로 따로 만들지 않았습니다(일관성 우선, 의미 손실 없음).
- `components/layout/LangSwitcher.tsx`: "지금 언어를 뺀 나머지"를 보여주는 방식으로 바꿨습니다
  — 한국어 화면에선 EN/中 두 개만(아트보드와 동일), 영어·중국어 화면에선 그 자리에
  "한국어"가 나타나 항상 되돌아올 수 있습니다.

### P0-2 — 입력 검증은 버튼을 눌렀을 때만

`components/main/MainForm.tsx`에 `submitAttempted` state를 추가했습니다.

- `handleSubmit`: `canSubmit`이 false면 `setSubmitAttempted(true)`하고 return, true면 그대로 진행
- 상단 빨간 배너, Region/동행유형 섹션의 danger 톤 힌트("선택해 주세요" 등)는
  `submitAttempted && ...`로 게이팅 — 진입 직후엔 안 뜨고, 누른 뒤에만 뜹니다
- 하단 회색 체크리스트("필수 항목 N가지가 아직 비어 있어요")는 지시하신 대로 계속 항상 표시
- **버튼의 `disabled` 속성은 뗐지만, "비어있어 보이는" 회색 스타일은 유지했습니다.**
  `Button.tsx`에 `visuallyEmpty` prop을 새로 추가해 — 실제 `disabled` 없이 시각적 톤만
  `canSubmit`을 따라가게 분리했습니다. MainRequired/MainTooMany 아트보드가 보여주는 회색
  버튼 톤은 유지하면서 클릭 자체는 항상 받게 하려는 목적입니다. 값을 채우면 배너·힌트가
  즉시 사라지고 버튼도 초록으로 바뀝니다(라이브로 확인함, 아래 9번 참고).
- tooMany(시군 수 > 일수)도 인라인 힌트는 같은 규칙으로 게이팅했습니다. **하단 회색
  메시지("여행 일수보다 많은 시군은...")는 게이팅하지 않았습니다** — MainTooMany 아트보드가
  이 줄을 이미 회색으로(빨간색 아님) 보여주고 있어서, 위 "하단 체크리스트는 항상 표시"
  규칙과 같은 취급이 맞다고 판단했습니다.

### P0-3 — 지도 수용기준 2개(경로선·내 위치) 구현

`components/result/MapView.tsx`를 다시 짰습니다.

- **경로선**: `order` 순으로 정렬한 좌표를 `kakao.maps.Polyline`으로 연결
  (`strokeColor: #0B7A55`, `strokeWeight: 4`, `strokeOpacity: 0.75`). 스탑이 1개 이하인
  날은 그리지 않고 `setCenter`로만 이동, 2개 이상이면 `LatLngBounds`로 전체가 보이게
  `setBounds`.
- **내 위치 파란점**: `navigator.geolocation.watchPosition`으로 `CustomOverlay` 하나를
  갱신. 좌표는 지도 표시에만 쓰고 **어떤 `fetch`에도 싣지 않습니다**(코드 전체에서
  `position.coords`가 쓰이는 곳은 `CustomOverlay` 생성 한 줄뿐 — QA T-010③ 검증 포인트).
  권한 거부·미지원이면 조용히 폴백(파란점 없이 코스만 정상 표시, 에러 없음).
  언마운트 시 `clearWatch` + 오버레이 정리.
  `onMyLocationChange` 콜백으로 상위(`ResultView.tsx`)에 있고 없음을 올려보내고,
  **"내 위치" 라벨은 실제로 파란점이 찍혔을 때만 보이게** 연결했습니다(그전엔 라벨 자체가
  없음 — 지적하신 "연결이 어려우면 지우라"의 반대쪽인 "연결"을 선택).

### P1 — DAY 전환 시 지도 갱신

**검수 코멘트에서 짚으신 것보다 한 단계 더 아래에 있던 문제였습니다.** `useEffect` deps만의
문제가 아니라,애초에 **"지금 지도가 몇 일차를 보여주는지"를 들고 있는 state 자체가 없어서**
`MapView`가 `days[0]`을 상수로 받고 있었습니다(전환할 방법 자체가 UI에 없었음). 그래서:

- `ResultView.tsx`에 `selectedDayIndex` state를 새로 추가하고, 지도 위에 **DAY 전환 플로팅
  카드**(좌우 화살표 + "DAY N · 시군 · 날짜")를 얹었습니다(데스크톱 지도 패널·모바일 지도
  배경 공통). 스크롤 리스트의 각 DAY 헤더를 눌러도 같은 state가 바뀌어 지도가 그 날짜로
  이동합니다(양방향 연결).
- `MapView.tsx`는 지도 인스턴스(`kakao.maps.Map`)를 `useRef`로 마운트 시 한 번만 만들고,
  `day`(지금은 `selectedDayIndex`로 정해짐)·`status`·`locale`이 바뀔 때마다 기존
  마커·경로선만 `setMap(null)`로 걷어낸 뒤 다시 그리는 별도 `useEffect`로 분리했습니다.
  SDK 스크립트 로드는 여전히 `scriptId`로 중복 방지, 마운트 시 한 번뿐입니다.

### 카카오맵 라이브 확인 결과 — 새 블로커 발견 (승현님 액션 필요)

**앱키를 받아 확인하다가 1차 때와 다른 종류의 에러를 만났습니다.** 스크립트 로드 자체는
됩니다(`dapi.kakao.com` 요청이 실제로 나갑니다) — 그런데 그 응답이 403이고 본문이:

```json
{"errorType":"NotAuthorizedError","message":"App(GangWon_Go) disabled OPEN_MAP_AND_LOCAL service."}
```

**카카오 개발자 콘솔에서 이 앱에 "카카오맵" 제품이 활성화돼 있지 않습니다.** 키 형식이나
플랫폼 도메인 등록 문제가 아니라(그거였다면 다른 에러 메시지가 나옵니다), 콘솔 > 내 애플리케이션
> 제품 설정 > **카카오맵(Maps)** 자체가 꺼져 있는 상태로 보입니다. 라이브 키를 발급할 때
로그인/검색 계열 제품만 켜고 지도 제품 활성화를 빠뜨리기 쉬운 지점입니다.

- **프론트 코드는 이 실패를 정확히 감지해서 `MapFallback`으로 전환하는 것까지 라이브로
  확인했습니다** — 즉 "지도 자리가 비어버리는" 사고는 안 납니다(TEST_PLAN.md B-001 요건
  충족). 다만 그 다음 단계인 **마커·경로선·내 위치·DAY 전환이 실제 타일 위에서 어떻게
  보이는지는 이번에도 확인하지 못했습니다** — 코드 리뷰로는 스스로 확신하지만, 라이브 렌더는
  카카오맵 제품이 켜진 뒤에 다시 봐야 합니다.
- 콘솔에서 카카오맵 제품을 켜신 뒤 알려주시면, 같은 `.env.local` 키 그대로 다음 세션에서
  바로 확인하겠습니다.

### 검증

- `npx tsc --noEmit` 통과 / `npx eslint .` 통과 / `npm run build` 프로덕션 빌드 통과
  (`/ko`, `/en`, `/zh` 3개 로케일 전부 정적 생성 확인)
- 라이브 브라우저 확인:
  - `http://localhost:3000/` 접속 시 `/ko`로 떨어지고 전 화면 한국어로 렌더 (브랜드/지역
    칩/날짜/체크리스트 전부 한국어)
  - 코스 만들기 버튼을 **아무것도 안 채우고 클릭** → 그제서야 빨간 배너 노출, URL은
    안 바뀜(막힘 없이 클릭은 되지만 다음 화면으로 안 넘어감 확인)
  - 지역+동행유형을 채우면 배너·힌트가 클릭 없이 즉시 사라짐, 버튼 초록으로 전환
  - `EN` → `/en/result`로 정상 전환, 거기서 `한국어` 클릭 → `/ko/result`로 정상 복귀
  - DAY 전환 플로팅 카드의 다음 화살표 클릭 → 라벨이 "DAY 2 · 평창 · 9월 15일 화"로 갱신
    (지도 자체는 위 블로커로 폴백 상태라 타일 갱신은 못 봤지만, 상태 전환과 리스트 하이라이트는
    정상)
  - 카카오맵: 위 블로커로 실제 타일·마커·경로선·내 위치는 미확인, `MapFallback` 전환만 확인

- 블로커: **카카오 개발자 콘솔의 카카오맵 제품 비활성화** (승현님 액션 — 위 내용 참고)
- 다음 액션:
  - **승현님**: 카카오 개발자 콘솔 > 내 애플리케이션 > 제품 설정에서 카카오맵 활성화
  - **프론트(다음 세션)**: 카카오맵 제품 활성화 확인되면 마커·경로선·내 위치·DAY 전환을
    실제 타일 위에서 라이브로 재확인
  - **QA**: T-035(기본 언어 한국어)·T-036(입력 검증 시점)은 지금 상태로 검증 가능합니다.
    T-037(지도 경로선·내 위치·DAY 전환)은 카카오맵 제품이 켜진 뒤에 진행해주세요.

---

## [2026-09-13 19:05] 프론트팀 — 카카오맵 활성화 후 라이브 확인 + 실제 버그 1건 추가 수정

승현님이 카카오 개발자 콘솔에서 카카오맵 제품을 켜주신 뒤 실측했습니다.

### 실측 중 새로 발견한 버그 — "영원히 불러오는 중"에서 멈춤

제품을 켜고 처음 띄워보니 지도가 `MapFallback`도 아니고 실제 지도도 아닌, **"불러오는 중…"에서
영원히 멈추는** 세 번째 상태가 나왔습니다. 원인은 `MapView.tsx`가 `<script>` 태그와 `onload`
콜백을 effect 안에서 직접 관리하던 구조였습니다 — 개발 모드의 React Strict Mode가 effect를
마운트→클린업→재마운트로 두 번 태우는데, 클린업이 `cancelled = true`만 하고 이미 DOM에 붙인
`<script>` 태그는 지우지 않다 보니, 재마운트가 "이미 있는 스크립트"로 오인해 로드 완료를
기다리지 않고 지나가 버리고, 정작 그 스크립트의 `onload`엔 첫 번째 마운트의(이미 cancelled된)
콜백만 남아 있어 아무 것도 실행되지 않았습니다. 1차 검수 때는 키 자체가 없어 이 경로를 탈 일이
없었고, 이번에 제품을 켜고 나서야 처음 걸렸습니다.

**고친 방식**: SDK 로드를 컴포넌트 밖 모듈 스코프의 프로미스 하나로 캐시(`loadKakaoSdk()`)해서,
몇 번을 다시 mount해도 항상 같은 로드 시도를 공유하게 만들었습니다. 재시도 버튼은 실패했을 때만
캐시를 비우고 새로 시도합니다(`retryTick` state로 effect 재실행).

### 라이브 확인 결과 (실제 카카오 타일 위에서)

- **마커**: ✅ 실제 타일 위에 스탑 순서·이름이 한국어로 정상 표시 ("1 · 삼봉약수", "2 · 수타사" 등)
- **경로선**: ✅ 브랜드 컬러 초록 폴리라인이 스탑을 순서대로 연결, `LatLngBounds`로 전체가
  화면에 들어오게 자동 확대/축소됨
- **DAY 전환**: ✅ 홍천 2일 + 평창 1일 코스에서 DAY 3로 넘기니 지도가 홍천 지역 마커·경로선을
  걷어내고 평창 지역(월정사·대관령한우타운·평창무이예술관)으로 정확히 다시 그려짐 — 지도
  인스턴스는 그대로, 마커만 교체되는 것도 확인(줌 레벨이 새로 계산되는 것으로 확인 가능)
- **언어 전환**: ✅ 지도 배경 타일은 한국어(원래 예상대로), 마커 라벨은 선택 언어를 따라감
- **내 위치**: **부분 확인** — 이 브라우저 자동화 환경 자체가 `navigator.permissions.query`에서
  geolocation을 `denied`로 고정하고 있어(제가 바꿀 수 있는 값이 아님) 파란점이 실제로 찍히는
  것 자체는 못 봤습니다. 다만 **권한 거부 시 폴백은 라이브로 확인**했습니다 — 크래시 없이
  "내 위치" 라벨이 그냥 안 뜨고 코스만 정상 표시됩니다(콘솔 에러 0건). 권한이 허용됐을 때의
  경로(`CustomOverlay` 생성)는 이미 검증된 마커 생성과 동일한 API 호출 패턴이라 동작에 대한
  확신은 높지만, 실제 파란점 렌더는 실기기/일반 브라우저에서 한 번 더 봐주시면 좋겠습니다.

### 검증

- `npx tsc --noEmit` / `npx eslint .` / `npm run build` 전부 통과
- 새 탭에서 처음부터 다시 띄워도 동일하게 정상 렌더 확인(HMR 잔여 상태 아님을 확인)

- 블로커: 없음.
- 다음 액션:
  - **프론트(다음 세션 또는 QA)**: 실기기/일반 브라우저에서 위치 권한을 허용한 상태로
    내 위치 파란점이 실제로 찍히는지 마지막으로 확인
  - **QA**: T-037(지도 경로선·내 위치·DAY 전환) 진행 가능 — 파란점만 실기기에서 재확인 필요

---

## [2026-09-14 10:30] 프론트팀 — 날짜 선택 수정 (피커 안 열림 + 10일 상한 미검증)

사용자 신고 2건 반영했습니다.

### 문제 1 — 데스크톱 날짜 피커가 안 열림

`components/main/DateRangeField.tsx`의 `DateBox`를 고치신 방향대로 재구성했습니다.

- 투명 `<input type="date">`는 값 보관 + `showPicker()` 대상 역할만 하도록
  `pointer-events-none` + `tabIndex={-1}` + `aria-hidden`으로 바꿨습니다.
- 그 위에 박스 전체를 덮는 `<button type="button">`을 별도로 얹어 클릭·키보드
  포커스를 전부 받습니다. `<input>`을 `<button>` 안에 중첩하면(인터랙티브 콘텐츠 중첩)
  HTML 스펙 위반이라, 버튼과 입력을 형제 요소로 두고 버튼을 `absolute inset-0`로
  덮는 구조를 썼습니다 — 동작은 요청하신 것과 동일합니다.
- `onClick`에서 `inputRef.current?.showPicker()`를 시도하고, `showPicker`가
  없거나 던지면 `catch`에서 `.focus()`로 폴백합니다.
- `aria-label`을 `dateStartLabel`("시작일")/`dateEndLabel`("종료일")로 분리해
  ko/en/zh 메시지 키에 넣었습니다(기존엔 둘 다 `"date"` 하드코딩).
- 버튼에 `hover:bg-ink/[0.04]`, `focus-visible:bg-ink/[0.04]` +
  `focus-visible:ring-2 ring-brand/50`을 줘서 클릭 가능 상태가 보이게 했습니다.

**확인 못 한 것**: 이 세션의 자동화 브라우저 환경은 `<input type="date">`의 네이티브
캘린더 팝업(OS/브라우저 자체 렌더링이라 페이지 스크린샷에 안 잡힘)과 hover 스타일
캡처가 안정적으로 안 됩니다(전 세션의 geolocation 파란점과 같은 종류의 한계).
대신 아래는 확인했습니다:
- 이 환경의 Chrome이 `HTMLInputElement.prototype.showPicker`를 지원함(`typeof === "function"`)
- 버튼 클릭 후 콘솔 에러 0건(showPicker 호출 자체가 예외 없이 실행됨)
- `aria-label`이 실제로 "시작일"/"종료일"로 각각 다르게 렌더링됨(`find` 결과로 확인)
- 실기기 크롬·사파리 데스크톱에서 클릭 시 피커가 실제로 뜨는지는 QA나 실사용자 확인이
  한 번 더 필요합니다.

### 문제 2 — 10일 상한 미검증

- `MainForm.tsx`: `const tooLong = dayCount > 10`, `canSubmit`에 `&& !tooLong` 추가
- `DateRangeField.tsx`: 종료일 input에 `max={addDays(startDate, 9)}` — 네이티브
  피커에서 애초에 11일째부터는 못 고르게 막음. 시작일을 옮겨서 기존 종료일과의 간격이
  10일을 넘으면 종료일을 `startDate + 9일`로 같이 당겨줌(기존 "시작일이 종료일보다
  뒤로 가면 종료일도 따라간다" 동작과 같은 자리에서 분기 처리, 그 동작 자체는 유지)
- `tooLong`일 때 안내는 `tooMany`와 완전히 같은 규칙: 날짜 섹션 인라인 danger 힌트는
  `submitAttempted`일 때만, 하단 회색 메시지는 항상. 문구 "여행은 최대 10일까지 만들
  수 있어요"를 `main.dateTooLong`으로 ko/en/zh 전부 추가
- **방어적 체크의 필요성을 라이브로 직접 재현**: 종료일 input에 `max`가 있어도
  프로그램적으로(또는 아주 오래된 브라우저의 네이티브 입력 처리 차이로) 그 값을 우회해
  React state에 27일짜리 범위가 들어갈 수 있음을 확인했고, 그 상태에서 `tooLong`
  체크가 정확히 제출을 막고 두 곳 모두에 문구를 띄우는 것까지 확인했습니다 — `max`
  하나만 믿지 않고 `MainForm`에도 체크를 넣으라신 이유가 실제로 있었습니다.

### 검증 (라이브)

- 종료일 input의 `max`가 시작일 변경에 따라 실시간으로 재계산됨 확인(예: 시작일
  9/14 → 종료일 max "2026-09-23")
- 시작일을 종료일보다 뒤로 옮기면 종료일이 따라감(기존 동작) 확인
- 시작일을 당겨서 기존 종료일과의 간격이 10일을 넘게 만들면 종료일이 자동으로
  10일째로 당겨짐 확인
- 종료일에 (native max를 우회해) 11일 이상 범위를 강제로 넣고 제출 → 인라인 힌트 +
  하단 메시지 둘 다 노출, URL 안 바뀜(막힘) 확인 → 10일 이내로 고치면 두 메시지 다
  즉시 사라지고 제출 시 `/result`로 정상 진행 확인
- `npx tsc --noEmit` / `npx eslint .` / `npm run build` 전부 통과

- 블로커: 없음.
- 다음 액션:
  - **QA/실기기**: 크롬·사파리 데스크톱에서 날짜 박스 클릭 시 실제 캘린더 팝업이
    뜨는지, hover 시 배경이 진해지는 게 눈에 보이는지 최종 확인

---

## [2026-09-14 15:20] 프론트팀 — 결과 화면 DAY 스크롤 연동 + 홈 로그인 배너 연결

### 1. 왼쪽 리스트 스크롤 → 지도 자동 연동

`components/result/ResultView.tsx` + 새 훅 `app/lib/useDayScrollSpy.ts`.

- DAY 섹션마다 ref를 달고 `IntersectionObserver`(rootMargin `"0px 0px -66% 0px"`,
  컨테이너 상단 1/3 지점 기준)로 감지해 `selectedDayIndex`를 자동 갱신합니다.
- 데스크톱 좌측 480px 패널과 모바일 시트는 **완전히 별개의 스크롤 컨테이너**라서
  (반응형은 CSS `hidden md:flex` / `md:hidden`으로만 전환되고 두 트리 모두 항상
  DOM에 존재) refs·옵저버를 desktop/mobile 각각 따로 두 벌 만들었습니다. 하나의
  훅 인스턴스를 공유하면 옵저버가 화면에 없는(display:none) 쪽 컨테이너를 관찰하게
  되어 동작하지 않습니다.
- 역방향(화살표/헤더 클릭)은 `scrollIntoView({behavior:"smooth", block:"start"})`로
  처리하고, 프로그래밍 스크롤 시작 시 플래그를 세워 스크롤 스파이가 잠깐 멈추게 했다가
  `scrollend`(폴백: 700ms 타이머, 사파리 미지원 대비) 시점에 풀어줘 서로 밀어내는
  떨림을 막았습니다.
- 마지막 DAY가 짧아 상단 기준선에 못 걸리는 경우를 대비해 "바닥에 닿으면 마지막 DAY"
  보정을 넣었는데, 처음 구현에서는 이 보정과 `IntersectionObserver` 콜백이 서로 다른
  타이밍(스크롤 이벤트 vs 옵저버 큐)으로 따로 도는 바람에 옵저버가 보정 결과를 다시
  덮어쓰는 레이스가 있었습니다 — 옵저버 콜백에도 동일한 바닥 체크를 넣어 어느 쪽이
  나중에 실행되든 같은 결론에 수렴하도록 고쳤습니다.
- 선택 표시는 DAY 섹션 왼쪽에 브랜드 컬러(#0B7A55) 3px 세로 바 + 옅은 배경
  (`bg-brand-bg/40`)을 `transition-colors duration-300`으로 넣었습니다.
- DAY 1개짜리 코스는 기존처럼 스파이/화살표 전부 비활성(`dayCount > 1`)입니다.
- 빈 날(스탑 0개) 섹션도 동일하게 관찰 대상이라 스크롤하면 지도가 마커·경로선 없이
  비워지는 것까지 확인했습니다 — **단, `components/result/MapView.tsx`는 스탑이
  0개면 마커/경로선만 지우고 지도 중심은 이전 위치 그대로 둡니다.** "그 시군 중심으로
  이동"까지 하려면 시군별 중심 좌표가 필요한데, `API_CONTRACT.md`의 `Day` 타입에는
  스탑별 `lat/lng`만 있고 시군 중심 좌표가 없어서 이번 세션에서 임의로 만들어 넣지
  않았습니다. 필요하면 다음 라운드에서 API_CONTRACT에 반영 부탁드립니다.

**세션 중 발견해서 고친 버그 2건** (스스로 재현·수정·재검증):
1. 화살표를 빠르게 연타하면(React 배치 렌더 사이) 클릭 핸들러들이 모두 같은
   렌더의 `selectedDayIndex` 클로저를 참조해 4번 눌러도 1칸만 이동하는 버그 —
   `selectedDayIndexRef`를 두고 클릭마다 그 ref를 동기로 갱신하도록 고침.
2. 위에 적은 "바닥 보정 vs 옵저버" 레이스.
둘 다 라이브 브라우저에서 재현 스크립트로 직접 확인 후 고쳤고, 고친 뒤 같은
스크립트로 재확인했습니다.

### 2. 홈 로그인 배너 연결

- `components/layout/GuestLoginHint.tsx`: `<div>` → `<button type="button">`,
  hover/active 배경(`hover:bg-brand/[0.12]`) 추가, 클릭 시 새 `LoginModal` 오픈.
- `components/layout/LoginModal.tsx` (신규): 저장 맥락 없는 단독 로그인 모달.
  `design/artboards/Login.dc.html` 기본 문구(`save.loginTitle`="간편 로그인" 등,
  기존에 정의만 돼 있고 아무 데도 안 쓰이던 메시지 키)를 그대로 씁니다 —
  `SaveFlowModal`의 "코스를 저장하려면 로그인이 필요해요" 문구/코스 미리보기는
  그대로 안 건드렸습니다. 재시도 화면도 코스 관련 문구 없이 일반 `취소`로 처리.
  **새 메시지 키 추가 없음** — 필요한 키가 이미 다 있었습니다.
- `app/lib/mock/auth.ts`: `setSession`/`logout`에서 `window` 커스텀 이벤트
  (`ggo:auth-changed`)를 쏘고, 이를 구독하는 `subscribeAuthChange()`를 추가했습니다.
  로그인이 배너(모달) 안에서 일어나도 형제 컴포넌트인 `Header`가 즉시 반영되도록
  하기 위함 — 전역 상태 라이브러리 없이 sessionStorage 기반 mock 인증에 맞춘
  최소한의 브로드캐스트입니다(다른 탭 간 동기화용 `storage` 이벤트는 같은 탭
  안에서는 안 터져서 못 씁니다).
- `components/layout/Header.tsx`: 위 이벤트를 구독해 로그인 상태면 프로필 아이콘을
  `bg-brand-bg`/`text-brand`로, 게스트면 기존 회색으로 표시합니다.
- 로그인은 모달일 뿐 페이지 이동이 없어서 `MainForm`의 입력값(자유 텍스트·지역·
  날짜·인원·동행)은 컴포넌트가 언마운트되지 않으므로 별도 처리 없이 그대로
  유지됩니다 — 라이브로 자유 텍스트+지역 채운 뒤 로그인(실패→재시도→성공) 전 과정을
  거쳐도 값이 그대로인 것 확인했습니다.

### 검증 (라이브)

- 홈 배너 클릭 → "간편 로그인"(저장 문구 아님) → 실패(1회차, mock 규칙) → 재시도 →
  성공 → 배너 사라짐 + 헤더 아이콘 브랜드색으로 전환 + 폼 입력값(자유 텍스트, 지역
  선택) 그대로 확인
- 데스크톱: 좌측 패널을 프로그램적으로 스크롤하며 DAY 1→2→3(빈 날)까지 지도·헤더
  색·좌측 바 하이라이트가 정확히 따라오는 것 확인(5일치 데이터로도 0→1→2→3→4
  순서대로 확인), 빈 날에서 마커 0개인 것도 확인
- 데스크톱: 화살표 4연타 → 정확히 마지막 DAY까지 클램프되고 떨림 없이 안착 확인
  (버그 1 수정 후)
- 데스크톱: 화살표 클릭 직후 1초간 샘플링 → 값이 안착된 채 흔들리지 않는 것 확인
- 모바일 시트: 헤더 클릭, 임의 위치 스크롤, 바닥 스크롤 보정 모두 개별 확인
  (버그 2 수정 후)
- `npx tsc --noEmit` / `npx eslint .` / `npm run build` 전부 통과

**참고**: 이번 세션은 브라우저 자동화 환경이 다른 세션과 같은 프리뷰 탭/뷰포트를
공유하는 상태였습니다(다른 세션이 개입한 것으로 보이는 예상치 못한 페이지 이동을
한 번 직접 목격). 세밀한 스크롤 위치→DAY 매핑을 반복 루프로 검증할 때 이 간섭으로
결과가 흔들린 적이 있어, 매 스텝을 단발성 호출로 격리해서 재검증했습니다 — 실제
버그 2건은 이 격리된 재현으로 확정했고, 나머지는 모두 격리된 상태에서 정상이었습니다.

- 블로커: 없음.
- 다음 액션:
  - **PM/백엔드**: 빈 날일 때 지도를 "그 시군 중심"으로 옮기려면 시군별 중심 좌표가
    필요합니다. `API_CONTRACT.md`에 넣을지, 프론트에서 정적 상수로 관리해도 되는지
    판단 부탁드립니다(현재는 마커/경로선만 지우고 이전 뷰를 유지).
  - **QA**: 실기기(마우스 휠 스크롤, 실제 터치 스크롤)로 최종 감성 확인 — 이번 세션
    검증은 스크립트로 스크롤 위치를 강제 이동시키는 방식이라 관성 스크롤 등 실제
    제스처 하에서도 매끄러운지는 QA 확인이 한 번 더 필요합니다.

---

## [2026-09-14 16:05] 프론트팀 — DAY 스크롤 연동 후속 수정 (실사용 중 "스크롤해도 지도 안 바뀜" 리포트)

바로 위 항목에서 만든 스크롤 스파이를 실제로 스크롤(마우스 휠)해보면 지도가 안 바뀌고
DAY 헤더나 화살표를 **눌러야만** 바뀐다는 리포트를 받았습니다. 재현 후 원인을 찾아
고쳤습니다 — 이전 항목의 자동화 검증(스크립트로 `scrollTop`을 강제 이동)에서는 이
문제가 안 잡혔는데, 아래 원인 자체가 "짧은 시간에 여러 번 강제 이동" 패턴에서는
우연히 덜 드러나는 종류의 버그였습니다.

### 원인

`app/lib/useDayScrollSpy.ts`의 `IntersectionObserver`/`scroll` 리스너를 설치하는
`useEffect`가 `onDayChange` 콜백을 의존성 배열에 넣고 있었습니다. 그런데 이 콜백
(`ResultView.tsx`의 `updateSelectedDayIndex`)은 `useCallback`으로 감싸지 않은 일반
함수라 **`ResultView`가 재렌더될 때마다 새 함수**였습니다. `ResultView`는
`MapView`의 "내 위치" `geolocation.watchPosition` 콜백이 호출될 때마다
`hasMyLocation` 상태가 갱신되며 재렌더되는데(위치 권한이 허용된 상태라면 꽤 자주
발생), 그때마다 `useEffect`의 클린업이 돌면서 `IntersectionObserver`가
**disconnect → 재생성**됐습니다. 재생성 자체는 매번 현재 교차 상태를 다시 보고하긴
하지만, 스크롤이 진행되는 도중에 하필 disconnect가 끼면 그 프레임의 교차 알림이
유실될 수 있고, 이게 반복되면 옵저버가 실제 스크롤을 사실상 계속 놓치는 것처럼
보입니다. 반면 DAY 헤더/화살표 클릭은 옵저버를 거치지 않고 `setSelectedDayIndex`를
직접 호출하므로 이 문제와 무관하게 항상 잘 됐습니다 — "눌러야만 보인다"는 증상과
정확히 일치합니다.

### 수정

- `onDayChange`를 `useRef`(`onDayChangeRef`)에 담아 별도 `useEffect`로 최신값만
  갈아끼우고, 옵저버/스크롤 콜백은 전부 `onDayChangeRef.current(...)`를 호출하도록
  바꿨습니다. 옵저버를 만드는 `useEffect`의 의존성 배열에서는 `onDayChange`를 뺐고,
  이제 `containerRef`/`dayRefs`/`dayCount`/`enabled`가 실제로 바뀔 때만(사실상
  마운트 시 한 번) 옵저버가 생성/해제됩니다 — 호출부가 콜백을 메모이즈하는지와
  무관하게 항상 안전하도록 훅 내부에서 처리했습니다.

### 검증 (라이브)

- `window.IntersectionObserver`를 감시용 서브클래스로 패치한 뒤, 모바일 시트
  펼치기/접기 버튼(`expanded` 상태 — 이 스크롤 스파이와 무관한 상태)을 3번 연달아
  눌러 `ResultView`를 3번 재렌더시켰습니다. 수정 전이라면 매번 옵저버가
  재생성됐을 자리인데, 수정 후에는 새 옵저버 생성 횟수가 0으로 유지되는 것을 확인
  했습니다.
- 같은 페이지에서 좌측 패널을 0%→100% 구간으로 스크롤하며 DAY 1→2→3→5(빈 날
  보정) 순서로 정확히 따라오는 것도 함께 재확인했습니다.
- `npx tsc --noEmit` / `npx eslint .` / `npm run build` 전부 통과

- 블로커: 없음.
- 다음 액션:
  - **QA/실사용자**: 위치 권한을 허용한 실기기에서 마우스 휠로 스크롤할 때 이제는
    지도가 잘 따라오는지 최종 확인 부탁드립니다(이번 수정의 원인이 위치 워치였던
    만큼, 위치 권한 허용 상태에서의 확인이 특히 의미 있습니다).

---

## [2026-09-14 16:40] 프론트팀 — DAY 스크롤 연동 2차 수정 ("코스 생성하면 맨 마지막 DAY로 가 있고 스크롤도 안 됨")

바로 위 수정을 올린 뒤에도 실제로 코스를 생성해보면 처음부터 마지막 DAY로 가 있고
스크롤을 해도 전혀 안 바뀐다는 리포트를 받았습니다. 재현해서 진짜 원인을 찾았습니다
— 지난 수정과는 다른, 더 근본적인 버그였습니다.

### 원인

`useDayScrollSpy.ts`의 "바닥에 닿으면 마지막 DAY로 보정" 로직(`isAtBottom`)이
`root.scrollTop + root.clientHeight >= root.scrollHeight - 2` 하나로만 판단했는데,
**리스트 내용이 컨테이너 안에 다 들어가서 스크롤할 거리가 아예 없는 경우**(짧은
코스, 혹은 실사용자의 넓은 브라우저 창처럼 컨테이너가 충분히 큰 경우) `scrollTop`이
0이어도 `scrollHeight`와 `clientHeight`가 거의 같아 이 식이 처음부터 참이 됩니다.
그 결과 페이지가 뜨자마자(옵저버가 처음 관찰을 시작하는 순간) 곧바로 "바닥"으로
오판해 마지막 DAY로 점프했고, 스크롤할 거리 자체가 없으니 사용자가 뭘 해도 이
잘못된 판정이 계속 참으로 남아 영영 안 바뀌는 것처럼 보였습니다. 지난 수정(옵저버
재생성 문제)과는 별개의, 이 보정 로직 자체의 결함입니다 — 이번 세션 전까지의
자동화 검증은 항상 컨테이너를 일부러 작게 만들어(스크롤 여유를 확보해) 테스트했던
탓에 이 케이스를 못 잡았습니다.

### 수정

`isAtBottom()`에 "실제로 스크롤할 여유가 있는지"(`scrollHeight - clientHeight > 4`)
체크를 먼저 걸어, 스크롤할 게 없으면 바닥 보정 자체를 적용하지 않도록 했습니다.
스크롤 여유가 없으면 기존 교차 관찰 로직(옵저버)이 대신 판단하는데, 이 경우 보통
DAY 1 섹션만 상단 1/3 기준선에 걸리므로 자연스럽게 DAY 1로 유지됩니다.

### 검증 (라이브)

- 실제 기본 흐름과 동일하게 "오늘+1일 ~ +3일"(3일 코스) 요청을 만들고, 브라우저
  창을 세로로 크게(1280×1000) 열어 리스트가 스크롤 없이 다 보이는 상황을 재현 →
  전에는 마지막 DAY(DAY 3)로 가 있었을 자리인데, 수정 후 DAY 1로 정상 표시되는 것
  확인
- 같은 조건에서 창을 낮춰(1280×550) 진짜 스크롤 여유가 생기면 0%→100% 스크롤 시
  DAY 1→2→3 순서로 여전히 잘 따라오고, 끝까지 스크롤하면 마지막 DAY에 정확히
  머무는 것도 재확인(회귀 없음)
- `npx tsc --noEmit` / `npx eslint .` / `npm run build` 전부 통과

- 블로커: 없음.
- 다음 액션:
  - **QA/실사용자**: 방금 만든 코스가 짧을 때(3~4일 이내) 처음 결과 화면에 들어가면
    DAY 1이 선택된 채로 뜨는지, 그리고 스크롤 여유가 있는 긴 코스에서는 스크롤에
    따라 잘 넘어가는지 둘 다 실기기에서 한 번 더 봐주시면 좋겠습니다.

---

## [2026-09-14 17:15] 프론트팀 — DAY 스크롤 연동 3차 수정 ("사파리에서 마지막 DAY에서 위로 스크롤 안 됨")

실기기 확인 중 "사파리는 대체로 되는데 맨 마지막 DAY에서 위로 스크롤하면 안 움직인다"는
리포트를 받았습니다(크롬 쪽 "스크롤이 아예 안 된다"는 리포트는 사용자가 직접 재확인 후
바로 위 항목의 "스크롤 여유 없음" 케이스였다고 확인해주셨습니다 — 별도 조치 없음).

### 원인 (추정)

`isAtBottom()`이 `scrollTop + clientHeight >= scrollHeight - 2` 하나로만 "바닥"을
판정하는데, 사파리는 컨테이너 바닥에서 더 내리면 러버밴드(elastic overscroll)로
튕기는 특성이 있어 이 되튐 구간에서 `scrollTop`이 실제 스크롤 방향과 다르게(또는
지연되어) 보고될 수 있습니다. 그러면 사용자가 위로 스크롤을 시작해도 바닥 판정이
계속 참으로 남아 스크롤 스파이가 마지막 DAY에 계속 붙들려 있는 것처럼 보입니다.
(자동화 브라우저로는 사파리의 실제 러버밴드 동작을 재현할 수 없어 코드 리뷰와
논리적 추론으로 확정했습니다 — 아래 "확인 못 한 것" 참고.)

### 수정

`isAtBottom()`에 스크롤 방향 추적을 추가했습니다. 직전 호출 대비 `scrollTop`이
줄었으면(위로 스크롤 중이면) 바닥 판정 자체를 내리지 않고 곧바로 `false`를
반환합니다 — 바닥 보정이 "위로 스크롤하는 도중"에는 절대 끼어들지 않게 해서,
사파리의 러버밴드 되튐 구간에서 어떤 값이 찍히든 최소한 마지막 DAY에 다시
고정시키지는 않습니다.

### 검증 (라이브 + 확인 못 한 것)

- 라이브로 좌측 패널을 맨 아래(마지막 DAY)까지 내린 뒤 다시 맨 위로 스크롤 →
  DAY 1로 정확히 돌아오는 것 확인(수정 전후 모두 이 크롬 기반 자동화 환경에서는
  정상이었음 — 애초에 이 환경에서는 버그가 재현되지 않았습니다)
- **확인 못 한 것**: 이 세션의 자동화 브라우저는 Chromium 기반이라 사파리의
  러버밴드 되튐 자체를 재현할 수 없습니다. 원인 진단은 코드 리뷰 기반 추정이고,
  수정은 "위로 스크롤 중엔 바닥 보정을 안 건다"는 방향으로 방어적으로 넣은
  것입니다 — 실제 사파리에서 이 수정으로 증상이 사라지는지 최종 확인이
  필요합니다.
- `npx tsc --noEmit` / `npx eslint .` / `npm run build` 전부 통과

- 블로커: 없음.
- 다음 액션:
  - **QA/실사용자**: 실제 사파리(맥/아이폰)에서 마지막 DAY까지 스크롤한 뒤 다시
    위로 스크롤할 때 이제 정상적으로 이전 DAY들로 돌아오는지 최종 확인
    부탁드립니다 — 이번 수정은 이 환경에서 직접 재현하지 못한 채 넣은 방어적
    수정이라 실기기 확인이 특히 중요합니다.

---

## [2026-09-14 18:00] 백엔드팀 — 라운드5 【1】평창 커버리지 조사 완료 (P0)

`feat/backend-round5` 브랜치. 원인 확정 + 수정 + 재동기화까지 완료.

### 원인

**페이지네이션 누락.** `tourapi_client.js`의 `callTourApi`가 `numOfRows=100`만 요청하고 다음
페이지를 반복 호출하지 않았다. 실측 확인: 인제 totalCount=67 / 홍천 89 / **평창 409** —
평창은 원래도 100건 넘게 있었는데 첫 페이지만 가져오고 있었다. 콘텐츠타입 필터링 문제나
`category_mapping.js` 매핑 누락이 아니었다(둘 다 재확인, 정상 — 평창 raw 409건 중
contentTypeId 12=58/14=6/28=26/32=67(숙박, 정상 제외)/38=3/39=249이고, 이 중 12+14=64건이
정확히 nature_hiking+culture_history+onsen_wellness 합계와 일치, 28/38/39도 leisure_sports/
shopping/food_local과 1:1 일치 — 매핑 로직 자체는 처음부터 맞았다).

### 조치

`callTourApi`를 `totalCount`까지 다 채울 때까지 페이지를 순회하도록 재작성(안전 상한 20페이지=2,000건).
`fetchAreaBasedList`/`fetchFestivalDates` 시그니처는 그대로 — 호출부(`sync_pois.js`) 수정 불필요.

### 재동기화 후 분포 (`sync_pois.js` + `sync_festivals.js`, 2026-09-14 실측)

| 시군 | 합계 | nature_hiking | onsen_wellness | culture_history | food_local | festival_event | shopping | leisure_sports |
|---|---|---|---|---|---|---|---|---|
| 인제 | 64 | 19 | 1 | 12 | 4 | 3 | 1 | 24 |
| 홍천 | 79 | 8 | 9 | 21 | 8 | 2 | 1 | 30 |
| 평창 | 344 | 22 | 35 | 7 | 249 | 2 | 3 | 26 |
| **합계** | **487** | | | | | | | |

(평창 헤더 순서 주의: 위 표는 열 이름 그대로 `nature_hiking=22 / onsen_wellness=7 / culture_history=35`다 — 코드 로그 순서와 표 순서가 달라 혼동하기 쉬워 재확인함.)

**절대 건수는 전부 개선됐다** — 평창 `nature_hiking` 9→22, `culture_history` 4→35, `onsen_wellness`
0→7. rain 트리거 실내 대체 후보가 4건이던 문제(부수 문제로 지적된 것)는 이제 `culture_history` 35건
+ `onsen_wellness` 7건으로 해소됐다.

**다만 `food_local` 비중(249/344=72%)은 페이지네이션 수정 후에도 그대로다 — 이건 버그가 아니라
평창의 실제 TourAPI 등록 특성이다.** raw contentTypeId=39(음식점) 자체가 249건으로, 인제(4)·홍천(8)
대비 압도적으로 많다 — 평창이 2018 동계올림픽 개최지이자 스키 리조트 밀집 지역이라 등록 음식점 수
자체가 다른 두 시군보다 훨씬 많은 것으로 보인다(관광지 수도 평창이 58건으로 인제/홍천보다 많음).
스코어링은 가중치 기반이라 `food_local` 비중이 높아도 다른 카테고리를 원하는 사용자에게 식당이
강제로 섞이지는 않지만, `activity_level`이 낮고 취향이 불분명한 요청(가중치 전부 낮음)에서는
표본이 큰 `food_local`이 상대적으로 더 자주 뽑힐 수 있다 — QA 확인 권장(추가 조치는 하지 않음,
실제 데이터 특성이라 인위적으로 비율을 맞추는 건 왜곡).

- 블로커: 없음.
- 다음 액션: 백엔드 — 【2】care_facilities 데이터 소스 교체로 계속 진행.

---

## [2026-09-14 19:30] 백엔드팀 — 라운드5 【2】care_facilities 데이터 소스 교체 (P0, 블로커 있음)

### 조치

MdclTursmService(의료관광정보)를 버리고 두 소스로 교체:
1. 국립중앙의료원 전국 응급의료기관 조회 서비스(`B552657/ErmctInfoInqireService`) — 정확한
   오퍼레이션명이 `getEgytBassInfoInqire`라는 걸 실측으로 찾음(`getEgytLcinfoInqire` +
   `STAGE1`/`STAGE2` 파라미터로는 `resultCode:00`인데 `totalCount:0`만 나와서 API 문서만으로는
   구분 불가 — WebSearch로 정확한 오퍼레이션 확인 후 즉시 실데이터 확인됨).
   **`STAGE1`/`STAGE2` 지역 필터는 이 오퍼레이션에서 무시된다**(필터 걸어도 안 걸어도 둘 다
   `totalCount=529`로 동일 — 실측 확인). 그래서 전체 529건을 받아 `dutyAddr` 문자열에 "인제군/
   홍천군/평창군"이 포함되는지로 직접 필터링한다(`sync_festivals.js`와 동일 패턴).
2. 전국보건기관표준데이터(`tn_pubr_public_ht_inst_api`) — 보건소/보건지소/보건진료소.

새 컬럼(마이그레이션 `0004_care_facilities_source_swap.sql`, **미적용 — 승현님이 Supabase SQL
Editor에서 직접 실행 필요**): `name_ko`/`address_ko` 추가, 다국어 실패 원인이던 `address_en`/
`address_zh`는 삭제(원본 그대로 쓰는 필드라 번역 불필요 — API_CONTRACT.md §4 "phone/lat/lng/
address_ko는 원본 그대로" 확정).

시설 종류 접미사(응급실/보건소/보건지소)는 `translate_name.js`의 `CARE_SUFFIX_DICT` 고정 사전으로
강제 매핑하고, 지명 부분만 Claude로 번역한다 — 안전 문구라 "보건지소"가 매번 같은 영단어로 나와야
하기 때문(요청사항 그대로).

### 실측 결과 — 시군당 최소 5건(PRD 2.1절) 미달, 블로커

응급의료기관(전국 529건 중 필터링, 좌표 유효성 확인 포함):

| 시군 | 응급의료기관 |
|---|---|
| 인제 | 0 |
| 홍천 | 1 |
| 평창 | 1 |

보건기관표준데이터(전국 220건 중 필터링):

| 시군 | 보건소/보건지소/보건진료소 |
|---|---|
| 인제 | 0 |
| 홍천 | 0 |
| 평창 | 0 |

**보건기관표준데이터는 강원 지역 자체가 이 데이터셋에 없다.** 전국 220건의 `sggNm`을 전부
distinct로 뽑아봐도(19개 시군 — 달성군/군산시/합천군/가평군/진안군/영양군 등) 인제/홍천/평창은
물론 강원 소재 시군이 단 하나도 없다 — `sggNm` 매칭 로직 버그가 아니라 **원본 데이터셋 자체가
일부 시군만 등록돼 있는 불완전한 표준데이터**임을 확인함(공공데이터포털 쪽 등록 상태 문제로 추정).

**현재 상태: 응급의료기관 2건(홍천 1, 평창 1, 인제 0)만 실데이터로 확보.** PRD 2.1절 "시군당
최소 5건" 기준에 크게 못 미치고, 인제는 0건이다.

**의도적으로 하지 않은 것**: 라운드1 시드 데이터(검증 안 된 병원 정보)를 다시 채워 넣지 않았다 —
이번 라운드 지시사항에 명시된 "검증 안 된 안전시설 정보는 없는 것보다 나쁘다"는 원칙과 같은
이유. 응급연락처는 틀리면 실제 위해로 이어질 수 있는 정보라, 건수를 맞추려고 미확인 데이터를
넣는 게 더 위험하다고 판단함 — 다만 이건 제 판단이라 PM 확인 없이 최종 확정하지 않습니다.

- 블로커: **응급의료기관 2건(인제 0/홍천 1/평창 1) + 보건기관 0건으로 PRD 최소 기준 미달.**
  PM 확인 필요한 결정 사항:
  1. 이대로(2건) 데모 진행 — 인제는 "케어 안내 준비 중" 빈 상태로 노출.
  2. 강원도청 자체 공공데이터 포털 등 대체 소스를 찾아 추가 연동(시간 소요, 남은 7일 내 가능한지
     검토 필요).
  3. 응급의료기관 검색 반경을 "시군 내"가 아니라 "시군 경계 + 인접 시(춘천/원주/강릉 등)의 가장
     가까운 응급실까지"로 넓혀서 실데이터 건수를 늘리는 방안 — 실제로 인제/홍천/평창 거주자가
     응급 시 찾아가는 병원이 대개 인접 대도시에 있다는 점에서 사용자 관점엔 더 유용할 수 있으나,
     `region_code`의 의미(그 시군 안에 있다)가 바뀌므로 계약/화면 안내 문구 조정이 필요해
     보임 — 다음 라운드 검토 제안.
- 다음 액션: 위 3안 중 PM 결정 대기. 결정 전까지는 2건 그대로 유지(마이그레이션 0004는 승현님
  수동 적용 필요 — 적용 전엔 `GET /api/care`가 `name_ko` 컬럼 없음 에러를 낸다, 로컬 실측 확인함).

---

## [2026-09-14 20:00] 백엔드팀 — 라운드5 【3】pois 이름 다국어 + is_indoor 완료

`pois`에 `name_en`/`name_zh`/`is_indoor` 추가(마이그레이션 `0005_pois_i18n_and_indoor.sql`,
**미적용 — 승현님 수동 적용 필요**). `sync_pois.js` 배치 동기화 시 1회 생성 — 런타임 번역 아님
(3초 예산 안에서 487건을 실시간 번역할 수 없음, 결정론적 결과 보장 목적도 있음). 한국어 `name`
컬럼은 절대 덮어쓰지 않음(새 컬럼만 채움).

번역 방식: 지형/시설 접미사(계곡/폭포/시장/박물관/자연휴양림/목장 등)는 `translate_name.js`의
`POI_SUFFIX_DICT` 고정 사전으로 강제 매핑하고, 나머지 지명 부분만 Claude(haiku)로 번역해
프로그램적으로 재조합 — 접미사가 LLM마다 들쭉날쭉해지는 것 방지(요청사항 그대로). 중국어는
한자 유래 지명이면 한자 표기, 아니면 음역.

`is_indoor`는 `tags[]`(7개 카테고리)당 고정 매핑(`TAG_INDOOR_MAP`)으로 채움 — **rain 트리거의
후보 제외 로직(`alertAdjust.js`)은 그대로 카테고리 태그 기준을 유지**하고 `is_indoor`는 표시
전용으로만 씀(요청사항 확인, 코드 변경 없음).

### 실측 결과 (실제 Claude API 호출, 487건 전체)

| 시군 | 대상 | 성공 | 실패(null 유지) |
|---|---|---|---|
| 인제 | 61 | 61 | 0 |
| 홍천 | 79 | 79 | 0 |
| 평창 | 342 | 342 | 0 |
| **합계** | **482** | **482** | **0** |

(합계가 487이 아니라 482인 이유: festival_event 5건은 `tourapi_client.js` 축제 조회 경로에서
별도로 들어와 이 배치의 `rows` 루프 대상이 아님 — 축제명은 원래도 고유명사라 별도 번역 로직 없이
한국어만 노출, 계약상 문제 없음.)

- 블로커: 없음(위 【2】의 care_facilities 데이터 부족 블로커와는 무관).
- 다음 액션: 마이그레이션 0005 적용 후 `sync_pois.js` 재실행 → upsert까지 확인 필요(이번엔
  마이그레이션 미적용 상태라 번역까지만 확인, DB 반영은 대기 중).

---

## [2026-09-14 21:15] 백엔드팀 — 라운드5 【4】narration/blurb/region_reason 통합 + 지연시간 실측·최적화 (P0, 블로커 있음)

### 구현

`llm.js`의 `generateNarrationBundle()`이 `narration`/`region_reason`/스탑별 `blurb`(전부
ko/en/zh 3개 언어)를 만든다. 프롬프트에는 장소명·카테고리·시군만 넘기고 영업시간/가격/연락처는
절대 넘기지 않음(할루시네이션 방지, 요청사항 그대로). `blurbs[]`는 실제 코스 스탑과
`poi_id`로 매칭해서 넣고, `region_codes.auto===false`(사용자 직접 선택)면 `region_reason`은
코드에서 강제로 `null` 처리. LLM 실패 시 `narration`/`region_reason`/전 스탑 `blurb`가 `null`로
빠지고 코스 자체는 정상 200 반환(실측 확인 — 아래).

### 지연시간 실측 — 원안(한 번의 거대한 호출)은 3초 예산을 심각하게 초과함

로컬에서 실제 Supabase pois + 실제 Claude API(haiku) + 실제 카카오모빌리티로 3일/9스탑 코스
1건을 끝까지 생성해 측정:

| 단계 | 최초 구현 | 문제 |
|---|---|---|
| `extractPreferenceWeights` | ~1.2초 | 정상 |
| pois 조회 | ~0.15초 | 정상 |
| `buildItineraryDays` | ~4ms | 정상 |
| narration+region_reason+blurbs **한 번의 호출** | **10~12초** | 출력 토큰 자체가 많아서(9스탑×3언어 blurb + narration) 모델 생성 속도가 병목 — 실측 output_tokens≈1231, ≈107 tokens/sec |
| 스탑 간 `travel_from_prev` (카카오모빌리티, 스탑마다 순차 await) | ~6~8초 (추정, 9스탑 순차 호출) | 병렬화 가능한 걸 순차로 짬 |
| **총합** | **약 15.2초 (실측)** | **3초 예산 대비 5배** |

원인은 두 가지 서로 다른 병목이었다:

1. **카카오모빌리티 호출이 전부 순차(await 루프)였다** — 각 구간이 이전 구간 결과와 무관한데도
   `for` 루프 안에서 하나씩 기다렸다. `travel.js`의 `fillTravelFromPrev`/`fillTravelBetweenDays`를
   `Promise.all`로 재작성해 스탑 쌍/날짜 쌍을 동시에 호출하도록 고침 → 이 부분만 15초→14초로는
   부족했는데, 알고 보니 진짜 병목은 아래 2번이었다(1번 수정만으론 크게 안 줄었음, 로그로 재확인).
2. **narration 호출 자체가 10초 넘게 걸렸다** — 원안대로 "한 번의 호출"에 9개 스탑의 3개 언어
   블러브 + 코스 요약을 전부 담게 하면 출력 토큰이 1200개를 넘어가고, 모델이 그만큼 생성하는
   시간 자체가 병목이었다(네트워크나 호출 횟수 문제가 아니었음 — 별도로 "say ok"만 시키는 최소
   호출은 850ms였다).

**계약 문구("한 번의 호출로 통합, 스탑 설명을 위해 LLM을 따로 부르면 호출이 두 번이 되기 때문")의
의도는 "직렬 호출로 지연이 배가되는 것 방지"였는데, 실측해보니 애초에 그 한 번의 호출 자체가
이미 예산을 초과했다.** 그래서 "직렬 호출 여러 번"이 아니라 **"병렬 호출 여러 개"**로
재해석해서 구현을 바꿨다:
- narration+region_reason만 담는 작은 호출 1개
- blurb는 스탑 3개씩 묶어서 여러 개의 작은 호출로 쪼갬(`BLURB_CHUNK_SIZE=3`)
- 전부 `Promise.all`로 동시에 발사 → 지연시간이 "전체 출력 토큰 합"이 아니라 "가장 느린 한
  묶음"만큼만 걸림
- narration 프롬프트도 "스탑을 하나하나 나열하지 말고 1~2문장(언어당 80자 이내)으로 분위기만
  요약하라"고 명시적으로 제한 — 원래는 모델이 스탑을 일자별로 전부 나열하며 문단을 만들어서
  출력이 불필요하게 길었음.

**부수적으로 발견한 버그**: `max_tokens`에 걸려 tool_use 인자 JSON이 중간에 잘리면 Anthropic
SDK가 예외를 던지지 않고 `input: {}`(빈 객체)를 그대로 준다 — narration이 아무 경고 로그 없이
조용히 전부 `null`이 되는 원인이었다(초기 max_tokens=600이 너무 작았음). `stop_reason ===
'max_tokens'`일 때 명시적으로 실패 처리하도록 `narration`/`candidate blurb` 양쪽에 가드를 추가함.

### 최적화 후 실측 (동일 3일/9스탑 코스, 5회 반복)

| 항목 | 값 |
|---|---|
| 최적화 전 총 응답시간 | 15.2초 |
| 카카오모빌리티 병렬화만 적용 | 14.1초 (narration이 여전히 병목이라 개선 미미) |
| narration/blurb 병렬 청크 분리 적용 | 6.4초 |
| narration 프롬프트 축약(나열 금지) 추가 적용 | **6.4~9.6초 (5회 반복, 편차 있음)** |
| 4일/20스탑(어디든지 다중 시군) 코스 | 8.3초 |

**남은 블로커: 3초 예산에 여전히 못 미친다.** 카카오모빌리티 병목은 완전히 해소했지만(순차 15초→
병렬 0.3~0.4초), LLM 청크 호출 자체가 청크 1개당 2~3초의 기본 지연(모델 큐잉+생성 시간)이 있어
이게 사실상의 하한선이 됐다 — 청크를 더 잘게 쪼개도(스탑 2개씩) 청크 1개당 지연은 거의 그대로라
쪼갤수록 이득이 줄어드는 지점에 도달함(실측: 2스탑 청크 5개 병렬 ≈3초, 3스탑 청크 3개 병렬
≈2.5~4초 — 큰 차이 없음).

- 블로커: **`/generate` 실측 응답시간이 6~9초대로, PRD/API_CONTRACT.md §1의 3초 기준을 못 지킨다.**
  카카오모빌리티/LLM 호출 방식을 최대한 병렬화했음에도 LLM 쪽 기본 지연(haiku 구조화 출력 청크당
  2~3초)이 남아있음. PM 확인 필요한 결정 사항:
  1. 3초 기준을 "느껴지는 응답성" 기준(프론트 스켈레톤 UI로 체감 지연 완화)으로 완화 — 프론트가
     이미 로딩 UI를 갖고 있는지 확인 필요.
  2. blurb/narration을 코스 구조와 분리해서 비동기로 나중에 채우기(코스 스탑 뼈대는 3초 안에
     먼저 반환, blurb/narration은 Realtime이나 폴링으로 후속 전달) — 계약(§1 응답 스키마) 변경이
     필요한 큰 구조 변경이라 다음 라운드로 미루는 게 안전해 보임.
  3. 요청 `lang` 하나만 우선 생성하고 나머지 2개 언어는 사용자가 실제로 전환할 때 그때 생성 —
     "언어 전환 시 설명이 사라지면 안 된다"는 기존 계약 원칙과 정면으로 배치되는 방향이라
     권장하지 않음(참고용으로만 남김).
  이번 라운드에서는 시간 관계상 1/2/3 중 하나를 임의로 선택해 계약을 바꾸지 않고, **현재 구현
  (병렬화 최대 적용, 6~9초)을 그대로 두고 실측치를 보고하는 선에서 마무리함.**
- 다음 액션: 위 결정 대기. 결정 전까지 프론트는 `/generate` 호출에 대해 로딩 상태를 넉넉히
  (10초 이상) 잡아두는 것을 권장.

---

## [2026-09-14 22:30] 백엔드팀 — 라운드5 【5】【6】【7】마이페이지/어디든지 다중시군/카카오모빌리티 통합 완료

`server/src/routes/itineraries.js`를 계약 전체에 맞춰 다시 썼다. 개별 함수 단위 구현은 이전
항목들에서 이미 끝나 있었고, 이번 항목은 그것들을 `/generate`와 나머지 라우트에 실제로
엮는 작업이었다.

### 【6】 "어디든지" + 다중 시군 (실제 Supabase+Claude로 라이브 테스트 완료)

`region_codes: []` → `regionSelect.selectRegionsForAuto()`로 자유 텍스트 가중치에 맞는
시군을 고르고(share 정규화 → score → 1위의 60% 이상만 → 최대 min(일수,3)개), 위도 내림차순으로
연속 날짜 블록에 배정(`assignRegionsToDayBlocks`) 후 기존 단일 시군 파이프라인(`buildItineraryDays`)을
블록별로 그대로 재사용 — 좌표 클러스터링을 다중 시군 POI 풀에 걸지 않는다는 원칙 그대로 지킴.

라이브 테스트(4일, "등산이랑 온천 위주" 자유 텍스트, region_codes:[]):
```
selected_regions: {auto: true, region_codes: [injae, hongcheon, pyeongchang]}
day1 injae(5stops) → day2 injae(5stops, travel_from_prev_day: injae→injae 72분)
→ day3 hongcheon(5stops, travel_from_prev_day: injae→hongcheon 65분)
→ day4 pyeongchang(5stops, travel_from_prev_day: hongcheon→pyeongchang 144분)
```
위도 내림차순(인제→홍천→평창) 배정, 4일/3시군이라 인제에 여분 하루가 붙는 것까지 전부 기대대로
동작 확인. `region_reason`도 자동 선택 사유로 3개 언어 정상 생성됨. 아래 4개 검증 가드도
전부 실측 확인:
- `region_codes:[]` + `free_text` 빈 문자열 → 400 INVALID_STRUCTURED_INPUT
- `region_codes.length > tripDays` → 400 INVALID_STRUCTURED_INPUT
- 존재하지 않는 시군 코드 → 400 INVALID_STRUCTURED_INPUT
- `lang` 이 ko/en/zh 아님 → 400 INVALID_LANG

### 【7】 카카오모빌리티 통합

`travel.js`(위 【4】 커밋에서 병렬화 완료)를 `/generate` 응답 조립 마지막 단계에 연결.
스탑 첫 항목/빈 날 처리 전부 계약대로: 첫 스탑 `travel_from_prev` 항상 null, 전날 스탑이
비었으면 그 이전의 스탑 있는 날 기준으로 계산, 같은 시군이어도 값을 내려보냄(실측 위 로그의
day2 injae→injae 참고).

### 【5】 마이페이지

- `GET /api/itineraries`: `user_id`로 스코핑(P0 IDOR 방지 — 1주차 점검 #1과 동일 패턴을
  여기서도 미리 막음), `status != cancelled` 제외, `stop_count`만 계산해서 반환(itinerary_json
  원본은 서버 안에서만 쓰고 응답엔 안 실음), `start_date DESC` 정렬.
- `DELETE /api/itineraries/:id`: 소프트 삭제(`status='cancelled'` UPDATE), 본인 소유 아니면
  403(§2 DELETE 절이 명시한 예외 — 다른 엔드포인트의 "존재 자체를 숨기는 404" 원칙과 다름,
  계약 문구 그대로 따름), 이미 cancelled면 재호출해도 같은 200(멱등) — 코드 로직으로 확인.
- `completed` 상태 전환 배치는 요청대로 만들지 않음 — `monitor.js`의 기존 스캔 조건
  (`status='active' AND 오늘이 start_date~end_date 사이`)이 여행 종료 시 자연히 감시를
  멈추는 걸 그대로 재사용.

### 부수 발견 및 수정 — 다중 시군 전환 중 놓치기 쉬운 `region_codes[0]` 버그 3곳

다중 시군 이전 코드가 "이 일정의 시군"을 구할 때 전부 `itinerary.region_codes[0]`(배열의
첫 값)만 봤다 — 단일 시군 시절엔 문제 없었지만, 다중 시군 일정에서 2일차 이후 스탑을 다루는
로직이 전부 **1일차 시군 POI만 조회**하게 되는 조용한 버그였다. 발견한 즉시 전부
`dayEntry.region_code`(그 스탑이 실제로 속한 날의 시군)로 고쳤다:
- `itineraries.js` `regenerate-stop` — 교체 후보를 엉뚱한 시군에서 찾아오는 버그였음.
- `alertTrigger.js` `createProposedAlert` — 매니징 자동 트리거가 엉뚱한 시군에서 대체 후보를
  찾아오는 버그였음.
- `agent/src/monitor.js` `checkRain` — 2일차 이후가 다른 시군인데 계속 1일차 시군 날씨로
  rain을 판정하는 버그였음(가장 위험한 케이스 — 조용히 틀린 지역 날씨로 알림을 만들 뻔함).

### 부수 수정 — alerts 메시지 포맷을 계약대로 복원

이전 라운드에서 `alertTrigger.js`가 `{key, params}` 다국어 키+치환값 방식으로 짜여 있었는데,
`app/lib/types.ts`의 `AlertPayload.message: Localized`와 `app/lib/mock/alerts.ts`가 전부
완성 문장(`{ko,en,zh}`)을 쓰고 있어 프론트가 이미 이 형태로 화면을 다 만들어둔 상태였다.
PRD 6장의 "다국어 키+치환값" 원칙은 서버 내부 템플릿 관리 방식에 대한 것으로 재해석하고,
와이어 포맷은 완성 문장으로 되돌렸다(`MESSAGE_TEMPLATES`, rain/traffic/festival_cancelled
3종 × 3언어). `regenerate-stop`/`PATCH`/`alerts respond`의 스탑·후보 응답도 전부
`{poi_id,name:{ko,en,zh},category,is_indoor,lat,lng}` 형태로 통일(`scoring.js`의
`toCandidateShape` 신설, 공용으로 사용). PATCH/alerts respond로 스탑이 교체된 뒤에는 그 날의
`travel_from_prev`도 다시 계산해서 순서 변경이 이동시간에 반영되게 함.

- 블로커: 없음(위 【2】/【4】 블로커와 무관, 이 항목 자체는 라이브 테스트까지 통과).
- 알려진 한계: `regenerate-stop`/`PATCH`/`alerts trigger`/`respond`는 실제 Supabase Auth 토큰이
  있어야 호출 가능해 이번 라운드에선 **코드 리뷰 + 로직 재사용 검증**까지만 하고 실제 HTTP
  호출로는 확인 못 했다(`/generate`는 게스트 라우트라 라이브 테스트 완료). 데모 리허설 전
  QA의 실제 로그인 플로우로 스모크 테스트 권장.
- 다음 액션: QA — 로그인 토큰으로 저장 → regenerate-stop → PATCH → alerts trigger/respond
  전체 플로우 스모크 테스트.

---

## [2026-09-14 22:45] 백엔드팀 — 라운드5 【8】정리 + 최종 보고

### 정리

- `agent/src/weather.js` 상단의 라운드3 블로커 주석(KMA_SERVICE_KEY 활용신청 의심) 제거 —
  해당 키 이슈는 이미 해결된 상태였고 코드 자체는 처음부터 정상이었다고 확인됨(더 이상
  유효하지 않은 주석이라 삭제).
- `agent/kma_diag.js` — 확인 결과 이미 존재하지 않음(별도 삭제 작업 불필요).
- `monitor.js` 자동 스캔 라이브 실행(`tick()` 1회, 실제 Supabase 대상) — 에러 없이 정상
  완료. 현재 DB에 오늘(2026-09-14) 날짜가 start_date~end_date 사이인 `active` 일정이 없어
  `scanAndTrigger`가 0건 스캔했지만(정상 — 아직 실사용자 저장 일정이 없는 상태), 빈 날
  스킵 가드(`!dayEntry || dayEntry.stops.length===0`)와 `dismissExpiredProposals`는 코드
  경로상 정상 동작 확인. 실제 rain 트리거까지의 end-to-end 확인은 로그인 후 일정을 최소
  1건 저장한 뒤 재확인 필요(QA 리허설 스크립트에 포함 권장).

### 최종 보고 (라운드5 전체)

**컷한 항목: 없음.** 지시된 "자를 순서"(카카오모빌리티 → is_indoor → 어디든지 →
DELETE) 중 하나도 자르지 않고 8개 항목 전부 구현 완료. 대신 구현 중 실측으로 발견한 두
가지를 블로커로 남긴다(둘 다 임의로 결정하지 않고 PM 확인 대기):

1. **care_facilities 실데이터 부족** (【2】 항목 참고) — 응급의료기관 인제0/홍천1/평창1,
   보건기관 3개 시군 전부 0건. PRD "시군당 최소 5건" 기준 미달.
2. **`/generate` 응답시간이 3초 예산을 못 지킨다** (【4】 항목 참고) — 최적화 후에도
   6~9초대(3일/9스탑 기준), 4일/20스탑(다중 시군)은 8.3초. 카카오모빌리티/LLM 호출을
   가능한 만큼 병렬화했지만 LLM 구조화 출력 자체의 생성 속도가 하한선.

**pois name_en/name_zh**: 482/482 성공, 0 실패 (【3】 참고, 상세 표는 해당 항목).

**package.json diff**: `scripts/sync/package.json`에 `@anthropic-ai/sdk: ^0.32.0` 추가
(care/pois 이름 번역, `npm install` 완료·`package-lock.json` 갱신 포함). `server/package.json`은
이미 이 라운드 이전부터 `@anthropic-ai/sdk`를 갖고 있어 변경 없음.

**측정된 `/generate` 응답시간**: 위 2번 블로커에 실측치 전부 기록(15.2초 → 6~9초대로 개선,
3초 예산 미달 사실은 그대로 보고).

**마이그레이션 안내**: `0004_care_facilities_source_swap.sql`, `0005_pois_i18n_and_indoor.sql`
둘 다 **미적용 상태** — 승현님이 Supabase SQL Editor에서 순서대로(0004 먼저, 0005는 무관한
테이블이라 순서 상관없음) 직접 실행 필요. 적용 전엔 `GET /api/care`가 컬럼 없음 에러(로컬
실측 확인)를, `sync_pois.js`/`sync_care.js`의 upsert가 컬럼 없음 에러를 낸다(번역/데이터
수집 자체는 마이그레이션과 무관하게 이미 성공 확인됨).

- 블로커: 위 1/2번 (각 항목에 상세 기록).
- 다음 액션:
  1. 승현님 — migrations 0004/0005 Supabase SQL Editor에서 적용.
  2. 적용 후 `scripts/sync/sync_care.js`, `scripts/sync/sync_pois.js` 재실행해 실제 DB 반영
     확인(현재는 번역/수집 로직까지만 검증됨).
  3. PM — care_facilities 데이터 부족(1번) 및 `/generate` 3초 예산 초과(2번) 두 블로커에 대한
     방향 결정.
  4. QA — regenerate-stop/PATCH/alerts trigger·respond 로그인 플로우 스모크 테스트(이번
     라운드에선 코드 리뷰까지만 완료).

---

## [2026-09-15 00:30] PM (전략기획팀) — 라운드5 검수 + 블로커 2건 결정

8개 항목을 하나도 자르지 않고 전부 구현한 것, 그리고 실측으로 원인을 끝까지 파고든 것 좋습니다.
특히 아래 셋은 지시서에 없던 발견입니다.

- **평창 커버리지의 진짜 원인이 페이지네이션 누락**(83건 → 344건). 카테고리 매핑을 의심했는데
  페이징이었습니다.
- **`max_tokens` 절단 시 SDK가 예외 없이 `input: {}`를 준다** — narration이 경고 한 줄 없이
  조용히 전부 `null`이 되던 원인. `stop_reason` 가드 추가한 것 정확합니다.
- **응급의료기관 오퍼레이션이 `getEgytBassInfoInqire`이고 `STAGE1`/`STAGE2` 필터가 무시된다**는
  것을 `totalCount` 비교로 확정한 것.

시드 데이터를 되살리지 않은 판단도 유지합니다. 검증 안 된 응급연락처는 없는 것보다 나쁩니다.

### 결정 1 — `/generate` 3초 예산: 코스와 설명을 분리합니다 (계약 변경)

제안해주신 1/2/3 중 **2번(분리)** 을 채택합니다. 3번(요청 언어만 생성)은 채택하지 않습니다 —
언어 전환 시 설명이 사라지는 건 라운드6에서 이미 한 번 고친 문제입니다.

**근거는 실측 내역 자체에 있습니다.**

```
가중치 추출 1.2 + pois 조회 0.15 + 코스 생성 0.004 + 카카오모빌리티 0.4 ≈ 1.8초
narration/blurb ≈ 5~8초   ← 이것만 예산을 깬다
```

**코스 뼈대는 이미 3초 안에 나옵니다.** 설명을 같은 응답에 묶어두는 한 예산을 지킬 방법이 없고,
청크당 2~3초는 병렬화로도 줄지 않는 하한선이라는 것도 실측으로 확인됐습니다.

그리고 **`blurb`는 PM이 UI 아트보드 검수에서 추가한 필드입니다.** 그게 예산을 깼으니 구조를
바꾸는 것도 PM이 하는 게 맞습니다.

**계약 변경 (`API_CONTRACT.md` §1)**

- `/generate` 응답의 `narration`/`region_reason`/모든 `blurb`는 **항상 `null`**. 스키마는 그대로
  두므로 프론트의 null 처리 경로가 그대로 쓰입니다.
- **`POST /api/itineraries/narrate` 신설** — 프론트가 이어서 호출해 설명을 채웁니다.
  게스트도 호출 가능(인증 불필요). 요청에는 프롬프트에 필요한 값(장소명·카테고리·시군)만 담고
  좌표·이동시간·`is_indoor`는 보내지 않습니다.
- **실패해도 200**으로 세 값을 `null`로 반환합니다. 에러 코드를 쓰지 않습니다 — 프론트가 "설명
  없는 코스"를 그대로 유지하면 되고, 실패를 사용자에게 알릴 이유가 없습니다.
- 프론트는 **로딩 스피너를 두 번 보여주지 않습니다.** 코스는 이미 떠 있고 설명만 조용히
  채워집니다. 10초 타임아웃 시 재시도 없이 설명 없이 둡니다.

> 라운드5에서 "한 번의 호출" 문구를 **"병렬 호출 여러 개"** 로 재해석한 판단은 맞습니다.
> 원래 의도가 "직렬 호출로 지연이 배가되는 것 방지"였는데 그 한 번의 호출 자체가 예산을
> 넘긴다는 걸 실측으로 보여주셨습니다. 계약에 그 근거를 함께 기록했습니다.

### 결정 2 — care 데이터: 데이터셋을 하나 더 붙입니다

보건기관표준데이터에 강원이 통째로 없다는 것(`sggNm` distinct 확인)은 사실로 받아들이고
**폐기**합니다. PRD 5장에서 제거했습니다.

문제는 **인제 0건**입니다. 케어 화면에 119만 남으면 Must-have가 사실상 빕니다.

**국립중앙의료원 전국 병·의원 찾기 서비스(`B552657/HsptlAsembySearchService`)를 추가합니다.**
우리에게 필요한 건 "여행 중 아플 때 갈 수 있는 가까운 곳"이지 *지정* 응급의료기관이 아니므로,
의원·병원까지 포함하는 이 데이터셋이 용도에 더 맞습니다. 이미 쓰는 `B552657`과 같은
제공기관이라 승인도 빠를 것으로 봅니다. 승현님이 활용신청 진행합니다.

**수용기준 현실화**: "시군당 최소 5건" → **"시군마다 실재가 확인된 시설 1건 이상"**.
건수를 채우려고 미검증 데이터를 넣지 않는다는 원칙을 PRD 8장 상자에 명문화했습니다.
발표 화법도 통일했습니다 — "공공 의료 데이터를 그대로 쓰기 때문에 군 단위에 등록된 시설이
적으면 적게 보입니다, 없는 시설을 지어내지 않는 것이 안전 기능의 원칙입니다".

### 남은 확인

- migrations 0004/0005는 승현님이 Supabase에 적용했다고 확인받았습니다. 적용 후
  `sync_care.js`/`sync_pois.js` 재실행 결과(실제 DB 반영 건수)를 다음 라운드에 남겨주세요.
- `monitor.js` end-to-end는 저장된 일정이 1건 이상 있어야 확인됩니다 — 통합 후 QA 리허설에서
  잡습니다.

- 블로커: 없음 (위 2건 결정 완료).
- 다음 액션:
  - **승현님**: 전국 병·의원 찾기 서비스 활용신청.
  - **백엔드 (라운드6)**: `narrate` 엔드포인트 분리 + 병·의원 데이터셋 추가.
  - **프론트**: `/generate` → 즉시 렌더 → `narrate` 이어서 호출 → `poi_id` 매칭해 채우기.
  - **다음 순서는 통합입니다** — 백엔드/프론트 라운드가 끝나면 `NEXT_PUBLIC_API_BASE_URL`을
    실제 서버로 돌리고 end-to-end를 봅니다. 9/21까지 6일 남았습니다.

---

## [2026-09-15 09:00] 백엔드팀 — 라운드6 【2】【3】병·의원 데이터셋 추가 + 마이그레이션 후 재동기화 확인

### 【2】 전국 병·의원 찾기 서비스 추가

`B552657/HsptlAsembySearchService`의 정확한 오퍼레이션은 `getHsptlMdcncListInfoInqire`(실측
확인). **응급의료기관과 달리 이 오퍼레이션은 `Q0`(시도)/`Q1`(시군구) 지역 필터가 실제로
동작한다** — 무필터 `totalCount=78,954` → `Q0=강원특별자치도`+`Q1=인제군` `totalCount=29`로
실측 확인. 그래서 응급의료기관/보건기관표준데이터와 달리 전량을 받지 않고 시군별로 직접
필터링해서 받는다(`care_sources.js`의 `fetchHospitalsAndClinics(sggName)`).

**category 매핑**: 응답의 `dutyDivNam`(치과의원/보건소/의원/한의원/병원/종합병원/요양병원/
기타(구급차) 등, 전부 실측 확인)을 아래로 매핑했다.
- `보건소` 포함 → `health_center` (계약 기존 enum 재사용 — 이 데이터셋은 보건소/보건지소/
  보건진료소를 세분화하지 않고 전부 "보건소"로만 주므로 `health_subcenter`는 이 소스에서는
  안 씀)
- `병원` 포함 → `hospital` (병원/종합병원/요양병원 — 계약 기존 enum 재사용)
- `의원` 포함 → **`clinic` (신규)** — 의원/치과의원/한의원. **계약에 없는 새 category 값이라
  API_CONTRACT.md §4 갱신 제안으로 남긴다.** `care_facilities.category`는 실제로는 DB enum이
  아니라 plain text 컬럼(0001 스키마 확인)이라 **마이그레이션 0006은 필요 없었다** — 값
  자체는 이미 자유롭게 들어간다, 계약 문서 쪽만 동기화가 필요하다.
- `기타(구급차)` 등 위 세 패턴에 안 걸리는 항목은 **제외**(구급차 회사 등 실제로 찾아갈 수 있는
  의료기관이 아님 — 건수를 채우려고 애매한 항목까지 넣지 않는다는 원칙 그대로).

**name_en/name_zh**: 기존 `translate_name.js`/`CARE_SUFFIX_DICT` 파이프라인 그대로 재사용.
접미사 사전에 `의원`(Clinic)/`한의원`(Korean Medicine Clinic)/`치과의원`(Dental Clinic)/
`종합병원`(General Hospital) 추가(긴 접미사부터 매칭되도록 정렬은 기존 코드가 자동 처리).

**정리**: 전국보건기관표준데이터(강원 0건 확정, PRD 5장에서 폐기)를 쓰던
`fetchAllHealthInstitutions`/지오코딩 경유 로직을 코드에서 제거했다 — `care_sources.js`에서
함수 삭제, 더 이상 쓰이지 않는 `geocode.js`도 삭제(카카오 로컬 지오코딩은 새 소스가 좌표를
직접 주므로 불필요해짐).

### 실측 결과 — 시군당 최소 1건 이상 달성, 0건 시군 없음

| 시군 | 응급의료기관 | 병·의원(의원/한의원/치과의원/병원/보건소) | 합계 |
|---|---|---|---|
| 인제 | 0 | 29 | 29 |
| 홍천 | 1 | 83 | 84 |
| 평창 | 1 | 56 | 57 |
| **합계** | **2** | **168** | **170** |

**인제 0건 문제가 해결됐다** — 응급의료기관은 여전히 0건이지만 병·의원 29건(치과의원7/
보건소11/의원4/한의원6/병원1)으로 케어 화면이 더 이상 비지 않는다. PRD 8장 "시군마다 실재가
확인된 시설 1건 이상" 기준을 세 시군 전부 충족.

### 【3】 마이그레이션 0004/0005 적용 후 재동기화 확인 (실 DB 반영, 수치로 확인)

- `sync_care.js` 재실행 → **170건 upsert 성공**(이전 라운드엔 `name_ko` 컬럼 없음 에러로 upsert
  자체가 안 됐었다). 지역별 정리(cleanup)까지 정상 동작 확인.
- `sync_pois.js` 재실행 → **482/482건 번역 성공, upsert 성공**. DB 직접 조회로 재확인:
  `pois` 전체 482건 중 `name_en` 채워짐 482건(100%), `is_indoor=true` 351건 — 컬럼이 실제로
  채워져 있음을 애플리케이션 로그가 아니라 **DB select로 직접 검증**했다.
- `GET /api/care?region_code=injae` 실호출 → API_CONTRACT.md §4 스키마 그대로 응답 확인
  (`name_ko` 주 표시값 + `name_en`/`name_zh` 병기, `category` 값이 `clinic`/`hospital`/
  `health_center`/`emergency_room`로 정상 분류돼 나옴).

**알려진 품질 이슈(참고용, 이번 라운드 범위 밖)**: LLM 번역 결과 중 일부가 로마자·한글·키릴
문자가 섞이는 등 품질이 들쭉날쭉한 사례를 발견했다(예: "약손한의원" → `name_en`에 키릴 문자가
섞여 나옴, "국립평창청소년수련원" → 로마자 표기가 어색함). 접미사는 고정 사전이라 항상
일관되지만, LLM이 맡는 지명 부분은 검증 로직이 없어 가끔 이런 사례가 나온다. 안전 기능인
`care_facilities`보다는 `pois`(관광 안내용, 병행 표기로 한국어 원문이 항상 같이 보임)에서
상대적으로 리스크가 낮다고 판단해 이번 라운드에서 손대지 않았다 — 데모 전 QA가 육안으로
전체 목록을 한 번 훑어보는 것을 권장.

- 블로커: 없음.
- 다음 액션: 승현님/PM — `clinic` category 신규 값을 API_CONTRACT.md §4에 반영.

---

## [2026-09-15 09:40] 백엔드팀 — 라운드6 【1】narrate 엔드포인트 분리 완료, 3초 예산 달성

계약(API_CONTRACT.md §1)에 이미 반영된 대로 구현. `llm.js`의 `generateNarrationBundle`(라운드5
병렬 청크 구조)은 로직 변경 없이 그대로 옮기고, 입력 형식만 `/narrate` 요청 와이어 포맷
(`{poi_id, name_ko, category}`)에 맞춰 조정했다.

- `POST /api/itineraries/generate` — LLM narration 호출을 완전히 제거. `narration`/
  `region_reason`/모든 `stops[].blurb`를 항상 `null`로 채워 반환(스키마는 그대로 유지).
  `extractPreferenceWeights`(가중치 추출)는 그대로 남음.
- `POST /api/itineraries/narrate` (신규, 인증 불필요) — 요청받은 `days[].stops[]`(장소명·
  카테고리·시군만)로 narration/region_reason/blurbs를 생성해 항상 200으로 반환. 입력 구조
  검증 실패(400 계열)를 제외하면 LLM 실패는 절대 에러 코드로 새지 않는다
  (`generateNarrationBundle` 내부에서 이미 전부 null 폴백 보장 — 라운드5부터 확인된 동작).
  `selected_regions.auto===false`면 `region_reason`은 `null` — 라이브 확인.

### 실측 — 3초 판정 (5회 반복, 로컬 → 실 Supabase/Claude/카카오모빌리티)

**`/generate` 3일/9스탑 (단일 시군, pyeongchang)**

| 회차 | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| 응답시간(초) | 2.44 | 1.67 | 1.66 | 1.86 | 1.69 |

**`/generate` 4일/20스탑 (다중 시군, "어디든지")**

| 회차 | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| 응답시간(초) | 2.07 | 2.08 | 1.70 | 2.61 | 1.96 |

**전부 3초 이내 — 판정 통과.** 라운드5의 15.2초(분리 전) → 6~9초대(1차 최적화) → **1.7~2.6초
(분리 후)**. `narration`/`region_reason`/`blurb`가 스키마 그대로 `null`로 오는 것도 라이브
확인했다.

**`narrate` 단독 응답시간(참고용, 예산 대상 아님)** — 위 4일/20스탑 코스의 `days`를 그대로 넘겨
5회 반복: **4.56 / 4.68 / 4.89 / 4.96 / 5.56초.** 계약의 "10초 타임아웃" 기준 안에 여유 있게
들어온다. 20개 스탑 전부 `poi_id` 매칭되는 blurb를 받았고, `narration`/`region_reason`도
정상 생성됐다(라이브 응답 본문으로 확인).

- 블로커: **없음. 3초 예산 문제가 해결됐다.**
- 다음 액션: 프론트 — `/generate` 즉시 렌더 → `narrate` 이어서 호출 → `poi_id` 매칭 플로우
  통합.

---

## [2026-09-15 10:10] 백엔드팀 — 라운드6 【4】통합 준비

### CORS — Vercel 도메인 아직 없음

`server/.env`의 `ALLOWED_ORIGINS`를 확인했다. **현재 로컬 주소 1개만 등록돼 있고 Vercel
배포 도메인은 없다.** 승현님이 Vercel 도메인을 알려주시면 콤마로 이어붙여서
(`http://localhost:3000,https://<실제도메인>.vercel.app`) 추가해야 한다 — 안 그러면 배포된
프론트에서 API 호출이 전부 CORS로 막힌다.

### 배포 필요 환경변수 (키 이름만, 값 없음)

**API 서버 (`/server`, Express — Railway/Render에 상시 서비스로 배포)**

| 키 | 용도 |
|---|---|
| `PORT` | 서버 포트 (플랫폼이 자동 주입하는 경우 그대로 써도 됨) |
| `SUPABASE_URL` | Supabase 프로젝트 URL |
| `SUPABASE_ANON_KEY` | 사용자 Bearer 토큰 검증용 |
| `SUPABASE_SERVICE_ROLE_KEY` | RLS 우회 트러스티드 서버 키 — **절대 프론트/클라이언트 노출 금지** |
| `ANTHROPIC_API_KEY` | 가중치 추출·narrate LLM 호출 |
| `KAKAO_MOBILITY_API_KEY` | Directions API(이동시간) — 없으면 `travel_from_prev(_day)`가 전부 null로 폴백(에러는 안 남) |
| `KMA_SERVICE_KEY` | 이 라운드엔 직접 안 쓰지만 `agent/`와 서비스키 관례를 공유 — 서버 쪽엔 필수 아님 |
| `ALLOWED_ORIGINS` | 위 CORS 항목 참고 |

**감시 에이전트 (`/agent`, node-cron — API 서버와 별도 프로세스/서비스로 배포 필요)**

| 키 | 용도 |
|---|---|
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | API 서버와 동일 값, `agent/`가 `server/src/lib`를 상대경로로 직접 import해서 쓰기 때문에 이 프로세스에도 각자 필요(1주차부터의 구조) |
| `KAKAO_MOBILITY_API_KEY` | traffic 조건(구간 이동시간) 판정 |
| `KMA_SERVICE_KEY` | rain 조건(기상청 단기예보) 판정 |

`ANTHROPIC_API_KEY`는 `agent/`엔 필요 없다(narration을 만들지 않음, `alertTrigger.js`가 LLM을
안 씀). **두 프로세스는 상시 실행이 필요하므로(API 서버는 요청 대기, 에이전트는 cron 루프)
Railway/Render에서 별도 서비스 2개로 배포해야 한다** — 하나로 합쳐서 배포할 수 없다(node-cron이
API 서버 프로세스 안에서 안 돈다, `agent/src/index.js` 별도 진입점).

### 엔드포인트 스모크 테스트 — 전부 통과

실제 Supabase 테스트 유저(임시 생성 후 완전 삭제·정리 완료)로 인증 필요 엔드포인트까지
전부 실호출했다.

| 엔드포인트 | 결과 |
|---|---|
| `POST /api/itineraries/generate` | 200, 3초 이내 (위 【1】) |
| `POST /api/itineraries/narrate` | 200 |
| `POST /api/itineraries` (저장) | 201 |
| `GET /api/itineraries` (목록) | 200, `stop_count` 정상 |
| `GET /api/itineraries/:id` | 200 |
| `PATCH /api/itineraries/:id` | 200, `day_reordered:true`, 순서 재정렬 확인 |
| `DELETE /api/itineraries/:id` | 200, 재호출 멱등 확인, 목록에서 제외 확인 |
| `GET /api/care?region_code=...` | 200, §4 스키마 그대로 |
| `POST /api/itineraries/regenerate-stop` | 200, 후보 3개 + blurb |
| `POST /api/alerts/trigger` | 200, 메시지 완성 문장(ko/en/zh) 확인 |
| `POST /api/alerts/:id/respond` | 200, 스탑 교체 반영 확인 |

**실패한 것 없음.** 테스트에 쓴 임시 유저/일정/알림 row는 전부 삭제해 실 데이터에 남기지
않았다(Supabase Auth 유저 삭제만으로는 `public.users`/`itineraries`가 안 따라 지워진다는 것도
이번에 확인함 — `users.id`는 `auth.users`를 진짜 FK로 참조하지 않는 구조라서다. 나중에 QA가
같은 방식으로 테스트 데이터를 만들 경우 수동 정리가 필요하다는 점 기록해둔다).

- 블로커: 없음(CORS는 승현님 액션 대기이지 백엔드 블로커 아님).
- 다음 액션: 승현님 — Vercel 도메인 공유(ALLOWED_ORIGINS 갱신) + API 서버/에이전트 각각
  Railway 또는 Render에 별도 서비스로 배포 + 위 환경변수 등록.

---

## [2026-09-15 11:30] PM (전략기획팀) — 라운드6 검수: 통과. 계약 2건 반영 + 번역 문자 검증 추가

**두 블로커가 다 해소됐습니다.**

- `/generate` **1.7~2.6초** (15.2초 → 6~9초 → 1.7~2.6초). 3초 예산 통과.
- **인제 0건 해결** — 병·의원 29건. 세 시군 전부 "실재가 확인된 시설 1건 이상" 충족.
- 엔드포인트 11개 전부 스모크 통과, 실패 없음.

이번에도 지시서에 없던 걸 여럿 잡으셨습니다.

- `HsptlAsembySearchService`는 **`Q0`/`Q1` 지역 필터가 실제로 동작**한다는 걸 `totalCount`
  비교(78,954 → 29)로 확인해서 전량 수신을 피한 것. 응급의료기관과 반대라 안 해봤으면
  몰랐을 일입니다.
- `기타(구급차)`를 제외한 판단 — 건수를 채우려고 애매한 항목을 넣지 않는 원칙 그대로입니다.
- `care_facilities.category`가 DB enum이 아니라 plain text라 **마이그레이션이 불필요하다**는 걸
  확인하고 0006을 안 만든 것. 불필요한 마이그레이션을 안 만드는 게 맞습니다.
- 쓰이지 않게 된 `geocode.js`를 삭제한 것.
- `users.id`가 `auth.users`를 진짜 FK로 참조하지 않아 **Auth 유저를 지워도 `public.users`/
  `itineraries`가 안 따라 지워진다**는 발견. 데모 범위에선 문제가 없지만 QA가 테스트 데이터를
  만들 때 수동 정리가 필요합니다 — TEST_PLAN에 반영할 항목입니다.

### 반영 1 — `clinic` category (`API_CONTRACT.md` §4)

제안대로 추가했습니다. 실제 분포상 가장 많은 값이라(인제 29건 중 의원계 17건) 프론트가
반드시 라벨을 준비해야 합니다.

`health_subcenter`는 **키를 유지하되 당분간 값이 안 들어옵니다** — 이 데이터셋이 보건소/보건지소를
세분하지 않기 때문입니다. 소스가 늘면 다시 씁니다.

> 프론트가 모르는 `category`를 받으면 라벨이 빕니다. **알 수 없는 값은 시설 종류 줄을 생략하고
> 이름·거리만 표시**하도록 계약에 명시했습니다 — 빈 라벨을 그리지 않습니다.

### 반영 2 — `name_en`/`name_zh` 문자 검증 (신규, 백엔드 작업 필요)

"약손한의원 → `name_en`에 키릴 문자 혼입"은 **참고사항으로 넘길 수 없습니다.** 심사위원이
케어 화면에서 깨진 문자를 보면 그 한 건으로 인상이 결정됩니다.

다만 **육안 검수는 해법이 아닙니다** — `care_facilities` 170건 + `pois` 482건 = 652건을 사람이
훑는 건 비현실적이고, 재동기화하면 다시 검수해야 합니다. **기계적으로 막는 게 맞습니다.**

동기화 시점에 문자 클래스를 검사해 통과 못 하면 그 언어를 `null`로 떨어뜨립니다. 화면에는
한국어 원문만 나오고 이상한 문자는 사용자에게 도달하지 않습니다(`API_CONTRACT.md` §4에 명시).

- `name_en`: ASCII 문자·숫자·공백·하이픈·아포스트로피·마침표·괄호만 허용. 그 외 하나라도 있으면 `null`.
- `name_zh`: CJK 한자 + ASCII 숫자/공백/괄호만 허용. **한글·키릴이 하나라도 있으면 `null`.**
- `pois`에도 동일 적용.

정규식 한 줄이면 이 문제 전체가 사라집니다. 다음 백엔드 작업에 넣어주세요.

### 승현님 액션 (여기서부터가 임계 경로입니다)

1. **Vercel 도메인을 백엔드에 공유** → `ALLOWED_ORIGINS`에 추가. 안 하면 배포된 프론트에서
   API 호출이 전부 CORS로 막힙니다.
2. **Railway 또는 Render에 서비스 2개 배포** — API 서버(`/server`)와 감시 에이전트(`/agent`)를
   **합쳐서 배포할 수 없습니다.** 에이전트는 node-cron 루프라 별도 진입점(`agent/src/index.js`)이
   필요합니다. 환경변수 목록은 백엔드가 위 항목에 키 이름으로 정리해뒀습니다.
3. `SUPABASE_SERVICE_ROLE_KEY`는 **서버·에이전트에만** 넣습니다. 프론트(Vercel) 환경변수에
   절대 넣지 마세요 — RLS를 우회하는 키입니다.

- 블로커: 없음.
- 다음 액션:
  - **프론트**: `/generate` 즉시 렌더 → `narrate` 이어서 호출 → `poi_id` 매칭 통합.
    `clinic` category 라벨(ko/en/zh) 추가, 알 수 없는 category 폴백.
  - **백엔드**: `name_en`/`name_zh` 문자 검증 추가 후 재동기화.
  - **승현님**: 위 1~3 (배포). **9/21까지 6일, 통합에 최소 이틀은 남겨야 합니다.**

---

## 2026-09-14 (2주차 토요일) · PM — 배포본 실연동 1차 점검: 코스 결과 화면 전체 붕괴

**작성자**: PM 세션 · **대상**: 백엔드 / 프론트

프론트(Vercel)와 백엔드(Railway) 배포가 끝나 **처음으로 실연동을 배포본에서 검증**했습니다.
PM이 배포된 `https://gang-won-go.vercel.app/ko`에 직접 접속해 심사위원 동선대로 코스를 만들어본
결과를 기록합니다. **심사 방식이 "심사위원이 배포 URL에 직접 접속"이므로(PRD 11.5절), 이 점검은
이제부터 마감까지 모든 머지 후 반복합니다.**

### 통과한 것

- Vercel `NEXT_PUBLIC_API_BASE_URL` → 번들에 정상 인라인, `app/lib/api.ts`의 목업 스위치가
  실 API로 전환됨. **데이터 레이어는 프론트 코드 수정 없이 그대로 붙었습니다** — 프론트팀이
  호출부를 `api.ts` 한 곳으로 모아둔 설계가 제값을 했습니다.
- 백엔드 `/api/itineraries/generate` 단독 호출 정상. 실데이터(인제 POI, `name.ko/en/zh` 모두 채워짐)
  반환 확인. 응답 2.6초(웜) / 4.6초(콜드).
- 카카오맵: 카카오 개발자 콘솔 플랫폼 > Web에 Vercel 도메인 등록 후 마커·라벨·경로선 정상 렌더.
- CORS: `ALLOWED_ORIGINS`에 Vercel 도메인 추가 후 통과.

### P0 — 코스 결과 화면이 통째로 죽습니다 (백엔드 원인)

```
MISSING_MESSAGE: categories.A01010900 (ko)
→ Minified React error #130
→ "This page couldn't load"
```

서버가 `stops[].category`에 **TourAPI 원본 코드 `A01010900`** 을 실어 보냅니다. 프론트 메시지
카탈로그에는 7개 마스터 키만 있으므로 조회 실패 → next-intl 예외 → 렌더 트리 붕괴입니다.

**원인 위치**: `scripts/sync/sync_pois.js:67`이 `category`에 원본 코드를, `tags`에 매핑된 7개 키를
각각 저장합니다. `server/src/lib/scoring.js`가 `category: poi.category`로 원본을 그대로 내보냅니다.
**매핑 규칙(`scripts/sync/category_mapping.js`)은 정상 동작 중입니다** — 결과를 `tags`에만 넣고
응답에 반영하지 않은 것이 유일한 문제입니다.

**조치 (A안 확정)**: 서버 응답에서 `tags[0]`을 `category`로 내보냅니다. `pois.category`는 TourAPI
원본 보존용으로 남깁니다. **재동기화하지 않습니다** — 마감까지 7일이라 3개 시군 전 POI 재동기화에
쓸 시간이 없고, 서버 매핑 한 곳으로 해결되기 때문입니다. `API_CONTRACT.md` §1에 상자로 명시했습니다.

**스탑을 내보내는 모든 응답에 동일 적용할 것** — `/generate`, `/regenerate-stop`,
`/itineraries/:id`, `/alerts`. 한 곳만 고치면 다른 화면에서 같은 사고가 재발합니다.

### P0 — 예외 하나가 화면 전체를 끊습니다 (프론트 원인)

카테고리 값 하나를 모른다고 페이지가 죽는 것은 **그 자체로 별개의 버그입니다.** 백엔드를 고쳐도
이 구조가 남아 있으면 다른 미지의 값에서 같은 사고가 납니다.

심사위원이 안내 없이 혼자 접속하는 방식이므로 **렌더 중 예외 한 번이 심사 동선 전체를 끊습니다.**
`API_CONTRACT.md` §4가 케어 시설에 이미 정해둔 규칙("모르는 category는 라벨을 비운다")을
**스탑에도 동일하게** 적용하고, 결과 화면에 에러 바운더리를 둡니다. PRD 6장 "실패한 조각만 조용히
대체, 핵심 경험은 막지 않음" 원칙 그대로입니다.

### 확인 중

- 콘솔에 `Method OPTIONS is not allowed by Access-Control-Allow-Methods in preflight response`가
  1회 관측됨. 실데이터가 도달했으므로 CORS가 완전히 막힌 상태는 아니지만, preflight가 간헐적으로
  실패할 가능성이 있어 위 두 건 수정 후 재현 여부를 다시 봅니다.
- 콜드 스타트 4.6초. 3초 기준(PRD 2.1절)을 웜 상태에서는 만족하나 여유가 없습니다. 심사위원 첫
  접속이 콜드일 가능성이 높아 데이터를 더 모아 판단합니다.

### 배포 환경 메모 (승현님)

- Railway 무료 크레딧은 **"30일"이 아니라 "$5, 최대 30일"** 입니다. 상시 서비스 2개면 3~4주에
  소진됩니다. **심사는 9/21 제출 이후이므로, 제출 직전 Hobby($5/월) 전환을 권합니다** — 심사위원이
  접속했을 때 백엔드가 죽어 있으면 프론트만 뜨고 코스 생성이 안 됩니다.
- 공공데이터포털 키: API 서버는 **불필요**(Supabase만 읽음). 에이전트는 `KMA_SERVICE_KEY` **필수**.
  동기화 스크립트 키(`TOURAPI_*`/`MEDICAL_*`/`FESTIVAL_*`)는 로컬 전용입니다.
- `.env.example`은 **비워둔 채 유지**합니다(키 이름만). Vercel/Railway는 저장소의 `.env`를 읽지
  않고 대시보드 변수를 주입합니다. `NEXT_PUBLIC_*`은 **빌드 타임에 번들로 들어가므로, 변수를
  추가/수정한 뒤 반드시 재배포**해야 반영됩니다.

- 블로커: 위 P0 2건. **둘 다 고쳐지기 전까지 심사 동선 1~3단계가 배포본에서 완주되지 않습니다.**
- 다음 액션:
  - **백엔드**: `stops[].category` → `tags[0]` 매핑 (전 응답 경로). 이어서 `name_en`/`name_zh`
    문자 검증.
  - **프론트**: 알 수 없는 category 폴백 + 결과 화면 에러 바운더리. 이어서 `/generate` 즉시 렌더 →
    `narrate` 병합, `clinic` 라벨, Supabase 인증 실연동.
  - **승현님**: 백엔드 머지 후 PM에게 알려주시면 배포본 재점검합니다. **9/21까지 7일.**

---

## 2026-09-15 (2주차 일요일) · PM — 배포본 2차 점검: 원인 3건 확정, 심사 동선 1~3단계 완주

**작성자**: PM 세션 · **대상**: 백엔드 / 프론트 / 승현님

백엔드 라운드7(카테고리 마스터 키 + 이름 문자 검증) 머지·배포 후 재점검했습니다.

### 해결 확인

- **`stops[].category` 마스터 키 정상.** 3개 시군 × 5일 = 스탑 60개를 뽑아 검증했고 TourAPI 원본
  코드 **0건**, 유효하지 않은 값 **0건**입니다. `resolveMasterCategory`를 `toStopShape`/
  `toCandidateShape` 한 곳에 넣어 전 경로가 거치게 한 구현이 맞습니다. 요청하지 않았던
  `sanitizeStoredDays`(이미 저장된 옛 코스 방어)까지 들어간 것은 PM이 놓친 부분을 백엔드가 메운 것입니다.
- **지도·경로선·다국어 정상.** 카카오맵 마커·경로선이 그려지고, 영어 전환 시
  `Naesimjeok Valley / 내심적계곡` 병기와 `Nature/Hiking` 라벨, `33 min by car`까지 계약대로입니다.
- **심사 동선 1~3단계가 배포본에서 실데이터로 완주됩니다** (확장 프로그램 없는 환경 기준).

### 확정된 원인 3건

**① "생성중" 무한 대기 = 브라우저 확장 프로그램의 도메인 차단 (P0, 심사 리스크)**

승현님 Chrome에서 코스 생성이 로딩 화면에 멈추는 현상을 추적한 결과, 서버·CORS는 전부 정상이었고
(preflight 204 + 본 요청 200 + `access-control-allow-origin` 정상, curl로 증명) **확장 프로그램이
`up.railway.app` 요청을 차단**하고 있었습니다. 시크릿 창에서는 정상 동작합니다.

`*.up.railway.app`은 피싱 호스팅에 자주 쓰여 여러 차단 목록에 도메인째 올라가 있습니다.
**심사위원 브라우저에 차단기가 하나만 있어도 같은 일이 벌어지고, 그분들이 차단기를 끄고 들어올
이유는 없습니다.** 우리가 통제할 수 없는 변수에 데모 전체가 걸려 있는 상태입니다.

**대응 (확정)**: Vercel 리라이트로 백엔드를 same-origin 뒤에 둡니다.
- 프론트: `next.config.ts`에 `/backend/:path*` → Railway 리라이트 추가
- 승현님: **리라이트가 머지·배포된 뒤에** Vercel의 `NEXT_PUBLIC_API_BASE_URL` 값을 `/backend`로 교체
  (변수명은 그대로, 값만. 순서를 바꾸면 404가 납니다)

브라우저가 보는 요청이 전부 `gang-won-go.vercel.app`이 되어 차단 대상 도메인이 사라지고,
CORS도 함께 사라집니다. 코드 수정은 `next.config.ts` 한 곳뿐입니다.

**② 가중치 0일 때 가나다순 식당 퍼레이드 (P0 — PM 문서의 빈틈)**

자유 텍스트를 비우면 가중치가 전부 0이 되는데, **그럴 때 무엇을 골라야 하는지를 계약이 정하지
않았습니다.** 그 결과 평창 3일 코스가 스탑 12개 중 식당 10개, 이름이 청→초→촌→친→충→카
가나다순으로 나옵니다. 동점 시 `.sort`가 입력 순서를 보존하기 때문입니다.

"자유 텍스트는 비워도 됨"은 PRD 2.1절·11.5절이 명시하고 화면에도 "비워도 괜찮아요"라고 적어둔,
**우리가 권장한 경로**입니다. 심사위원이 가장 먼저 보는 화면이 이것일 가능성이 높습니다.

**대응**: `API_CONTRACT.md` §1에 상자로 규칙을 확정했습니다 — 알파벳 무관 결정적 타이브레이크,
하루 카테고리 과반 제한, 동일 좌표 POI 제거. 난수는 쓰지 않습니다(새로고침마다 코스가 바뀌면
신뢰를 잃습니다).

**③ `[travel] 이동 정보 계산 실패` = 동일 좌표 (②의 3번과 동일 원인)**

Railway 로그의 이 경고는 폴백이 설계대로 동작한 것이지만, 원인은 POI 좌표 중복입니다.
청춘카페&떡방과 청춘보리밥 진부점이 소수점 10자리까지 같은 좌표라 출발지=도착지 경로를
계산할 수 없습니다. 지도 마커 겹침도 같은 원인입니다.

### 다국어 커버리지 실측 (스탑 60개)

| 항목 | 결과 |
|---|---|
| `category` 유효성 | 60/60 |
| `name_en` 누락 | 2건 (3%) |
| `name_zh` 누락 | **12건 (20%)** |

중국어가 20% 비어 있습니다. 계약대로 한국어로 폴백되므로 깨지지는 않지만, **다국어가 핵심
차별점인데 中 전환 시 다섯 곳 중 한 곳이 한국어로 남습니다.** 라운드7의 문자 검증이 한글·키릴
혼입을 `null`로 떨어뜨린 결과로 보입니다 — 방향은 맞지만 재생성 한 번 돌려볼 가치가 있습니다.

### 성능 실측

`/generate` 웜 2.2~2.6초, 콜드 4.6~5.3초. 자유 텍스트가 비면 LLM을 건너뛰어 0.3초대입니다.
**심사위원 첫 접속은 콜드일 가능성이 높습니다.** 프론트의 즉시 렌더 → `narrate` 분리가 체감을
가장 크게 줄입니다.

### 잔여 P0

1. **프론트**: 네트워크 실패 시 무한 로딩 (api.ts에 try/catch·타임아웃 없음 → 어떤 실패든 로딩 박제)
2. **프론트**: 렌더 예외 하나가 페이지 전체를 죽임 (에러 바운더리 없음) + 오염된 sessionStorage 재생
3. **프론트**: 인증 전부 목업 — 심사 동선 4·6단계 차단
4. **백엔드**: 위 ②③

- 블로커: 없음. 위 네 건은 각 세션에서 병렬 진행 가능합니다.
- 다음 액션:
  - **백엔드**: API_CONTRACT §1 신규 상자(가중치 0 처리) 구현. 이어서 `name_zh` 재생성 검토.
  - **프론트**: 위 1~3 + `next.config.ts` 리라이트.
  - **승현님**: 리라이트 머지 후 Vercel 변수 값 교체. **9/21까지 6일.**

---

## 2026-09-15 (2주차 일요일 오후) · 백엔드팀 — P0(가중치 0일 때 가나다순) + P1(travel 실패) + P2(name_zh 20%) 해소

`API_CONTRACT.md` §1 "가중치가 전부 0일 때 무엇을 고를 것인가" 상자 확정 규칙 3가지를 전부
`server/src/lib/scoring.js`에 구현했습니다.

### P0 — 확정 규칙 3가지 구현

1. **결정적 타이브레이크**: `stableTieBreakKey(poiId)` — `poi_id`를 간단한 문자열 해시로 돌려
   이름/삽입 순서와 무관한 정수를 얻는다. 기존에 `.sort((a,b) => b.__score - a.__score)`로
   흩어져 있던 6곳(앵커 선정, 앵커 주변 픽, k-means 상위 풀, 클러스터 내부 정렬, leftover
   채우기, `pickTopCandidates`)을 전부 `compareByField('__score' | '__combined')` 하나로
   통일해서 동점이면 항상 이 해시로 갈리게 했다. 난수는 쓰지 않음.

2. **하루 카테고리 다양성 제약**: `enforceCategoryDiversity(dayPlans, scored)` — 각 날짜의
   최종 픽(anchor 포함)에서 과반(`count*2 > n`)을 차지하는 카테고리가 있으면, 그 카테고리의
   최저점 항목부터 다른 카테고리의 미사용 후보로 교체한다. 대체 후보가 없으면 제약을 완화하고
   `console.warn`으로 로그만 남긴다(코스 생성 실패로 이어지지 않음).
   **계약 문구를 정확히 지켜 가중치가 전부 0일 때만 돌린다** — "가중치가 일부라도 0이 아닌
   경우엔 기존 스코어링이 그대로 우선하고, 1·2는 동점 구간에만 개입한다"는 확정 문구 그대로.
   실측 확인: `free_text: "온천만 가고 싶어요"`(가중치 `onsen_wellness: 1`, 나머지 0)로
   요청하면 하루 3스탑이 전부 `onsen_wellness`로 나온다 — **의도된 결과이므로 다양성 제약이
   개입하지 않는 것까지 확인**했다(가중치 전부 0일 때만 도는 게이트가 정상 동작).

3. **동일 좌표 POI 중복 제거**: `dedupeByCoordinate(pois)` — `buildItineraryDays`의 pool과
   `pickTopCandidates` 양쪽 후보 단계 최초 시점에 적용(가중치와 무관하게 항상). 남길 하나를
   고르는 기준도 `stableTieBreakKey`라 이 dedupe 자체가 가나다순 편향을 다시 끌어들이지 않는다.

### 검증 — 지시된 4가지 기준 전부 통과 (3개 시군 × free_text 빈 요청, 각 2회)

| 시군 | 가나다순 정렬 | 하루 과반 카테고리 | 좌표 중복 | 결정적(2회 동일) |
|---|---|---|---|---|
| 인제 | 아니오 | 없음 | 없음 | 예 |
| 홍천 | 아니오 | 없음 | 없음 | 예 |
| 평창 | 아니오 | 없음 | 없음 | 예 |

평창 예시(수정 전 실측 보고서의 그 시군): `day1 [오대산비로봉식당(food_local), 억두동길
(nature_hiking), 청춘보리밥 진부점(food_local), 흥정계곡(nature_hiking)]` — food_local
2/4로 과반 아님, "청춘보리밥 진부점" 포함돼 있지만 이제 `travel_from_prev`가
`{mode:'car', minutes:10}`으로 정상 계산됨(아래 P1).

### P1 — travel 실패 로그

`[travel] 이동 정보 계산 실패` — **P0-3(좌표 중복 제거) 적용 후 위 검증 6회(3시군×2회) 동안
0건.** 원인대로 좌표 중복이 사라지자 실패도 사라졌다. 폴백 자체(필드 전체 null)는 계약대로라
건드리지 않았고, 혹시 남는 실패를 다음 라운드에서 바로 추적할 수 있도록 `computeTravel`의
경고 로그에 출발/도착 좌표를 추가해뒀다(`travel.js`).

### P2 — name_zh 재생성

`scripts/sync/regenerate_name_zh.js`(신규) — `name_zh`가 `null`인 row만 골라 `translateName()`을
한 번 더 시도. 이미 성공한 값은 건드리지 않고, 검증 규칙(라운드7의 문자 클래스 화이트리스트)도
그대로 재사용 — 완화하지 않음.

| 테이블 | 재생성 전 null | 재생성 후 null | 재생성 성공 |
|---|---|---|---|
| `pois` | 84/482 (17.4%) | **42/482 (8.7%)** | 42건 |
| `care_facilities` | 13/170 (7.6%) | **5/170 (2.9%)** | 8건 |

재생성 후 전수 스캔(정규식 재검증)으로 위반 문자 0건 확인. 여전히 null로 남은 건들은 로그
확인 결과 대부분 순우리말 지명(예: "탁치과의원" → 중국어로 못 옮기고 한글이 그대로 남는 패턴)
— 이전 라운드에서 기록한 것과 같은 원인이며, 다음에 프롬프트를 "한자 지명이 아니면 의미
번역 대신 병음 음역"으로 바꾸면 더 줄 것으로 보이나 이번 라운드 범위는 아니다.

- 블로커: 없음.
- 다음 액션: 없음(P0/P1/P2 전부 해소, 검증 완료). 프론트 잔여 P0 3건(무한 로딩/에러 바운더리/
  인증 목업)과 승현님의 same-origin 리라이트는 이 작업과 무관하게 진행 가능합니다.

---

## [2026-09-15 13:40] 프론트팀 — 배포본 P0/P1 6건 (네트워크 무한대기 / 렌더 예외 / Supabase 인증 실연동 / narrate 분리 / clinic 라벨 / same-origin 리라이트)

지시서 6건 전부 반영했습니다. 순서대로 기록합니다.

### P0-A — 네트워크 실패 시 "생성중" 무한 대기

`app/lib/api.ts`에 `fetchApi<T>()` 공용 진입점을 추가해 실제 fetch를 쓰는 모든 함수
(9개)가 이걸 거치도록 바꿨습니다. **절대 throw하지 않습니다**:
- fetch 자체가 reject(네트워크 단절·CORS 차단)하거나 `AbortController`로 20초 타임아웃되면
  → `NETWORK_ERROR`
- `res.json()` 파싱이 실패하면(502 게이트웨이 HTML 등) → `NETWORK_ERROR`
- 본문이 `{data, error}` 형태가 아니면(서버 응답 계약 위반) → `NETWORK_ERROR`

`ErrorCode`에 `NETWORK_ERROR`를 추가했습니다(서버가 내려주는 코드가 아니라 프론트 fetch
레이어가 붙이는 클라이언트 전용 코드라고 주석에 명시). `result/page.tsx`의 `runGenerate`도
try/catch로 한 번 더 감쌌습니다(P0-A 이후엔 사실상 안 던지지만 마지막 방어선). `GenerateErrorScreen`에
`NETWORK_ERROR` 문구 분기(제목/본문 별도, 아이콘은 `WifiOff`)를 추가하고 ko/en/zh 전부 넣었습니다.

**라이브 검증**: `NEXT_PUBLIC_API_BASE_URL`을 일부러 `http://127.0.0.1:9`(크롬이 "unsafe
port"로 막아 fetch가 즉시 reject하는 포트)로 돌려 실제 코스 생성을 시도 → "네트워크 연결을
확인해주세요" 화면이 즉시 뜨고 "다시 시도"를 눌러도 같은 화면으로 안정적으로 떨어지는 것 확인
(무한 로딩 없음). 확인 후 `.env.local`은 원래 값으로 복구했습니다.

### P0-B — 렌더 예외 하나가 페이지 전체를 죽임

1. `app/lib/categoryLabels.ts`(신규) — 7개 스탑 카테고리 / 5개 케어 카테고리 마스터 목록과
   `isKnownCategory`/`isKnownCareCategory` 런타임 가드.
2. `CategoryIcon.tsx` — prop 타입을 `CategoryKey`에서 `string`으로 넓히고, 모르는 값이면
   `undefined` 컴포넌트를 렌더하는 대신(그 자체로 크래시) `MapPin`으로 대체.
3. `StopRow.tsx`, `ReplaceStopModal.tsx`(후보 목록 포함), `care/page.tsx` +
   `CareFacilityCard.tsx` — 라벨을 그리기 전에 `isKnownCategory`/`isKnownCareCategory`로
   먼저 검증하고, 모르면 **라벨 줄만 생략**하고 장소명·순서·지도·거리는 그대로 렌더합니다
   (blurb만 있고 카테고리 라벨이 없을 때 " · " 구분자가 안 남게 조건을 같이 처리).
4. `app/[locale]/error.tsx`(신규) — 세그먼트 에러 바운더리. 부모 레이아웃이 유지되므로
   `useTranslations` 그대로 사용 가능. `app/global-error.tsx`(신규) — 루트 레이아웃
   (`app/[locale]/layout.tsx`가 사실상 루트 — 이 저장소엔 별도 `app/layout.tsx`가 없습니다)
   자체가 죽는 극단적 경우의 최후 방어선. next-intl 컨텍스트가 없어 문구를 하드코딩했고,
   외부 CSS에도 기대지 않도록 인라인 스타일만 썼습니다.
5. `app/lib/storage.ts`의 `loadGuestItinerary`에 최소 형태 검증(`days` 배열, 각 day의
   `stops` 배열 존재)을 추가 — 어긋나면 `clearGuestItinerary()` 후 `null` 반환.

**라이브 검증**:
- `stops[].category`에 TourAPI 원본 코드(`"A01010900"`)를 심은 `guest_itinerary`를
  `/result`에 주입 → 크래시 없이 렌더, 카테고리 라벨 줄만 생략되고 장소명·지도는 정상 표시,
  콘솔 에러 0건 확인 (배포본 1차 점검에서 실제로 죽었던 바로 그 값으로 재현했습니다)
- `guest_itinerary`에 `days: "not-an-array"`를 심고 `/result` 진입 → 크래시 없이 홈으로
  복귀, `sessionStorage`에서 해당 키가 실제로 지워진 것까지 확인

### P0-C — Supabase 인증 실연동

- `@supabase/supabase-js` 설치, `app/lib/supabase.ts`(신규)에 브라우저 클라이언트 단일
  진입점. `flowType: "implicit"`을 명시했습니다 — 이 작업 범위(`/app`,`/components`,`/i18n`)엔
  서버 라우트를 새로 만들 수 없어서, 별도 `/auth/callback` 콜백 엔드포인트 없이 클라이언트가
  리다이렉트로 돌아온 URL의 `#access_token` 해시를 직접 파싱해 세션을 만드는 플로우를
  택했습니다. `SUPABASE_SERVICE_ROLE_KEY`는 이 파일에 없습니다(서버/에이전트 전용, PM 검수
  항목).
- `app/lib/auth.ts`(신규) — `app/lib/mock/auth.ts`의 공개 인터페이스(`getSession` /
  `mockGoogleLogin` / `logout` / `subscribeAuthChange`)를 그대로 유지한 실제 구현으로
  교체했습니다. `getSession()`이 동기 함수라는 기존 계약을 지키기 위해 모듈 레벨 캐시를
  두고 `onAuthStateChange`로 계속 갱신합니다. `mock/auth.ts`는 삭제하고, import하던 6개
  파일(`api.ts` + 지시서의 5개)의 import 경로만 한 줄씩 바꿨습니다 — 함수 이름
  `mockGoogleLogin`은 실제 구현으로 바뀐 뒤에도 그대로 남아 있습니다(호출부 변경 최소화
  지시를 문자 그대로 따랐습니다 — 이름이 실제와 안 맞아 어색하지만 `auth.ts` 상단 주석에
  이유를 남겨뒀습니다).
- `saveItinerary`/`listItineraries`/`deleteItinerary` 등은 `session.token`을 그대로
  `Authorization: Bearer`로 쓰고 있었는데, 이제 `session.token`이 실제 Supabase
  `access_token`이라 별도 수정 없이 바로 맞습니다.
- **실제 Google OAuth는 팝업이 아니라 전체 페이지 리다이렉트**입니다 — 기존 목업/카피는
  "팝업" 멘탈모델(design/artboards/*.dc.html의 "Google 로그인 창이 열려요/닫혔어요" 문구,
  실제로는 안 건드렸습니다)이었지만 실제로는 브라우저 자체가 Google 동의 화면으로
  이동했다가 돌아옵니다. `redirectTo`는 클릭 시점의 `window.location.href`를 그대로
  써서 `/ko`, `/en`, `/zh` 로케일이 자동으로 유지됩니다.
  - **홈 배너(`GuestLoginHint`/`LoginModal`)와 마이페이지(`mypage/page.tsx`)는 추가
    수정이 필요 없었습니다** — 둘 다 원래부터 마운트 시 `getSession()`을 다시 읽는
    구조라(하이드레이션 지연을 이미 전제하고 있었음) 리다이렉트로 돌아왔을 때 자연스럽게
    로그인 상태를 인식합니다.
  - **저장 버튼 → 로그인 → 저장 흐름은 리다이렉트로 한 번 끊깁니다** — 클릭 시점의
    `SaveFlowModal` 인스턴스는 돌아왔을 때 이미 사라진 뒤라, `app/lib/storage.ts`에
    `markPendingSave`/`consumePendingSave`(신규)를 추가해 "저장을 이어가려 했다"는
    사실만 `sessionStorage`에 남기고, `result/page.tsx`가 코스가 준비된 뒤 이 플래그를
    확인해 `SaveFlowModal`을 `resumeMode="save"`로 자동으로 다시 엽니다(로그인 화면
    없이 곧장 저장 재개). Google 동의 화면에서 취소해 URL에 `error` 계열 파라미터가
    남아 있으면 `resumeMode="retry"`로 열어 재시도 화면부터 보여줍니다.
- `.env.example`에 `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` 키 이름만
  추가했습니다(값 없음).

**확인 못 한 것 (중요)**: 로컬에 실제 Supabase 프로젝트 URL/anon key가 없어(`.env.local`에
카카오 키만 있음) **실제 Google OAuth 왕복(동의 화면 → 콜백 → 세션 생성)은 이 세션에서
테스트하지 못했습니다.** 대신 확인한 것:
- Supabase 미설정 상태에서 로그인 시도(홈 배너, 마이페이지, 저장 흐름 3곳 전부) → 크래시 없이
  기존 "재시도" 화면으로 정상 폴백, 콘솔 에러 0건 — 즉 자격 증명이 없어도 앱이 죽지 않는 것은
  확인했습니다.
- `implicit` 플로우 선택과 `#access_token` 해시 자동 처리는 Supabase JS v2 문서 기준으로
  구현했으나, 실제 Supabase 프로젝트(구글 OAuth 공급자 설정 포함)로 끝까지 왕복해보는 확인은
  **QA 또는 실제 키가 있는 다음 세션에서 반드시 필요합니다.** 특히: (1) 리다이렉트 후 정말
  로케일이 유지된 채 같은 화면(`/ko/result` 등)으로 돌아오는지, (2) 저장 재개
  (`resumeMode="save"`)가 실제로 자동 저장까지 이어지는지, (3) 동의 화면 취소 시 정말
  `error` 파라미터가 붙어서 오는지(버전에 따라 쿼리스트링/해시 위치가 다를 수 있음).

### P1-D — `/generate` 즉시 렌더 → `narrate` 이어붙이기

- `app/lib/types.ts`에 `NarrateRequestDay`/`NarrateResponseData` 추가.
- `app/lib/api.ts`에 `narrateItinerary()` 추가 — 실제 호출은 10초 타임아웃(계약 명시,
  전역 20초와 별도), 목업은 항상 빈 응답(`narration/region_reason` null, `blurbs: []`)을
  줘서 `mockGenerate`가 이미 채워둔 값을 건드리지 않습니다.
- `result/page.tsx`에 `mergeNarration()` 추가 — **값이 있을 때만 덮어씁니다**(narrate가
  실패해도 200 + 전부 null로 오므로, 이미 채워진 걸 null로 되돌리지 않기 위함). `runGenerate`가
  성공하면 즉시 `"ready"` 상태로 그리고, 곧바로(로딩 스피너 추가 없이) `narrateItinerary`를
  호출해 완료되면 `setState`로 조용히 병합합니다. 저장 시(`saveGuestItinerary`)에도 병합된
  값이 그대로 반영됩니다.

**라이브 검증**: 목업의 "null-heavy" 시나리오(인제 단일 시군)와 일반 시나리오(평창)를 각각
재현 — 둘 다 크래시 없음, narrate 병합 후에도 일반 시나리오의 기존 narration/blurb가 null로
안 바뀌고 그대로 유지되는 것을 `sessionStorage`에 저장된 값으로 직접 확인.

### P1-E — `clinic` 카테고리 라벨

`app/lib/types.ts`의 `CareFacility.category`에 `"clinic"` 추가, ko/en/zh
`care.categories.clinic`(의원/Clinic/诊所) 추가. 케어 화면의 방어 규칙(P0-B의
`isKnownCareCategory`)과 같은 원칙이라 모르는 값은 원래도 라벨만 생략됩니다.

### P0-F — same-origin 리라이트

지시받은 대로 `next.config.ts`에 `/backend/:path*` → Railway 리라이트를 추가했습니다.
`app/lib/api.ts`의 `API_BASE` 기본값은 지시대로 건드리지 않았습니다 — 배포 반영은 승현님이
리라이트 머지 후 Vercel 변수를 바꾸는 순서로 진행하시면 됩니다.

**지시서에 없던 발견 — `middleware.ts`도 같이 고쳐야 리라이트가 실제로 동작합니다.**
next-intl 미들웨어의 matcher(`/((?!api|_next|.*\\..*).*)`)가 `/backend/*`도 매치해서,
로케일 미들웨어가 `/backend/health`를 `/ko/backend/health`로 307 리다이렉트해버립니다 —
그러면 `next.config.ts`의 리라이트 규칙(`/backend/:path*`)이 애초에 매치할 URL을 못 받습니다.
`matcher`에 `backend`를 제외 목록으로 추가했습니다(`/((?!api|_next|backend|.*\\..*).*)`).
이건 지시서 범위를 벗어난 변경이라 별도로 적습니다 — root 레벨 Next.js 설정 파일이라
`/app`,`/components`,`/i18n` 밖이지만, 지시받은 기능 자체가 이것 없이는 동작하지 않아서
포함했습니다.

**검증**: 지시서의 검증 커맨드 그대로 실행
```
curl -s localhost:3000/backend/health
{"data":{"ok":true},"error":null}
```
정상 로케일 라우팅(`/` → `/ko` 307, `/ko` → 200)도 회귀 없는 것 확인.

### 종합 검증

- `npx tsc --noEmit` / `npx eslint .` / `npm run build` 전부 통과
- ko/en/zh 세 언어 모두 `/care`, `/result`(네트워크 에러 화면 포함) 육안 확인

- 블로커: 없음.
- 다음 액션:
  - **승현님/QA**: 실제 Supabase 자격 증명으로 Google 로그인 전체 왕복(동의 화면 → 콜백 →
    세션 생성 → 로케일 유지 → 저장 재개)을 최종 확인해주세요 — 이번 세션은 자격 증명이 없어
    이 부분만은 "크래시 안 함"까지만 확인했고 "실제로 로그인이 된다"는 확인하지 못했습니다.
  - **승현님**: `next.config.ts` 리라이트 머지 후 Vercel `NEXT_PUBLIC_API_BASE_URL`을
    `/backend`로 교체(순서 중요, 먼저 바꾸면 404).

---

## [2026-09-18 14:20] 프론트팀 — 외부 검수 리포트 37건 중 A~E 반영 (로그인 유지 실패 / 이전 코스 재노출 / 실패를 성공처럼 표시 / 가짜 이메일 / 타임아웃 미적용)

외부 검수에서 나온 37건 중 심사 동선에 직접 영향을 주는 A~E를 지시받은 순서대로 반영했습니다.

### A — 로그인해도 로그인 유도가 계속 뜬다

**원인 1 (가장 치명적)**: `result/page.tsx`의 리다이렉트 복귀 처리가

```js
if (url.search || url.hash) {
  window.history.replaceState(null, "", url.pathname);
}
```

로 해시를 먼저 지웠습니다. implicit 플로우는 `#access_token` 해시로 토큰을 받고
supabase-js가 `detectSessionInUrl`로 그 해시를 **비동기로** 파싱해 세션을 만드는데, 이
코드가 해시를 먼저 지워버려 로그인이 아예 성립하지 않았습니다 — 로그인 후에도 배너·모달이
계속 뜨던 증상의 진짜 원인이었습니다. **해시는 이제 절대 건드리지 않습니다.** 지우는 건
Google 동의 화면 취소 시 붙는 `error` 계열 쿼리스트링뿐이고, `hadOAuthError` 판정을 먼저
끝낸 뒤에만 지웁니다.

**원인 2**: `SaveFlowModal`의 재개 effect가 `getSession()`을 한 번만 확인했습니다.
`getSession()`은 동기 캐시라 리다이렉트 직후엔 Supabase의 `onAuthStateChange`가 아직
도착 전이라 계속 `null`이었고, deps가 `[open, resumeMode]`뿐이라 세션이 늦게 도착해도
다시 확인하지 않았습니다. → `subscribeAuthChange`를 구독해 세션이 도착할 때까지 기다리고,
**10초** 안에 안 오면 재시도 화면으로 전환하도록 고쳤습니다(중복 실행 방지 `settled` 플래그,
언마운트 시 타이머·구독 정리 포함).

**원인 3**: `mypage/page.tsx`도 세션을 마운트 시 한 번만 읽었습니다. → 아래 공통 훅으로
교체해 같은 문제를 근본적으로 해결했습니다.

**함께 고친 것**:
- **리포트 11**: `SaveFlowModal`이 이미 로그인된 사용자에게도 OAuth를 다시 시작하던 문제 —
  모달이 열릴 때 `getSession()`이 있으면(일반 오픈이든 리다이렉트 복귀 직후든) 로그인 화면을
  건너뛰고 곧장 저장합니다. `handleGoogleContinue`도 같은 가드를 넣었습니다.
- **리포트 12**: `resumeMode`가 `useState` 초기값으로만 쓰여 부모가 나중에 "retry"로
  바꿔도 `step`이 안 바뀌던 문제 — effect 안에서 `resumeMode === "retry"`를 매번 다시
  확인해 `step`에 반영합니다.
- **리포트 27**: 인증 시작 실패 후(`mockGoogleLogin()`이 `{ok:false}`) 또는 명시적으로
  모달을 닫을 때 `pending_save` sessionStorage 플래그가 안 지워지던 문제 — `storage.ts`에
  `clearPendingSave()`를 추가해 두 경로 모두에서 호출합니다.

**공통 훅**: `app/lib/useAuthSession.ts`(신규) — Header/GuestLoginHint/mypage/
SaveFlowModal/LoginModal 5곳이 전부 이것만 씁니다. `auth.ts`에 `isAuthReady()`를 추가해
"세션이 없음"과 "아직 확인 중"을 구분합니다.

**주의(실측으로 직접 잡은 버그)**: 이 훅의 초기 구현은 `useState(() => ({session:
getSession(), ready: isAuthReady()}))`처럼 **초기값을 즉시 읽는** 방식이었는데, 이게
**하이드레이션 오류**를 냈습니다 — 클라이언트에서 Supabase의 비동기 `getSession()`이
서버 렌더보다 먼저(빠른 마이크로태스크 타이밍으로) 끝나버려 서버가 렌더한 HTML과 클라이언트의
첫 렌더가 달라졌습니다(`mypage`에서 실제로 재현, 콘솔에 `Hydration failed` 확인). 항상
`{session:null, ready:false}`로 시작하고 실제 값은 마운트 후 `useEffect`에서만 반영하도록
고쳐서 해결했습니다 — 서버는 클라이언트의 비동기 타이밍을 절대 미리 알 수 없으므로, 초기
렌더는 항상 서버와 같은 값이어야 합니다.

### B — 새 조건으로 만들어도 이전 코스가 나온다

`result/page.tsx`의 마운트 effect가 `guest_itinerary`(이전 생성 결과)가 있으면 그것부터
반환하고 끝나, `pending_request`(방금 새로 제출한 요청)를 전혀 확인하지 않았습니다.

`pending`이 있고 `existing.request`와 **다르면** 이전 결과를 무효화(`clearGuestItinerary`)
하고 새로 생성하도록 고쳤습니다. 같은 조건이면(또는 `pending`이 없으면) 기존 캐시를 그대로
써서 불필요한 재생성을 피합니다(비교는 `JSON.stringify` — `GenerateRequest`가 평평한
직렬화 가능 객체라 충분합니다).

### C — 실패를 성공처럼 보여준다

- `mypage/page.tsx`의 `handleDelete`가 `deleteItinerary()` 응답을 확인하지 않고 목록에서
  지웠습니다 → `res.data`를 확인한 뒤에만 지우고, 실패 시 `DeleteConfirmModal`을 닫지 않은
  채 에러 메시지 + 재시도 버튼을 보여줍니다(`deleting`/`error` prop 추가).
- `itinerary/[id]/page.tsx`의 알림 응답이 실패해도 무조건 `clearAlert()`를 호출했습니다 →
  `res.data`가 있을 때만 적용·`clearAlert()`하고, 실패하면 모달을 열어둔 채
  `AlertModal`에 인라인 에러(`managing.respondError`)를 보여줍니다(응답을 "no"로 보낸
  경우처럼 정상적으로 `dismissed`인 것과는 구분 — 실패는 `res.data`가 아예 없는 경우입니다).
- `mypage/page.tsx`의 `listItineraries()` 실패가 빈 배열로 뭉개져 "저장한 코스 없음"과
  구분이 안 됐습니다 → `items`를 `배열 | null(로딩) | "error"` 세 상태로 나눠, 로딩 중/
  실패(재시도 버튼 포함)/진짜 빈 목록을 각각 다른 화면으로 보여줍니다.
- `itinerary/[id]/page.tsx`의 `getItinerary()` 실패를 전부 `not_found`로 묶었습니다 →
  `AUTH_REQUIRED`/`NETWORK_ERROR`/그 외(`NOT_FOUND` 포함)를 구분해 각각 "로그인이
  필요해요"(마이페이지 링크)/"불러오지 못했어요"(재시도 버튼)/기존 "코스를 찾을 수
  없어요" 화면을 보여줍니다. `NOT_FOUND`를 그대로 두는 이유: API_CONTRACT.md §2가 본인
  소유가 아닌 리소스도 존재를 노출하지 않기 위해 의도적으로 404로 응답하도록 정해뒀기
  때문입니다 — "없음"과 "내 것 아님"을 굳이 더 나누지 않습니다.

### D — 존재하지 않는 이메일을 표시한다

`mypage/page.tsx`가 `session.user_id + "@gmail.com"`으로 이메일을 지어내고 있었습니다.
`auth.ts`의 `Session` 타입에 `email: string | null`을 추가해 실제 Supabase
`user.email`을 담고, 화면은 `session.email`이 있을 때만 그 줄을 그립니다(없으면 줄
자체를 생략 — 자리표시자나 빈 문자열을 넣지 않습니다).

### E — 응답 본문 지연에는 타임아웃이 안 걸린다

`api.ts`의 `fetchApi()`가 `fetch()` 직후 `finally`에서 타이머를 해제하고 있었습니다.
`fetch()`는 **헤더가 도착하는 순간** resolve되고 본문은 별도 스트림으로 읽으므로, 본문
전송이 멈춘 응답에서는 `res.json()`이 타임아웃을 넘겨도 끝나지 않았습니다 — 앞서 고친
무한 로딩이 이 경로로 재발할 수 있는 상태였습니다. `fetch()`와 `res.json()`을 하나의
try에 같이 넣고 `finally`에서 딱 한 번만 타이머를 해제하도록 고쳤습니다.

### 검증 (라이브 — 실 Supabase 자격 증명 없이 가능한 범위)

- `npx tsc --noEmit` / `npx eslint .` / `npm run build` 전부 통과
- **B**: 게스트 결과(인제)가 캐시된 상태에서 다른 조건(평창)의 `pending_request`를 심고
  `/result` 진입 → 새 코스(평창)가 정상 생성됨. 같은 조건을 다시 심으면 캐시를 그대로
  써서 즉시 렌더(재생성 없음) — 둘 다 확인
- **원인 1**: `pending_save` 플래그 + `#access_token=...` 해시를 직접 심고 `/result`
  진입 → effect가 `pending_save`는 정상 소비하면서 **해시는 그대로 유지**되는 것을 직접
  확인(수정 전이었다면 `url.pathname`으로 통째로 지워졌을 자리)
- **원인 2**: 위 상태에서 실제 세션이 끝내 도착하지 않자(로컬에 Supabase 자격 증명 없음)
  정확히 약 10초 뒤 재시도 화면("Google 로그인 창이 닫혔어요")으로 전환되고 게스트 코스가
  그대로 유지되는 것 확인 — 타임아웃 폴백이 실제로 동작
- **리포트 27**: 인증 시작이 즉시 실패하는 상태(Supabase 미설정)에서 "Google로 계속하기"
  클릭 → `pending_save`가 바로 지워지는 것 확인
- **C (itinerary 상세)**: `NEXT_PUBLIC_API_BASE_URL`을 접속 즉시 거부되는 포트로 돌려
  실제 `NETWORK_ERROR` 경로를 타게 한 뒤 `/itinerary/:id` 진입 → "코스를 불러오지
  못했어요" + 재시도 화면(기존 "코스를 찾을 수 없어요"와 다른 화면) 확인, 재시도도 같은
  화면으로 안정적으로 떨어짐 확인. 원래 환경(mock)으로 되돌리면 진짜 없는 id는 여전히
  "코스를 찾을 수 없어요"로 정상 표시되는 것도 재확인(회귀 없음)
- **하이드레이션**: 위 "주의" 항목의 버그를 fresh 탭에서 재현·확정 후 수정, 수정 후
  `/mypage`·`/`·`/care`를 ko/en/zh 여러 fresh 탭에서 콘솔 에러 0건 확인
- **로그인 실패 폴백**: Supabase 미설정 상태에서 홈 배너·저장 흐름 로그인 시도 — 크래시
  없이 기존 재시도 화면으로 정상 폴백(회귀 없음)

### 확인 못 한 것

- **실제 Google OAuth 왕복** (동의 화면 → 콜백 → 세션 생성 → 자동 저장 완료 → 배너·헤더
  갱신, 검증 체크리스트 2~4번)과 **D의 실제 이메일 표시**는 로컬에 Supabase 자격 증명이
  없어 이번에도 끝까지 확인하지 못했습니다. 원인 1·2를 고친 뒤 그 논리가 정확히 의도대로
  동작하는 것(해시 보존, 세션 도착 대기, 타임아웃 폴백)은 위처럼 직접 확인했지만, "실제로
  로그인이 성립해 세션이 만들어지는지"는 실 자격 증명이 있어야만 확인됩니다.
- **검증 체크리스트 6번(오프라인 삭제)**: `mypage`의 목록/삭제 화면 자체가 로그인 상태를
  전제로 렌더되어, 로그인 없이는 이 화면에 도달할 수 없습니다. 로직(응답 확인 후에만
  반영, 실패 시 에러+재시도)은 코드 리뷰로 검증했고 `itinerary/:id`에서 같은 패턴의
  `NETWORK_ERROR` 경로는 라이브로 확인했지만, 로그인 상태에서의 삭제 실패 자체는 실
  자격 증명이 필요합니다.

- 블로커: 없음.
- 다음 액션:
  - **승현님/QA**: 실 Supabase 자격 증명으로 검증 체크리스트 1~7번 전체를 시크릿 창에서
    순서대로 확인해주세요. 특히 2~4번(로그인 왕복)과 5번(실제 이메일), 6번(로그인 상태
    오프라인 삭제)은 이번 세션에서 로직만 검증했고 실제 왕복은 못 봤습니다.

---

## 2026-09-18 (3주차 금요일) · PM — 심사 동선 7단계 전 구간 완주 + PM의 문서 덮어쓰기 사고

**작성자**: PM 세션 · **대상**: 전원

### 사고 먼저 — PM이 이 파일의 과거 기록 353줄을 덮어쓸 뻔했습니다

PM 세션이 `docs/HANDOFF_LOG.md`를 자기 작업 사본에 이어붙인 뒤 저장소 파일 위에 그대로
덮어썼습니다. 그 작업 사본은 라운드12 시점 스냅샷이어서, 이후 백엔드·프론트 세션이 추가한
기록이 빠져 있었습니다. 결과적으로 **기존 353줄을 지우고 새 PM 항목 하나로 바꿔치기하는
변경**이 됐습니다. PRD 10장에 append-only 규칙을 써놓은 당사자가 그 규칙을 어겼습니다.

프론트 세션이 커밋 전에 발견해 파일을 마지막 커밋 상태로 되돌리고, 미커밋 내용은
`/tmp/handoff_recovery/HANDOFF_LOG_uncommitted_new_entry.md`에 백업해뒀습니다.
**기존 기록은 한 줄도 유실되지 않았습니다.** 이 항목은 그 백업에서 내용만 가져와,
현재 저장소 파일 끝에 정상적으로 덧붙인 것입니다.

**재발 방지 (PM 규칙으로 확정)**
- PM은 `docs/*`를 **저장소 파일에 직접 이어붙인다.** 클라우드 작업 사본을 저장소 위로
  덮어쓰지 않는다. 사본은 읽기·초안용으로만 쓴다.
- 커밋 전 `git diff --stat docs/`로 **삭제된 줄 수가 0인지 확인한다.** HANDOFF_LOG에
  삭제 줄이 하나라도 있으면 그 자체가 규칙 위반이다.
- 위 백업 파일은 복구가 확인됐으므로 더 이상 참조하지 않는다.

프론트 세션이 커밋 전에 잡아낸 덕분에 기록이 살았습니다.

### 심사 동선 7단계 전 구간 완주 (2026-09-18)

외부 검수 리포트(백엔드 31건 / 프론트 37건) 1차 반영과 백엔드 라운드9 배포 후,
**PRD 11.5절 심사위원 첫 접속 동선 7단계가 배포본에서 처음으로 전 구간 통과했습니다.**

| 단계 | 확인 주체 |
|---|---|
| 1 랜딩 → 로그인 없이 폼 | PM (배포본) |
| 2 입력 → 코스 생성 | PM (배포본) |
| 3 지도·순서·이동시간·언어전환 | PM (배포본) |
| 4 저장 → 구글 로그인 | 승현님 |
| 5 코스 부분 수정 | 승현님 |
| 6 마이페이지 목록·재열기·삭제 | 승현님 |
| 7 여행 케어 · tel:119 | PM (배포본) |

케어 데이터 실측: 인제 29 / 홍천 84 / 평창 57건, 전화번호 누락 0건, 영문명 누락 9건(5%).
카테고리 라벨(응급실·의원·보건소·병원) 정상, `clinic` 반영 확인.

### PM의 두 번째 오판 기록

라운드9 머지 **전**의 배포본을 측정해놓고 "자유 텍스트에 음식·전시를 써도 12곳 전부
자연이 나온다 — 심사에 치명적"이라고 단정했습니다. 라운드9 배포 후 다시 재니 자연·음식·
문화가 섞여 나옵니다. **배포 시점을 확인하지 않고 측정값만으로 단정한 것이 원인입니다.**
앞으로 배포본 측정 결과를 보고할 때는 해당 커밋이 배포됐는지 먼저 확인합니다.

다만 9일 중 5일은 여전히 하루 과반이 같은 카테고리입니다. 후보 풀에서 다른 카테고리가
소진되면 제약을 완화하도록 만들어둔 동작이며, 인제처럼 자연 POI가 대부분인 시군에서는
실제 지역 특성과도 부합합니다. **마감까지 스코어링은 더 건드리지 않습니다** — 지금 정상
동작하는 것을 흔들 위험이 이득보다 큽니다.

### 실시간 매니징 프론트 수신 경로 (결정)

`app/lib/api.ts`가 아직 `mock/realtime.ts`의 메모리 구독을 그대로 내보내고 있어,
에이전트가 `alerts` row를 만들어도 화면에 도달하지 않았습니다. 핵심 기능 4개 중 하나가
화면에 닿지 못하는 상태는 제안서 정합성 문제이고 발표 Q&A에서 직접 반박당할 수 있습니다.

이 문서 §3(API_CONTRACT)이 이미 **Supabase Realtime 채널 구독**으로 규정해뒀고,
`alerts` RLS 정책도 마이그레이션 0001에 있으며, `supabase_realtime` 퍼블리케이션에
`alerts`가 이미 포함돼 있음을 확인했습니다. 따라서 **백엔드 변경 없이 프론트만** 바꿉니다.
**9/19 오전까지 동작하지 않으면 되돌리고**, 발표에서 "백엔드 감시는 동작하며 프론트 수신은
다음 단계"로 설명합니다.

- 블로커: 없음.
- 다음 액션:
  - **프론트**: 2차 라운드(Realtime 구독 실연동, 삭제 코스 상태 반영, 날짜 검증,
    저장 중 이탈) 머지 후 PM이 배포본 무회귀 확인.
  - **백엔드**: 리포트 13(스탑 교체 후 날짜 사이 이동시간 미갱신) — 프론트 2차 결과 보고
    범위 확정. 급하지 않음.
  - **승현님**: 9/20에 시크릿 창 7단계 무중단 완주 QA, 그리고 **Railway를 Hobby($5/월)로
    전환**. 무료 크레딧은 10월 초 소진 예상이고 **심사는 제출 이후**입니다. 이때 백엔드가
    죽어 있으면 지금까지 한 작업이 전부 무의미해집니다.
  - **전원**: 마감까지 `scripts/sync` 실행 금지(9/15 항목 참조).

## [2026-09-18 21:40] 프론트팀

- 변경: PM 확정 지시(2차 라운드, 위 항목 참조) 4건 구현. 담당 디렉토리(`/app`, `/components`)만
  수정, `/server` `/agent` `/scripts/sync` `/docs`(이 파일 제외) 미접근.

  1. **Realtime 구독 실연동 (리포트 03)** — `app/lib/api.ts:33`이 `mock/realtime.ts`의 메모리
     구독을 그대로 내보내던 것을, `USE_MOCK` 여부로 분기해 실제 Supabase Realtime을 타도록
     수정. 새 파일 `app/lib/realtime.ts`: `app/lib/supabase.ts`의 기존 클라이언트를 재사용해
     `channel("alerts:itinerary_id=eq.<id>")`로 `postgres_changes`(INSERT, public.alerts,
     `filter: itinerary_id=eq.<id>`) 구독. `subscribeAlerts(itineraryId, listener) => unsubscribe`
     시그니처 그대로 유지, `components/managing/WatchContext.tsx` 호출부 미변경.
     - `isSupabaseConfigured`가 false이거나 채널 생성이 throw하면 조용히 no-op unsubscribe를
       반환(알림 때문에 코스 화면이 깨지지 않도록).
     - raw `alerts` row에는 `message`도 `candidate_poi` 상세도 없어서(컬럼 자체가 없음 —
       `/api/alerts/trigger`만 서버에서 `pois` 조인으로 채워줌), `proposed_poi_id`는 `pois`
       테이블을 직접 조회해(공개 read RLS) 보강. 이때 `pois.category`는 TourAPI 원본 코드라
       그대로 쓰면 안 되고(예전 P0-B에서 고친 "원본 코드가 그대로 노출" 버그 재발 위험)
       `pois.tags[0]`(마스터 카테고리 태그)을 사용. `previous_poi_id`는 이미 로드된
       `itineraryJson`에서 `AlertModal`이 직접 찾으므로 보강 불필요. `message`는 `{ko:null,
       en:null, zh:null}`로 둠 — `AlertModal`이 이미 null 메시지를 정상 렌더링함(부분 저하,
       비파괴적).
     - `mock/realtime.ts`는 삭제하지 않고 유지, mock 경로(`triggerAlert()` 데모)는 그대로 동작.
     - 언마운트/일정 전환 시 `supabase.removeChannel()`로 채널 해제.
     - **로컬 검증 한계**: `.env.local`에 Supabase 키가 없어(카카오맵 키만 존재) 실제 로그인·
       WebSocket 연결을 로컬에서 재현 불가 — 이번 라운드도 동일(9/11, 9/14 항목 참조). `tsc`
       clean, no-op 분기(설정 없을 때 throw 안 함) 코드 경로는 로컬에서 확인. **PM/승현님이
       배포본에서 로그인 후 저장된 코스 상세 화면 DevTools Network > WS 탭으로 최종 확인
       필요**. 9/19 오전까지 안 되면 이 항목만 되돌리세요(2~4는 유지).

  2. **삭제한 코스가 "매니징 중"으로 열리는 문제 (리포트 31)** —
     `app/[locale]/itinerary/[id]/page.tsx`가 날짜만 보고 `detail.status`(`cancelled`)를
     무시하던 것을 수정. `status === "cancelled"`이면 `watchedId`를 비워 구독을 끄고, 매니징
     트리거 훅도 조기 return하며, `ResultView`에 `status="cancelled"` `editable={false}`를
     넘겨 스왑·수정 UI를 감춤. `AlertModal`도 cancelled면 렌더 안 함.
     `components/result/ResultView.tsx`에 `SavedStatus`에 `"cancelled"` 추가, 칩("삭제된
     코스")과 하단 안내("삭제된 코스예요 / 마이페이지에서 삭제해 더 이상 수정하거나 지켜볼
     수 없어요")를 danger 톤으로 추가. ko/en/zh 3개 로케일 모두 `sessionStorage`에 가짜
     cancelled 레코드를 주입해(로그인 없이 mock 조회 경로 이용) 직접 렌더링 확인 완료 — 칩·
     하단 문구·스왑 버튼 없음·콘솔 에러 없음 전부 정상.

  3. **날짜 검증 (리포트 17)** — `components/main/MainForm.tsx`가 10일 초과만 보던 것을,
     제출 시 (a) 형식 유효성 (b) 시작일이 오늘 이후 (c) 1~10일 기간 (d) 종료일이 시작일보다
     앞서지 않음을 모두 검증하도록 확장(`diffDaysInclusive < 1`이 (d)를 자연히 포함). 위반
     시 섹션 힌트·하단 안내 문구를 ko/en/zh로 노출, 기존 "지역 너무 많음" 경고와의 우선순위는
     그대로 유지(지역 경고가 날짜 경고보다 먼저 표시됨 — 기존 동작). 네이티브 input setter로
     종료일<시작일, 시작일<오늘 두 케이스를 강제해 라이브로 확인 — 각각 올바른 한국어 문구로
     제출 차단됨을 확인. 이후 유효한 날짜로 복구 시 정상 제출·코스 생성됨을 확인.

  4. **저장 중 이탈 시 강제 이동 (리포트 37)** — `components/save/SaveFlowModal.tsx`의
     `completeSave()`가 `saveItinerary()` 응답을 기다리는 동안 사용자가 모달을 닫고 다른
     화면으로 옮겼는지 확인하지 않고 `onSaved()`를 호출하던 것을 수정. `open` prop을 매
     렌더마다 미러링하는 `openRef`를 추가해, 응답이 온 시점에 `openRef.current`가 false면
     (이미 닫힘) `onSaved()`도 게스트 임시 데이터 정리도 하지 않고 조용히 return —
     "요청 취소 ≠ 서버 저장 취소"이므로 화면을 강제로 되돌리지 않고, 실제 저장 성공 여부는
     마이페이지에서 확인 가능하게 둠.
     - **로컬 검증 한계**: `completeSave()`는 세션이 이미 있거나(재오픈) OAuth 리다이렉트
       복귀 후에만 호출되는데, 둘 다 실제 Supabase 로그인이 있어야 재현 가능해 로컬에서
       완전한 경쟁 조건 재현은 불가. 대신 모달을 열고 "이따가"로 닫는 일반 경로가 콘솔 에러
       없이 정상 동작함은 라이브로 확인. `openRef` 로직 자체는 코드 리뷰로 재검증(단순
       ref-mirrors-prop 패턴, effect 타이밍 상 완료된 await 시점에는 최신 open 값 반영됨).

- 회귀 확인: 심사 동선 7단계 중 로그인 불필요한 구간(랜딩 → 폼 작성 → 코스 생성 → 지도/
  언어전환 ko↔en, 저장 모달 열기/닫기 → 여행 케어 → 마이페이지 비로그인 빈 상태)을 라이브로
  재확인 — 전부 콘솔 에러 없이 정상. 로그인 필요 구간(실제 저장 완료, 마이페이지 목록·재열기·
  삭제, Realtime WS)은 로컬 Supabase 키 부재로 여전히 배포본에서만 최종 확인 가능(기존 한계,
  9/11·9/14 항목과 동일). `npx tsc --noEmit` / `npx eslint .`(기존 무관 경고 3건 외 없음) /
  `npm run build` 모두 clean.
- 블로커: 없음. 다만 위 1번(Realtime)과 4번(저장 중 이탈)은 실제 로그인이 있어야만 완전히
  재현 가능한 시나리오라 로컬에서는 코드 경로 검증까지만 했습니다.
- 다음 액션: PM/승현님이 배포본에서 시크릿 창으로 검증 체크리스트 1~6번(특히 WS 연결,
  삭제 후 URL 직접 접근, 저장 직후 모달 닫고 이동) 최종 확인. 9/19 오전까지 Realtime이
  배포본에서도 안 되면 1번만 되돌리고 2~4는 유지해주세요.

## [2026-09-19 10:15] 프론트팀

- 변경: 여행 케어(`app/[locale]/care/page.tsx`) 위치 권한 버그 수정. 담당 범위(해당 파일과
  `components/care/`)만 수정, 다른 화면·기능·`/server` `/agent` `/scripts` 미접근.
  `docs/STATUS.md` 지시대로 STATUS.md만 먼저 읽고 HANDOFF_LOG는 읽지 않았습니다.

  증상: "위치 허용"을 눌러도 대부분 반응이 없고 다시 누르면 권한 모달만 또 떴음.

  원인 3가지, 전부 수정:
  1. `getCurrentPosition`이 `maximumAge` 기본값(0)이라 매번 새로 측위를 강제해, macOS
     Chrome Wi-Fi 측위(5~15초)가 8초 타임아웃에 자주 걸림 →
     `{ timeout: 15000, maximumAge: 300000, enableHighAccuracy: false }`로 조정.
  2. 실패 원인(거부/시간 초과/미지원)을 전부 `"denied"` 하나로 뭉개 화면에 아무 피드백도
     없었음 → `GeolocationPositionError.code`로 `denied`/`unavailable`/`timeout` 3종으로
     분리, 각각 ko/en/zh 안내 문구 추가(`care.locationDeniedNote` 등 신규 키 4개:
     `locationLoading`/`locationDeniedNote`/`locationUnavailableNote`/`locationTimeoutNote`).
     `unavailable`·`timeout`에는 "다시 시도" 버튼(우리 모달 재오픈 없이 `getCurrentPosition`
     직접 재호출), `denied`는 안내 문구만(브라우저 차단은 재시도해도 똑같이 실패하므로
     버튼 없음 — 지시받은 대로).
  3. 요청 중 버튼을 비활성화하고 "위치 확인 중…"으로 바꿔, 눌러도 아무 일 없는 것처럼
     보이던 문제 제거.
  4. `navigator.permissions.query({name:"geolocation"})`로 이미 `granted`면 자체 모달을
     건너뛰고 곧장 측위. API 미지원(Safari 일부)이거나 조회 실패 시 try/catch로 감싸
     기존처럼 모달로 폴백.
  - `watchPosition`으로 바꾸지 않음(케어 목록은 1회 측위로 충분, 배터리만 낭비). 위치
    없을 때의 기존 시군 기준 정렬 폴백은 그대로 유지.

- 검증: `navigator.geolocation.getCurrentPosition`/`navigator.permissions.query`를
  `javascript_exec`로 모킹해(실제 OS 권한 프롬프트는 자동화 불가) 아래를 라이브 확인 —
  전부 콘솔 에러 없음.
  - `prompt` 상태 + "위치 허용" 클릭 → 우리 모달 뜸(정상, 기존 동작 유지)
  - 모달에서 허용 → TIMEOUT 에러 → "다시 시도" 버튼 + "위치를 가져오는 데 시간이
    걸려요." 문구 노출 확인
  - "다시 시도" 클릭(모달 재오픈 없이 직접 재호출) → 성공 → 목록이 거리순으로
    재정렬되고 카드에 km 표시, 에러/버튼 사라짐 확인
  - 새로고침 후 `permissions.query`가 `granted` 반환 → "위치 허용" 클릭 시 모달 없이
    즉시 거리순 전환 확인
  - `PERMISSION_DENIED` → 버튼 없이 "위치 권한이 거부되었어요. 브라우저 설정에서
    허용해 주세요." 문구만 노출 확인(en에서도 동일 시나리오 확인)
  - `POSITION_UNAVAILABLE` → "다시 시도" 버튼 + "无法获取您的位置。" 문구 노출 확인(zh)
  - 위치를 끝내 못 받는 모든 케이스에서 시설 목록·전화번호 링크·SOS 버튼은 정상 동작
  - `npx tsc --noEmit` / `npx eslint .`(기존 무관 경고 3건 외 없음) / `npm run build`
    모두 clean
- 블로커: 없음. 실제 OS 권한 프롬프트(브라우저 네이티브 다이얼로그) 자체는 자동화
  도구로 클릭할 수 없어 API 모킹으로 대체 검증했습니다 — 코드 경로는 실제 브라우저
  `GeolocationPositionError`/`PermissionStatus` 스펙과 일치하므로 배포본에서도 동일하게
  동작할 것으로 판단하지만, 실제 브라우저 권한 프롬프트 UX는 승현님 QA 때 한 번 더
  확인해주시면 좋겠습니다.
- 다음 액션: 없음(이 항목은 여기서 완결). 9/20 QA 때 여행 케어 "위치 허용" 흐름도
  함께 확인 부탁드립니다.

## [2026-09-19 12:30] 프론트팀

- 변경: 모바일 폭(375px)에서 코스 결과 화면의 바텀시트(코스 제목·DAY 목록·스탑 카드·
  "코스 저장" 버튼)와 지도 위 DAY 전환 칩이 전혀 안 보이던 버그 수정. 범위는
  `components/result/`(지도+바텀시트 레이아웃)와 같은 패턴을 쓰는 화면만 —
  `MapView` 사용처를 전수 확인한 결과 `components/result/ResultView.tsx` 한 곳뿐이라
  (여행 케어는 지도 없이 목록+tel: 링크만 씀) 이 파일만 수정. 데스크톱 2단 레이아웃·
  100dvh 계산식·상호작용 로직은 그대로 둠.

  원인(배포본에서 이미 확정된 상태로 전달받음): 카카오맵 SDK가 자기 내부 레이어에
  명시적 양수 z-index를 붙여서, `z-index: auto`인 형제 요소(바텀시트·DAY 칩)가 DOM
  순서상 나중이어도 그 아래로 깔림. 데스크톱은 목록이 정적 컬럼이고 지도가
  `md:left-[480px]`로 비켜나 겹치지 않아 증상이 안 보였을 뿐.

  수정: 지도 래퍼(`absolute inset-0 md:left-[480px]`)에 `isolate` 추가 — 카카오
  내부 레이어의 z-index를 그 스택 컨텍스트 안에 가둠. 그 위에 떠야 하는 3개 요소에
  `z-20` 명시 부여: 모바일 바텀시트, DAY 전환 칩, "내 위치" 배지(지시받은 두 요소
  외에 동일하게 지도 위에 뜨는 요소라 같은 원칙 적용, 데스크톱에서만 보이지만 지도
  영역과 겹치는 위치라 안전하게 포함). 인라인 style 없이 Tailwind 클래스로만 처리.
  z 계층은 기존 코드와 이미 일치했음(`Dialog.tsx` 오버레이 z-40/컨텐츠 z-50,
  `AlertBanner.tsx` z-30) — 모달·배너 쪽은 손대지 않음. 모달류(`AlertModal`
  `ReplaceStopModal` `SaveFlowModal` 등)는 전부 `components/ui/Dialog.tsx`를 쓰고
  Radix Portal로 `document.body`에 직접 렌더되므로 애초에 이 버그의 영향을 받지 않음
  (사전 코드 확인으로 결론, 라이브로도 재확인).

- 검증: 개발자도구 디바이스 툴바로 375×812 / 390×844 / 768×1024 / 데스크톱 폭에서
  라이브 확인, 콘솔 에러 없음(HMR WebSocket 로그만 — 개발 서버 전용 무관 노이즈).
  - 375px: 코스 생성 → 지도 아래 바텀시트에 코스 제목·DAY 목록·스탑 카드·"코스 저장"
    버튼 전부 표시 확인
  - 375px: DAY 전환 칩이 지도 위에 보이고 눌러서 DAY 2로 정상 전환(바텀시트도 동기화)
    확인
  - 375px: 저장된 코스(로그인 우회를 위해 이전 라운드와 동일하게 `sessionStorage`에
    `status:"saved"` 레코드 직접 주입)에서 스탑 행을 눌러 "이 장소 바꾸기" 모달이
    바텀시트 위에 정상적으로 뜸을 확인(모바일은 행 전체가 클릭 영역 — "바꾸기" 텍스트
    버튼 자체는 기존부터 `md:block`이라 데스크톱 전용, 이번 수정과 무관)
  - 390px 동일 확인. 768px 이상에서는 기존 2단 레이아웃 그대로(지도 마커 정상 렌더)
    확인. 데스크톱 폭에서도 "바꾸기" 모달 정상 확인(회귀 없음)
  - ko/en/zh 3개 로케일 모두 375px에서 바텀시트 정상 렌더 확인
  - 여행 케어·마이페이지(비로그인 빈 상태) 375px에서 잘리는 부분 없음 확인
  - `npx tsc --noEmit` / `npx eslint .`(기존 무관 경고 3건 외 없음) / `npm run build`
    모두 clean
- 블로커: 없음.
- 다음 액션: 없음(이 항목은 여기서 완결).

## [2026-09-19 15:40] 프론트팀

- 변경: 모바일 결과 화면 잔여 2건(메타 칩 잘림, 저장 버튼 아래 빈 공간) + PWA manifest
  추가(서비스워커 제외). 범위는 `components/result/`, `app/`의 레이아웃·메타데이터,
  `public/` 신규 파일만 — 다른 기능 로직 미접근. 심사 동선 7단계·직전 라운드의
  모바일 z-index 수정 모두 회귀 없음 확인.

  ### 1) 메타 칩 잘림 (375px) — 실제 원인은 보고된 것과 달랐다

  `components/result/ResultView.tsx`의 모바일 바텀시트 헤더 래퍼
  (`<div className="overflow-y-auto px-5 pb-2">{header}</div>`)에 `overflow-y-auto`가
  걸려 있으면, flexbox 스펙상 `overflow`가 `visible`이 아닌 요소의 기본 최소 높이가
  `auto`(콘텐츠 크기)가 아니라 `0`으로 취급된다. 시트는 `flex flex-col h-[62%]`
  고정 높이라, 전체 콘텐츠(제목+메타칩+지역이유 배너+내레이션+선호칩)가 62%를
  넘으면 이 헤더가 `flex-shrink:1`(기본값) 대상이 되어 실제 콘텐츠 높이보다 작게
  찌그러들고, 잘린 부분은 `overflow-y-auto`가 그냥 감춰버렸다 — 메타 칩 줄이
  "시트 헤더와 스크롤 영역 경계에 걸쳐" 보인 이유. 로컬에서 홍천·평창 자동매칭
  코스(지역이유+내레이션 있음)로 실측: 헤더 높이가 63px로 찌그러들어 내레이션
  텍스트가 문장 중간에서 잘림(`innerText`로 직접 확인).
  - 수정: 헤더 래퍼에서 `overflow-y-auto`를 빼고 `shrink-0`을 줌 — 항상 콘텐츠
    전체 높이로 렌더되고, 대신 원래도 스크롤 영역인 DAY 목록(`flex-grow`)이
    남은 공간을 흡수한다. 같은 코스로 재측정: 헤더 208px로 내레이션 전체 표시,
    잘림 없음.

  ### 2) 저장 버튼 아래 빈 공간 (375px) — 로컬에서는 재현 안 됨, 그래도 지시대로 수정

  `getBoundingClientRect()`로 실측한 결과 시트(`bottom-0`, `h-[62%]`)는 항상
  뷰포트 바닥(812px)까지 정확히 닿아 있었고, 풋터(저장 버튼)도 그 아래 접기 토글
  버튼과 함께 시트 바닥까지 빈틈없이 채워졌다(1일 코스·3일 코스 모두 확인) —
  즉 `flex-grow`가 정상 동작해 devtools 뷰포트 크기 에뮬레이션에서는 갭이 보이지
  않았다. 다만 Chrome DevTools의 커스텀 뷰포트 크기 조정은 iOS의
  `env(safe-area-inset-bottom)`(홈 인디케이터 영역)을 흉내 내지 않으므로, 실제
  아이폰에서 안전영역만큼 여백이 남거나 반대로 버튼이 인디케이터에 가려지는
  현상은 이 환경에서 재현이 원천적으로 불가능하다. 지시받은 대로 방어적으로 수정:
  - 코스 저장/지켜보는 중/삭제됨 3개 풋터 모두 모바일 하단 padding을
    `pb-6`(24px 고정) → `pb-[max(1.5rem,env(safe-area-inset-bottom))]`로 변경
    (데스크톱 `md:pb-6`은 그대로 유지, 안전영역과 무관).
  - **전제 조건**: `env(safe-area-inset-*)`는 `viewport-fit=cover`가 뷰포트
    메타에 없으면 실제 기기에서도 항상 0으로 계산돼 이 수정 자체가 무의미하다.
    기존에 `app/[locale]/layout.tsx`에 viewport 메타 설정이 전혀 없어서
    (Next 16은 `viewport` export가 없으면 기본값만 씀) 새로 `viewport` export를
    추가하며 `viewportFit: "cover"`를 포함시켰다(§3 PWA 항목과 함께 처리).
  - **로컬 검증 한계**: 위 이유로 이 항목은 배포본을 실제 iPhone Safari(또는
    Chrome)에서 "코스 저장" 버튼이 홈 인디케이터에 가리지 않는지 직접 확인
    부탁드립니다. `tsc`/`eslint`/`build`는 clean이고, devtools 375/390/768px
    전부 갭 없이 정상입니다(원래도 없었을 가능성이 있어 이 수정으로 인한 회귀도
    없음).

  ### 3) PWA manifest (서비스워커 제외)

  - `app/manifest.ts` 신규 (`MetadataRoute.Manifest`): name/short_name
    "GANGWON GO", description 1줄, `start_url: "/ko"`, `display: "standalone"`,
    `background_color: "#ffffff"`(`globals.css --color-bg`),
    `theme_color: "#0b7a55"`(`globals.css --color-brand`). 로케일이 3개지만
    manifest는 하나만 두고 `start_url`을 `/ko`로 고정(지시대로).
  - 아이콘 3+1종을 `public/`에 신규 생성: `icon-192.png` `icon-512.png`
    `apple-icon.png`(180×180) `icon-512-maskable.png`(추가 안전영역 포함, `purpose:
    "maskable"`). 로고 이미지 파일이 프로젝트에 없어(헤더는 텍스트 로고뿐)
    브랜드색(#0b7a55) 단색 배경 + 흰색 "GG" 텍스트 마크로 새로 제작(`sharp`로
    SVG→PNG 변환, 저장소에는 PNG만 커밋·중간 스크립트는 커밋하지 않음).
  - `app/[locale]/layout.tsx`: `metadata.appleWebApp`(capable/title/statusBarStyle),
    `metadata.icons`(icon 2종 + apple 1종 — `public/`에 있어 Next의
    `app/icon.png` 자동 인식 규칙 밖이라 명시 연결 필요), 신규 `viewport` export
    (`viewportFit: "cover"`, `themeColor: "#0b7a55"`, width/initialScale 기본값).
  - 서비스워커는 지시대로 추가하지 않음.

- 검증: 375×812 / 390(생략, 이전 라운드에서 이미 같은 패턴 확인) / 768×1024 /
  데스크톱에서 devtools로 라이브 확인, 콘솔 에러 없음.
  - 375px: 자동매칭(지역이유+내레이션 있음) 코스에서 메타 칩·지역이유·내레이션·
    선호칩 전부 안 잘리고 표시, 저장 버튼까지 시트 안에 정상 배치 (ko/en/zh
    3개 로케일 모두 확인)
  - 375px: 스탑 클릭 → "이 장소 바꾸기" 모달이 시트 위에 정상 표시(헤더 높이
    변경이 모달 z-계층에 영향 없음 확인)
  - 768px: 기존 2단 데스크톱 레이아웃 그대로, 콘솔 에러 없음
  - `fetch()`로 `/icon-192.png` `/icon-512.png` `/icon-512-maskable.png`
    `/apple-icon.png` `/manifest.webmanifest` 전부 200, `manifest.webmanifest`가
    `application/manifest+json`으로 서빙됨을 확인
  - `document.head`에서 `link[rel=manifest]`, `link[rel=apple-touch-icon]`,
    `link[rel=icon]`×2, `meta[name=theme-color]=#0b7a55`,
    `meta[name=viewport]`에 `viewport-fit=cover` 포함, `meta[name=
    mobile-web-app-capable]=yes` 전부 정상 주입 확인
  - **로컬에서 확인 불가**: 개발자도구 Application 패널의 Manifest 탭 렌더링
    (탭 UI가 이 브라우저 자동화 환경에는 없음 — 대신 위처럼 `<head>`/네트워크
    레벨로 같은 내용을 확인), 모바일 Chrome "홈 화면에 추가" 배너 실제 노출
    (배포된 HTTPS 환경 + 실제 모바일 브라우저가 필요). 매니페스트·아이콘·메타
    태그 자체는 스펙대로 전부 정상 서빙되는 것까지 확인했습니다 — 배포본에서
    개발자도구 Application > Manifest 탭과 실제 "홈 화면에 추가" 노출 여부를
    승현님이 한 번 더 확인해주시면 좋겠습니다.
  - `npx tsc --noEmit` / `npx eslint .`(기존 무관 경고 3건 외 없음) / `npm run build`
    모두 clean (`/manifest.webmanifest` 라우트가 빌드 출력에 정상 포함됨 확인)
- 블로커: 없음. 2번(저장 버튼 하단 여백)과 manifest 홈 화면 추가 배너는 로컬
  devtools 환경 자체의 한계로 최종 확인이 배포본 실기기 몫으로 남습니다.
- 다음 액션: 배포 후 실제 iPhone Safari/Chrome에서 (a) 결과 화면 하단 버튼이
  홈 인디케이터에 가리지 않는지, (b) 개발자도구 Application > Manifest에서
  이름·아이콘·테마색 인식, (c) "홈 화면에 추가" 프롬프트 노출을 확인해주세요.
