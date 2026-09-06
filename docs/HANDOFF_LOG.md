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
