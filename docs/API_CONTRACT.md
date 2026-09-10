# GANGWON GO — API_CONTRACT (v0 초안)

> 이 문서는 백엔드팀이 세션을 시작할 때 가장 먼저 검토·확정할 문서입니다.
> PM이 `GANGWON_GO_PRD.md`의 2.1절(Must-have)과 4장(데이터모델)을 근거로 1차 스켈레톤을 잡아둔 것이며,
> 필드명·에러코드 등 세부는 백엔드팀이 구현하면서 확정합니다. 확정되면 `HANDOFF_LOG.md`에 남기고,
> PM이 이 문서에 반영합니다 (PRD 10장 협업 프로토콜 참고).
>
> write 권한: 백엔드팀이 제안 → PM이 최종 반영. 프론트팀은 이 문서를 기준으로 화면을 붙이면 됩니다.

---

## 0. 공통 사항

- Base URL: `/api` (Express 서버, Vercel 프론트와 분리 배포 — PRD 3장)
- 인증: Google 로그인 이후의 요청은 Supabase Auth 세션 토큰을 `Authorization: Bearer <token>` 헤더로 전달.
  로그인 전(게스트) 요청은 인증 헤더 없이 호출 가능 (PRD 3.9절).
- 모든 응답은 `{ data, error }` 형태로 통일 (성공 시 `error: null`, 실패 시 `data: null` + 에러코드/메시지).
- 언어: 요청에 `lang` 파라미터(`en` | `zh`)를 포함. 그 외 값은 400 에러 (PRD 2.3절, 언어는 영/중만 지원).
- **CORS**: 프론트(Vercel 도메인)와 로컬 개발 주소(`localhost:3000` 등)만 허용 origin으로 등록. 백엔드팀이
  1주차 Express 세팅 시 `cors` 미들웨어에 허용 목록을 넣어둘 것 (PRD 6장). 실제 Vercel 도메인은 배포
  후 `HANDOFF_LOG.md`에 공유.

### 0.1 에러코드 표준 (확정 — 1주차 아키텍처 점검에서 확정, 기존 §5 미정 항목 해소)

모든 실패 응답은 `{ data: null, error: { code, message } }` 형태이고, `code`는 아래 목록 중 하나여야 한다.
**목록에 없는 실패가 그대로 클라이언트에 나가면 안 된다** — 서버 내부 예외(DB 에러, 외부 API 에러 등)는
서버 로그에만 원문을 남기고, 응답에는 `INTERNAL_ERROR`와 일반화된 메시지만 내려보낸다. Postgres/PostgREST
원문 메시지(제약 이름, enum 타입명 등)를 그대로 노출하지 않는다.

| code | HTTP | 발생 조건 |
|---|---|---|
| `INVALID_STRUCTURED_INPUT` | 400 | 필수값 누락/형식 오류. 날짜 형식(`YYYY-MM-DD`), `end_date >= start_date`, `region_codes` 1개, `relationship` enum, `companions >= 1`, 여행 기간 상한(10일) 검증 포함 |
| `INVALID_LANG` | 400 | `lang`이 `en`/`zh`가 아님 |
| `NO_POI_DATA` | 404 | 요청한 시군의 `pois`가 **0건**. 관계 필터 등으로 후보가 걸러져 비게 된 경우는 이 코드가 아니라 `NO_CANDIDATE`를 쓴다 (프론트 안내 문구가 다르기 때문) |
| `NO_CANDIDATE` | 404 | POI는 있으나 필터(관계/축제 날짜/우천 제외/거리) 적용 후 남은 후보가 없음 |
| `AUTH_REQUIRED` | 401 | Authorization 헤더 없음/만료/검증 실패 |
| `FORBIDDEN` | 403 | 토큰은 유효하나 본인 소유 리소스가 아님 |
| `NOT_FOUND` | 404 | itinerary/alert/POI id가 존재하지 않음. **본인 소유가 아닌 리소스도 존재 여부를 노출하지 않기 위해 404로 응답**한다(403 대신) |
| `ALERT_EXPIRED` | 409 | 이미 `confirmed`/`dismissed`된 알림에 다시 응답 시도. 3분 타임아웃(PRD 3.6절)과 사용자 클릭이 경쟁하면 정상적으로 발생하는 케이스이므로 에러가 아니라 상태 충돌로 다룬다 — 프론트는 "시간이 지난 제안입니다" 안내 후 모달을 닫는다 |
| `STOP_NOT_FOUND` | 404 | 요청한 `day`/`target_poi_id`가 해당 일정에 없음 |
| `INTERNAL_ERROR` | 500 | 위 어디에도 해당하지 않는 서버 내부 오류 |

---

## 1. 코스 생성 (게스트 가능, 로그인 불필요)

### `POST /api/itineraries/generate`

PRD 3.5절 파이프라인의 서버 진입점. 입력은 구조화 값(필수)과 자유 텍스트(선택)로 분리되며,
LLM은 자유 텍스트 파싱 + 내레이션에만 관여한다. 코스 구조는 알고리즘이 만든다.

**Request**
```json
{
  "start_date": "2026-09-10",
  "end_date": "2026-09-13",
  "companions": 2,
  "relationship": "couple",
  "free_text": "등산이랑 온천 위주로 여행하고 싶어요, 여유롭게 다니고 싶어요",
  "region_codes": ["injae"],
  "lang": "en"
}
```

**`region_codes` — 다중 시군 허용 (수정, 1주차 말 확정)**: 열려 있는 시군(`injae`/`hongcheon`/
`pyeongchang`) 중 **1~3개**를 담을 수 있다. 여러 개가 오면 서버가 **시군을 날짜에 배정한 뒤 각 날은
배정된 단일 시군 안에서만** 코스를 만든다 (PRD 3.5절 0단계). 검증 규칙:

- 길이 1 이상, **`region_codes.length <= 여행 일수`**. 초과 시 400 `INVALID_STRUCTURED_INPUT`
  (예: 2일 여행에 3개 시군). 에러 메시지에 "여행 일수보다 많은 시군은 고를 수 없어요"에 해당하는
  코드를 실어 프론트가 안내할 수 있게 한다.
- 중복 값이 오면 중복을 제거한 뒤 위 규칙을 적용한다.
- 열려 있지 않은 시군 코드가 오면 400 `INVALID_STRUCTURED_INPUT`.

> **왜 좌표 기반 클러스터링이 아니라 날짜 배정인가 (확정)**: 인제↔평창이 약 80km라 전체 POI를 한
> 풀에 넣고 k-means를 돌리면 오전 평창·오후 인제 같은 날이 나온다. 시군을 날짜에 먼저 배정하면
> **하루 안의 이동거리가 단일 시군일 때와 완전히 동일하게 유지되고**, 세 시군이 인제-홍천-평창
> 남북축으로 늘어서 있어 자연스러운 종주 동선이 된다. 부작용으로 **축제 앵커는 그 축제가 속한
> 시군에 배정된 날에만 배치될 수 있다**(효석문화제는 평창 날에만) — 의도된 제약이다.

- `start_date`, `end_date`, `companions`, `relationship`: **필수**. `relationship`은 enum
  (`couple` | `family_with_kids` | `friends` | `solo` | `group`, PRD 3.5절 — 확정 전 초안).
  누락/형식 오류 시 400 (`INVALID_STRUCTURED_INPUT`).
- `free_text`: 선택. 비어 있으면 LLM 파싱을 건너뛰고 기본 `activity_level: "medium"`, `interest: []`로 진행.

**서버 내부 처리 (참고용, 클라이언트에 노출 안 함)**
1. 구조화 입력은 그대로 사용 (LLM 파싱 없음) — `days`는 `start_date`/`end_date`로 서버가 계산
2. `free_text`가 있으면 LLM 호출 — **프롬프트 지시문이 아니라 구조화 출력(스키마 강제)으로 형식을 보장한다**
   (Claude API tool use 사용, PRD 3.7절 벤더 확정). "이 키만 써줘"를 글로 설명하는 방식은 쓰지 않는다 —
   스키마 자체가 그 키 외의 값을 낼 수 없게 만든다. 반복 전송되는 카테고리 마스터 목록·스키마 부분은
   프롬프트 캐싱 대상으로 등록해 비용을 줄인다 (PRD 3.7절).

   **출력 스키마 (tool/function schema로 그대로 등록)**
   ```json
   {
     "type": "object",
     "properties": {
       "weights": {
         "type": "object",
         "properties": {
           "nature_hiking":  { "type": "number", "minimum": 0, "maximum": 1 },
           "onsen_wellness": { "type": "number", "minimum": 0, "maximum": 1 },
           "culture_history":{ "type": "number", "minimum": 0, "maximum": 1 },
           "food_local":     { "type": "number", "minimum": 0, "maximum": 1 },
           "festival_event": { "type": "number", "minimum": 0, "maximum": 1 },
           "shopping":       { "type": "number", "minimum": 0, "maximum": 1 },
           "leisure_sports": { "type": "number", "minimum": 0, "maximum": 1 }
         },
         "required": ["nature_hiking","onsen_wellness","culture_history","food_local","festival_event","shopping","leisure_sports"],
         "additionalProperties": false
       },
       "activity_level": { "type": "string", "enum": ["low", "medium", "high"] }
     },
     "required": ["weights", "activity_level"],
     "additionalProperties": false
   }
   ```
   `additionalProperties: false`와 7개 키의 `required`가 핵심 — 이 두 제약 덕분에 마스터 목록 밖의 키나
   범위를 벗어난 값은 API 레벨에서 아예 나올 수 없다(파싱 실패로 즉시 드러남, 조용히 틀린 값이 섞이지 않음).

   **예시 응답**
   ```json
   { "weights": { "nature_hiking": 0.8, "onsen_wellness": 0.6, "culture_history": 0.2,
     "food_local": 0.5, "festival_event": 0.3, "shopping": 0.1, "leisure_sports": 0.4 },
     "activity_level": "low" }
   ```

   `free_text`가 비어 있으면 이 단계를 건너뛰고 모든 가중치를 0, `activity_level`을 `"medium"`으로 둔다.

   **LLM 호출 실패/스키마 검증 실패 시**: 1회 재시도 → 재시도도 실패하면 `free_text` 비어있을 때와
   동일하게 처리(모든 가중치 0, `activity_level: "medium"`)하고 실패 사실을 로그로 남긴다(PRD 3.7절
   액션 아이템과 동일한 로그에 기록). 코스 생성 자체가 이 때문에 실패해서는 안 됨 — 6장/11.4절
   "외부 API 실패 시 폴백" 확정 항목과 같은 원칙 적용.
3. `pois` 테이블 조회 (region_codes + relationship 필터) → 각 POI의 `tags[]`(같은 마스터 목록 키)와
   가중치를 매칭해 스코어링 → `activity_level`로 하루 스탑 개수 결정(low 2~3 / medium 3~4 / high 4~5,
   PRD 3.5절) → 상위 후보로 클러스터링 → 2-opt 순서 최적화.
   `festival_event`는 예외: 가중치 매칭 전에 `event_start_date`~`event_end_date`가 `start_date`~`end_date`와
   겹치는 row만 후보로 남기고, 겹치는 게 없으면 그 카테고리는 가중치와 무관하게 0으로 처리(에러 아님).
4. LLM 내레이션 + 스탑 한 줄 설명 생성 (**수정 — 1주차 말, 한 번의 호출로 통합**). 이 호출도 같은
   원칙으로 구조화 출력을 쓰며, **코스 요약과 스탑별 `blurb`를 한 응답에서 함께 받는다** — 스탑
   설명을 위해 LLM을 따로 부르면 3초 예산 안에서 호출이 두 번이 되기 때문:
   ```json
   {
     "type": "object",
     "properties": {
       "narration": {
         "type": "object",
         "properties": {
           "ko": { "type": ["string", "null"] },
           "en": { "type": ["string", "null"] },
           "zh": { "type": ["string", "null"] }
         },
         "required": ["ko", "en", "zh"],
         "additionalProperties": false
       },
       "blurbs": {
         "type": "array",
         "items": {
           "type": "object",
           "properties": {
             "poi_id": { "type": "string" },
             "ko": { "type": ["string", "null"] },
             "en": { "type": ["string", "null"] },
             "zh": { "type": ["string", "null"] }
           },
           "required": ["poi_id", "ko", "en", "zh"],
           "additionalProperties": false
         }
       }
     },
     "required": ["narration", "blurbs"],
     "additionalProperties": false
   }
   ```
   - **`ko`가 추가된 이유**: 서비스 기본 언어가 한국어인데 기존 스키마엔 `en`/`zh`만 있어서, 한국어
     화면의 코스 요약 문장에 출처가 없었다(UI 아트보드 검수에서 발견).
   - `blurbs[]`는 **그 코스에 실제로 배치된 스탑 전부**에 대해 반환하며, 서버가 `poi_id`로 매칭해
     응답의 `stops[].blurb`에 넣는다. **매칭되지 않는 `poi_id`가 오면 그 항목은 버린다** — LLM이
     지어낸 장소가 코스에 끼어들지 못하게 하는 안전장치다.
   - 프롬프트에는 **장소명·카테고리·시군만** 넘긴다. 영업시간·가격·연락처처럼 검증 불가능하고 변하는
     정보는 넘기지도, 생성하게 하지도 않는다.
   - 실패 시 `narration`을 `{ "ko": null, "en": null, "zh": null }`, 모든 `stops[].blurb`를 `null`로
     두고 코스 자체는 정상 반환 (부가 기능, 3.5절 — 없어도 코스 생성 수용 기준엔 영향 없음).

> `tags[]`가 마스터 목록 키와 어긋나면 가중치가 전혀 매칭되지 않으므로, 데이터 동기화 시
> TourAPI 원본 카테고리를 이 7개 키로 매핑하는 규칙을 백엔드팀이 `/scripts/sync`에서 관리해야 함.
> 축제 데이터는 TourAPI의 축제/공연/행사 콘텐츠 타입에서 `event_start_date`/`event_end_date`까지
> 함께 동기화 (PRD 4장) — 별도 API 연동 없이 기존 TourAPI 배치 안에서 처리.

**Response 200**
```json
{
  "data": {
    "itinerary_json": {
      "days": [
        {
          "day": 1,
          "date": "2026-09-10",
          "region_code": "pyeongchang",
          "stops": [
            {
              "poi_id": "poi_123",
              "name": "월정사 전나무숲길",
              "category": "nature_hiking",
              "is_indoor": false,
              "lat": 37.7318,
              "lng": 128.5926,
              "order": 1,
              "blurb": { "ko": "천년 전나무가 늘어선 1km 흙길", "en": null, "zh": null },
              "travel_from_prev": null
            },
            {
              "poi_id": "poi_456",
              "name": "평창무이예술관",
              "category": "culture_history",
              "is_indoor": true,
              "lat": 37.5891,
              "lng": 128.3742,
              "order": 2,
              "blurb": { "ko": "옛 분교를 고친 미술관", "en": null, "zh": null },
              "travel_from_prev": { "mode": "car", "minutes": 28 }
            }
          ]
        },
        {
          "day": 2,
          "date": "2026-09-11",
          "region_code": "hongcheon",
          "stops": []
        }
      ],
      "narration": {
        "ko": "전나무 숲길에서 시작해 오후엔 실내로 옮겨가는, 걷는 속도가 느린 3일이에요.",
        "en": null,
        "zh": null
      }
    },
    "preference_weights": {
      "nature_hiking": 0.8, "onsen_wellness": 0.6, "culture_history": 0.2,
      "food_local": 0.5, "festival_event": 0.3, "shopping": 0.1, "leisure_sports": 0.4
    },
    "generated_at": "2026-09-01T12:00:00Z"
  },
  "error": null
}
```

### 스탑 필드 상세 (신규 4종 — 1주차 말 추가, UI 아트보드 검수에서 발견된 계약 누락)

아래 네 가지는 **화면이 이미 그리고 있는데 계약에 없던 값들**이다. 없으면 스탑 카드의 절반이 빈 채로
렌더링된다.

**`blurb` — 스탑 한 줄 설명 (`{ko, en, zh}`)**

`pois` 테이블에도 TourAPI `areaBasedList` 응답에도 설명 필드가 없다. **`narration`을 만드는 LLM
호출에서 함께 생성한다** — 어차피 코스 요약을 위해 LLM을 한 번 부르므로, 같은 응답에 스탑별 한 줄을
포함시키면 **추가 호출도 추가 지연도 없다**(PRD 3.5절 4단계).

- 길이 상한 **40자**(한국어 기준). 넘으면 서버가 자른다 — 카드 한 줄에 들어가야 한다.
- **장소를 소개하는 사실 문장만.** "꼭 가보세요" 같은 권유·홍보 문구 금지, 영업시간·가격처럼 **검증할
  수 없고 변하는 정보 금지**(할루시네이션이 그대로 화면에 나간다).
- LLM 호출 실패 시 **전 스탑 `null`** 로 두고 코스는 정상 반환한다(PRD 3.7절). 프론트는 `blurb`가
  `null`이면 그 줄을 아예 렌더링하지 않는다 — 자리를 비워두거나 대체 문구를 넣지 않는다.
- 요청 `lang`에 해당하는 키와 `ko`만 채워지고 나머지는 `null`이다.

**`travel_from_prev` — 이전 스탑에서의 이동 (`{mode, minutes}` 또는 `null`)**

- 그날 **첫 스탑은 항상 `null`**(이전 스탑이 없음). 프론트는 이 값으로 스탑 사이 구분선을 그린다.
- `mode`: `"car"` | `"walk"`. 직선거리 1km 미만이면 `walk`, 그 외 `car`.
- `minutes`: 카카오모빌리티 Directions 결과(PRD 5장). **호출 실패 시 `null`이 아니라 필드 전체를
  `null`로 두고** 프론트는 이동시간 줄을 생략한다 — 추정값을 지어내지 않는다.

**`is_indoor` — 실내 여부 (boolean)**

`AlertModal`이 "야외 → 실내"로 교체를 설득하는 근거로 쓴다. 카테고리만으로는 표현할 수 없다
(`culture_history`에도 야외 유적이 있다). `pois.is_indoor` 컬럼을 신설해 동기화 시 콘텐츠타입 +
카테고리 매핑 규칙으로 채운다 (PRD 4장). **rain 트리거의 후보 제외 로직은 지금처럼 카테고리 기준을
유지한다** — `is_indoor`는 표시용이며, 판정 근거를 두 개로 나누면 화면과 로직이 어긋난다.

**`days[].region_code` — 그 날에 배정된 시군**

다중 시군 요청일 때 프론트가 날짜 헤더에 "DAY 2 · 홍천"을 표시하기 위한 값. 단일 시군 요청이면 모든
날에 같은 값이 들어간다. `region_codes`가 여러 개여도 **한 날에는 반드시 하나의 시군만** 온다.

---

`preference_weights`는 2번 처리 단계에서 나온 값을 그대로 노출한 것 — 클라이언트가 들고 있다가
저장(§2) 시 그대로 넘겨야 매니징·수동 편집(§3.5)이 재사용할 수 있다. `free_text`가 비어 생성을
건너뛴 경우엔 전부 0으로 채워 반환.

### `days` 배열 불변식 (확정 — 프론트가 의존해도 되는 보장)

**`days`는 `start_date`~`end_date`의 모든 날짜를 빠짐없이, 순서대로 담는다.** 아래 세 가지가 항상 참이다.

1. `days.length` === 여행 일수 (`end_date - start_date + 1`, 양끝 포함)
2. `days[i].day` === `i + 1` — **1부터 연속이며 중간에 빠지는 번호가 없다.** 따라서 배열 인덱스로
   접근해도 안전하다
3. `days[i].date` === 그 일자의 KST 날짜(`YYYY-MM-DD`) — 클라이언트가 `start_date + (day-1)`을
   직접 계산할 필요가 없다
4. `days[i].region_code`는 **항상 단일 시군**이며 요청한 `region_codes` 안의 값이다 (신규 —
   다중 시군 지원). 요청한 시군 각각은 **최소 하루 이상**을 배정받는다 (`region_codes.length <=
   여행 일수` 검증이 이를 보장)

**추천할 장소가 없는 날도 생략하지 않고 `stops: []`로 반환한다.** 그런 날을 배열에서 빼면 (a) 프론트가
"몇 일차가 빠졌는지"를 역산해야 하고 (b) 사용자는 요청한 일수보다 적게 돌아온 이유(데이터 부족인지
버그인지)를 알 수 없다. 프론트는 `stops`가 빈 날에 "이 날은 추천할 장소가 부족합니다" 안내를 띄우고,
다른 시군/기간 선택을 유도한다.

`date`를 서버가 내려보내는 이유: 날짜 계산은 KST 기준이어야 하는데(PRD 6장) 브라우저 타임존은
사용자마다 다르다. 클라이언트가 날짜를 재계산하면 서버가 이미 해결한 타임존 버그가 화면단에서
되살아난다. **프론트는 `date`를 그대로 표시만 하고 자체 계산하지 말 것.**

이 불변식은 저장(§2)·부분 재구성(§3)·매니징(§3) 응답의 `itinerary_json`에도 동일하게 적용된다.
저장 시 서버 검증은 구조(`days`가 `{day, date, stops[]}` 배열인지)만 확인하며, `stops`가 빈 날이
포함되어 있다는 이유로 거부하지 않는다.

**요청한 `region_codes`의 `pois`가 0건일 때 (확정)**: 재시도하지 않고 즉시 명시적 에러를 반환한다 —
이 엔드포인트는 DB만 조회하고(3.5절, TourAPI 실시간 호출 없음) 재시도로 없던 데이터가 채워지지 않으며,
동기화 작업을 그 자리에서 새로 돌리면 3초 응답 기준을 지킬 수 없기 때문. 배치 동기화 자체의 재시도는
백엔드팀 동기화 스크립트가 별도로 처리한다(3.6절, 사용자 요청과 무관하게 백그라운드에서 진행).

```json
{ "data": null, "error": { "code": "NO_POI_DATA", "message": "..." } }
```

프론트는 이 코드를 받으면 "이 지역은 아직 준비 중입니다" 안내와 함께 다른 지역 선택을 유도한다(재시도
버튼을 두더라도 서버 재시도가 아니라 단순 재요청). 데모 대상 3개 시군(인제·홍천·평창)은 1주차 시드
데이터로 항상 채워두므로, 데모 중 실제로 발생하는 걸 막는 게 1차 안전장치다 (8장).

**수용 기준**: PRD 2.1절 — 3초 이내 응답. 이 시점엔 `itineraries` row를 만들지 않는다 (게스트 상태, 클라이언트 메모리 보관).

---

## 2. 코스 저장 (로그인 필요 — 여기서부터 인증 게이트)

### `POST /api/itineraries`

프론트에서 Google 로그인 완료 직후 호출. Authorization 헤더의 Supabase 토큰에서 `auth.uid()`를 검증해
얻은 뒤, 그 id로 `public.users`를 upsert(없으면 생성, 있으면 그대로 두고 진행)하고 같은 트랜잭션에서
`itineraries` row(status: `active`)를 생성한다 — 프론트가 별도 회원가입 API를 먼저 호출할 필요 없음
(PRD 3.9절, 4장 status enum 참고).

**Request** (Authorization 헤더 필수)
```json
{
  "itinerary_json": { "...": "1번 응답에서 받은 것 그대로" },
  "preference_weights": { "...": "1번 응답에서 받은 것 그대로" },
  "region_codes": ["injae"],
  "start_date": "2026-09-10",
  "end_date": "2026-09-13",
  "companions": 2,
  "relationship": "couple"
}
```
`companions`/`relationship`도 §1 요청에서 받은 값 그대로 넘겨서 저장한다 — 매니징 자동 교체·수동 편집의
부분 재구성(PRD 3.5절)이 나중에 `relationship` 필터를 다시 적용할 때 이 값을 읽어오기 때문.

**Response 201**
```json
{
  "data": {
    "itinerary_id": "itn_abc123",
    "status": "active",
    "user_id": "usr_xyz789"
  },
  "error": null
}
```

**수용 기준**: 저장 클릭 → 로그인 완료 → 3초 이내 `status: "active"` 응답 (PRD 2.1절). 이 시점부터 실시간 조건 감시 에이전트(PRD 3.6절)의 감시 대상이 된다.

### `GET /api/itineraries/:id`

저장된 일정 조회 (재방문 시). Authorization 필요, 본인 소유 itinerary만 조회 가능.

### `GET /api/itineraries` (마이페이지 목록 — 신규, 1주차 말 확정)

저장한 코스 목록 조회. Authorization 헤더 필수.

**왜 필요한가**: `GET /api/itineraries/:id`는 id를 이미 알아야 부를 수 있는 API라, 로그인한 사용자가
재방문했을 때 **자기가 저장한 코스로 돌아갈 경로가 없다.** 프론트 랜딩 화면이 "다시 로그인하면 저장한
코스를 이어볼 수 있어요"를 안내하는 이상 이 목록 엔드포인트가 있어야 그 동선이 성립한다.

**Request**: 파라미터 없음 (Authorization 헤더만)

**Response 200**
```json
{
  "data": {
    "itineraries": [
      {
        "id": "itn_abc123",
        "region_codes": ["pyeongchang"],
        "start_date": "2026-09-10",
        "end_date": "2026-09-12",
        "companions": 2,
        "relationship": "couple",
        "stop_count": 8,
        "status": "active",
        "created_at": "2026-09-05T11:20:00+09:00"
      }
    ]
  },
  "error": null
}
```

- **`user_id` 스코핑 필수 (P0)**: 서버는 service_role 클라이언트로 조회하므로 RLS가 적용되지 않는다.
  **반드시 Authorization 토큰에서 검증한 `auth.uid()`로 `where user_id = :uid`를 걸 것** — 빠뜨리면
  전체 사용자의 일정이 노출되는 IDOR이 된다 (1주차 아키텍처 점검에서 `GET /api/itineraries/:id`에
  대해 지적했던 것과 동일한 패턴).
- `status = 'cancelled'`인 row는 응답에서 제외한다.
- `itinerary_json` **전체는 내려주지 않는다** — 목록 화면에는 스탑 수만 필요하므로 서버가
  `jsonb` 안의 스탑 개수를 세어 `stop_count`로만 내려준다 (목록 한 번에 수십 KB가 오가는 것 방지).
- 정렬: `start_date DESC`.
- **"진행 중 / 지난 여행" 구분은 프론트가 `end_date`로 판정한다.** 서버에 상태 전환 배치를 두지 않는다
  (아래 상자 참고).

> **`completed` 상태 전환에 배치·cron을 만들지 않는 이유 (확정)**: PRD 4장 status enum에 `completed`
> (end_date 지남, 감시 제외)가 정의돼 있지만, 이를 위해 매일 도는 전환 작업을 따로 만들 필요가 없다.
> 실시간 조건 감시 에이전트(PRD 3.6절)는 이미 `status = 'active' AND 오늘 날짜가 start_date~end_date
> 사이`인 일정만 스캔하므로, **여행이 끝나면 감시는 조건식만으로 자동으로 멈춘다.** 목록 화면의
> 진행/지난 구분도 `end_date < 오늘`로 계산하면 되므로 DB에 저장된 `status` 값을 바꿀 이유가 없다.
> 따라서 `completed`는 이번 데모에서 **실제로 기록되지 않는 값**이며, `active`인 채로 기간이 지난
> 일정을 프론트가 "지난 여행"으로 표시한다.

### `DELETE /api/itineraries/:id` (마이페이지 삭제 — 신규, 1주차 말 확정)

저장한 코스 삭제. Authorization 헤더 필수.

**소프트 삭제다** — row를 제거하지 않고 `status`를 `cancelled`로 UPDATE한다 (PRD 4장 status enum의
`cancelled` = 사용자 삭제). 이렇게 하는 이유:

- `alerts`가 `itinerary_id`를 FK로 물고 있어(ERD §1) 물리 삭제 시 매니징 로그가 함께 사라진다.
  알림 발생·응답 기록은 데모 이후 회고 자료이자 3.6절 로직 검증 근거라 남겨두는 편이 낫다.
- 감시 대상에서는 즉시 빠진다 — 에이전트 스캔 조건이 `status = 'active'`이므로 `cancelled`로 바뀌는
  순간 자동으로 제외된다. 별도 해제 처리가 필요 없다.

**Response 200**
```json
{ "data": { "id": "itn_abc123", "status": "cancelled" }, "error": null }
```

- 본인 소유가 아니면 `403 FORBIDDEN`, 존재하지 않는 id면 `404 NOT_FOUND` (§0.1).
- 이미 `cancelled`인 id를 다시 호출해도 `200`으로 같은 응답을 준다 (멱등).

---

## 3. 실시간 매니징

### Realtime 구독 (REST 아님 — Supabase Realtime 채널)

- 채널명: `alerts:itinerary_id=eq.{itinerary_id}` (itinerary 단위 구독, PRD 6장 검토사항 — 전체 브로드캐스트 아님)
- 프론트는 저장 완료 후 이 채널을 구독. 새 `alerts` row가 insert되면 push로 수신.

**중요: 알림은 항상 "제안"이다.** `alerts` row가 insert되는 시점엔 `itinerary_json`이 아직 안 바뀐다 —
사용자가 Yes로 응답해야 실제로 적용된다 (PRD 3.5절, 2단계 확인 흐름). 예전 초안의 `changed_stops`
(이미 적용된 걸로 오해되는 이름)와 `alternative_itinerary_json`은 폐기.

**Payload (서버 → 클라이언트)** — 제안된 스탑 하나만, 아직 미적용
```json
{
  "alert_id": "alt_001",
  "itinerary_id": "itn_abc123",
  "trigger_type": "weather",
  "condition": "rain",
  "status": "proposed",
  "message": { "en": "It's raining. Replace Odaesan hiking with Alpensia?", "zh": null },
  "proposed_stop": {
    "day": 2,
    "previous_poi_id": "poi_odaesan_hiking",
    "candidate_poi": { "poi_id": "poi_alpensia", "name": "...", "category": "...", "lat": 0, "lng": 0 }
  },
  "triggered_at": "2026-09-01T13:00:00Z"
}
```

프론트는 이 payload로 Yes/No 확인 모달만 띄운다. `itinerary_json`은 건드리지 않는다.

> 리허설 문구는 PRD 11.5절의 질문형 톤("비가 옵니다, [야외 스탑] 대신 [대체 장소]로 변경할까요?" 형태)을
> 그대로 살리되, 실제 장소명은 팀이 확정한 시드 데이터의 POI명으로 채운다(예시로 쓴 위 JSON의
> "Odaesan"/"Alpensia"도 마찬가지로 자리표시자일 뿐 고정값 아님). 문구가 질문형인 이유가 이 2단계
> 흐름 — 알림 자체가 이미 적용된 변경사항이 아니라 확인 요청이다.

### `POST /api/alerts/trigger` (데모 전용 강제 트리거 — "제안"만 생성)

**Authorization 필요, 본인 소유 itinerary만** (백엔드팀 확정 — 계약에 명시 안 돼 있었으나, 전제 조건이
"저장된(로그인) 일정"이라 인증 없이 호출될 수 없음). 아래 `regenerate-stop`, `respond`도 동일.

라이브 데모의 "강제 트리거 버튼"이 호출. §1의 카테고리 가중치 스키마와 같은 스코어링 로직을 쓰되,
PRD 3.5절의 "상황별 조정표"로 `preference_weights`를 먼저 보정한 뒤 후보 1개를 계산 — **여기서
`itinerary_json`에 반영하지 않고 `alerts` row(status: proposed)만 생성**하고 Realtime push.

`condition: "traffic"`인 경우엔 카테고리 조정 대신 거리 기준으로 후보를 재선정한다 — 교체 대상 스탑
바로 이전 스탑의 좌표(대상이 그날 첫 스탑이면 대상 자신의 좌표)를 기준점으로, 그로부터 이동시간 15분
이내로 후보를 먼저 좁힌 뒤 `preference_weights`로 순위를 매긴다(PRD 3.5절). 실제 조건 감시 에이전트
(cron)가 이 조건을 자동 판단할 땐 그날 인접 스탑 쌍의 구간 이동시간(카카오모빌리티 Directions API
`duration`)을 순서대로 전부 확인해 1시간 넘는 첫 구간을 찾고 그 뒤쪽 스탑을 대상으로 삼는다 — 사용자의
실시간 위치를 추적하는 게 아니라 그날 이미 정해진 일정을 스캔하는 것뿐이다(PRD 3.5절).

**Request**
```json
{
  "itinerary_id": "itn_abc123",
  "trigger_type": "weather",
  "condition": "rain",
  "day": 2,
  "target_poi_id": "poi_odaesan_hiking"
}
```
`day`/`target_poi_id`는 **이 데모 전용 엔드포인트에서만 필수**다 — 실제 조건 감시 cron은 위 스캔
로직으로 대상을 스스로 찾지만, 라이브 데모의 강제 트리거 버튼은 리허설마다 항상 같은 스탑을 겨냥해야
하므로 프론트가 직접 지정한다(`regenerate-stop`과 동일한 필드, PRD 3.5절).

**Response 200**: 위 Realtime payload와 동일한 alert 생성 (`alerts` insert, status: proposed → Realtime push).

**중복 방지**: insert 전에 같은 `itinerary_id`+`day`+`previous_poi_id` 조합으로 `status='proposed'`인
row가 이미 있는지 확인하고, 있으면 새로 만들지 않고 기존 alert의 내용을 반환한다(재-push는 하지 않음).
**이때도 응답 본문은 신규 생성 때와 완전히 동일한 형태여야 한다** — `alert_id`만 담아 보내면 안 되고,
기존 alert row의 `previous_poi_id`/`proposed_poi_id`로 `message`와 `proposed_stop`을 다시 조립해서 채운다
(1주차 아키텍처 점검에서 발견 — 리허설 중 강제 트리거 버튼을 두 번 누르거나, 조건 감시 cron이 먼저
같은 알림을 만들어둔 경우 프론트가 빈 모달을 띄우게 된다).
실제 조건 감시 에이전트(5~10분 cron, PRD 3.6절)가 이 엔드포인트와 같은 로직을 내부적으로 돌 때도 동일하게
적용 — 그래야 조건이 계속 참인 동안 매 주기마다 중복 알림이 쌓이지 않는다 (PRD 3.5절).

**수용 기준**: 버튼 클릭 후 3초 이내 확인 모달 표시 (PRD 2.1절). 이 시점엔 아직 아무것도 안 바뀜.

### `POST /api/alerts/:alert_id/respond` (Yes/No 응답 — 실제 적용은 여기서만 일어남)

**Request**
```json
{ "response": "yes" }
```
- `response: "yes"`: `alerts.proposed_poi_id`로 저장해둔 후보를 그 날짜 스탑 배열에 실제 반영,
  해당 날짜만 2-opt 재정렬, `alerts.status`를 `confirmed`로 갱신
- `response: "no"`: `itinerary_json` 변경 없음, `alerts.status`를 `dismissed`로 갱신, `responded_at` 기록

**타임아웃 자동 dismiss와의 차이**: 3분 무응답 시에도 `dismissed`가 되지만(PRD 3.6절), 그건 이 엔드포인트가
아니라 조건 감시 cron이 직접 DB를 갱신하는 것이고, `responded_at`을 NULL로 남겨 "사용자가 실제로 No를
누른 경우"와 구분한다. 프론트는 3분 경과 시 이 엔드포인트를 호출할 필요 없이 그냥 확인 모달을 닫으면 됨.

**Response 200**
```json
{
  "data": { "status": "confirmed", "updated_stop": { "poi_id": "poi_alpensia", "day": 2 } },
  "error": null
}
```

**수용 기준**: Yes 클릭 후 3초 이내 화면에 교체된 스탑만 강조 반영 (코스 전체 재렌더링 아님, PRD 2.1절).

### `POST /api/itineraries/regenerate-stop` (부분 재구성 — 매니징과 수동 편집 공용)

PRD 3.5절 "부분 재구성" 경로 중 **수동 편집 전용** 엔드포인트 (Must-have, PRD 2.1절). 매니징 자동
트리거는 이 엔드포인트를 호출하지 않고 `POST /api/alerts/trigger`가 같은 스코어링 로직을 자체적으로
수행한다 — 이유는 트리거 쪽엔 "제안만 하고 적용은 나중에(Yes 응답 시)"라는 별도 흐름이 필요하기
때문(위 §3 참고). 수동 편집은 사용자가 이미 그 자리에서 선택/확정하는 액션이라 즉시 적용해도 된다.

**Request**
```json
{
  "itinerary_id": "itn_abc123",
  "day": 2,
  "target_poi_id": "poi_odaesan_hiking",
  "reason": "user_request",
  "free_text": "조용한 카페 같은 곳으로 바꿔줘"
}
```
- `itinerary_id`: 저장된 일정만 대상 (게스트 상태의 코스는 부분 재구성 미지원 — 저장 후에만 가능)
- `reason`: 항상 `user_request` (트리거 전용 값은 쓰지 않음 — 트리거는 `/api/alerts/trigger` 경로)
- `free_text`: 선택. 값이 있으면 §1과 **같은 구조화 출력 스키마**(7개 카테고리 가중치)를 이 텍스트
  하나에만 적용해 이 스탑 전용 가중치를 새로 뽑는다. 값이 없으면(텍스트 없이 "다시 추천"만 누른 경우)
  `itineraries.preference_weights`(원래 코스 생성 때 계산된 가중치, PRD 4장)를 그대로 재사용 —
  매번 LLM을 다시 부르지 않는다.

**후보 개수는 항상 최대 3개, 즉시 반영 없음 (단순화 — 이전 초안의 `candidate_count` 파라미터 폐기)**:
수동 편집은 PRD 2.1절 Must-have 기준 항상 "후보 최대 3개 제시 → 사용자가 골라서 확정" 흐름만 쓰고,
자동 1개 즉시 반영 경로를 쓰는 호출자가 실제로는 없다(매니징 자동 트리거는 이 엔드포인트 자체를
안 쓰고 `/api/alerts/trigger`가 내부적으로 자체 처리하기 때문, 위 §3 참고). 그래서 후보를 몇 개
반환할지 고르는 파라미터 자체를 없애고 항상 후보 배열만 반환하도록 정리했다.

**Response 200**
```json
{
  "data": {
    "candidates": [
      { "poi_id": "poi_alpensia", "name": "...", "category": "...", "lat": 0, "lng": 0 }
    ]
  },
  "error": null
}
```
`itinerary_json`은 아직 안 바뀐다. 사용자가 후보 중 하나를 고르면 `PATCH /api/itineraries/:id`(아래)를
호출해 확정한다.

### `PATCH /api/itineraries/:id` (수동 편집 확정 시에만 사용)

사용자가 `regenerate-stop` 후보 중 하나를 고른 뒤 저장. Authorization 필요, 본인 소유만.

**Request**
```json
{ "day": 2, "target_poi_id": "poi_odaesan_hiking", "new_poi_id": "poi_alpensia" }
```

**`target_poi_id` (추가 — 백엔드팀 제안, 확정)**: 하루에 스탑이 여러 개일 때 `day`만으로는 "그 날짜의
어느 스탑을 교체하는지" 특정할 수 없다(`regenerate-stop` 응답의 `candidates`가 상태를 들고 있지 않아
서버가 대상을 추론할 수 없음). 원래 교체 대상이었던 스탑의 `poi_id`를 그대로 다시 보내 명시한다 —
`regenerate-stop` 요청 때 보낸 `target_poi_id`와 동일한 값.

**Response 200**
```json
{
  "data": { "itinerary_json": { "...": "갱신된 전체 코스" }, "day_reordered": true },
  "error": null
}
```
이 호출도 해당 날짜만 2-opt 재정렬(`candidate_count: 1` 경로와 동일 로직, PRD 3.5절 5단계) 후
전체 `itinerary_json`을 반환한다 — 사용자가 명시적으로 확정한 경우라 클라이언트가 최신 상태를
다시 받는 게 안전하기 때문.

---

## 4. 여행 케어 안내 (로그인 불필요, 항상 접근 가능)

### `GET /api/care?region_code=injae`

정적 큐레이션 데이터 반환 (의료시설/응급연락처). PRD 2.1절 — 시군당 최소 5건.

> **`region_code`(단수) — 의도적으로 다른 엔드포인트의 `region_codes`(배열)와 다른 이름**: 이 GET
> 쿼리 파라미터는 단일 값 하나만 받는다(쿼리스트링이라 배열 표기가 지저분해지는 것 방지). itinerary
> 관련 요청/응답의 `region_codes[]`(항상 1개만 담김, PRD 3.5절)와 헷갈리지 않도록 이름을 다르게
> 뒀다 — `region_codes[]=injae` 같은 배열 표기로 보내지 말 것.
>
> **다중 시군 코스일 때 (신규)**: 케어 안내는 코스와 무관하게 항상 접근 가능한 별도 화면이므로
> 이 엔드포인트는 계속 **시군 하나**만 받는다. 프론트는 사용자가 보고 있는 날의
> `days[].region_code`(또는 사용자가 화면에서 고른 시군)를 넘긴다. 여러 시군을 한 번에 조회하지 않는
> 이유는, 응급 상황에서 필요한 건 "지금 있는 곳 근처"이지 여행 전체 범위가 아니기 때문이다.

**Response 200** (수정 — 1주차 말, 데이터 소스 교체에 따라 `name_ko` 추가)
```json
{
  "data": [
    {
      "name_ko": "인제군보건소",
      "name_en": "Inje County Health Center",
      "name_zh": "麟蹄郡保健所",
      "category": "health_center",
      "phone": "033-460-2244",
      "address_ko": "강원특별자치도 인제군 인제읍 ...",
      "lat": 38.0695,
      "lng": 128.1707
    }
  ],
  "error": null
}
```

- **한국어와 사용자 언어를 항상 병행 표기한다 (확정).** `name_ko`를 크게, `name_en`/`name_zh`를
  그 아래 작게 — **둘 다 보여준다.** 한국어가 필요한 이유는 응급 상황에서 외국인이 택시 기사나
  행인에게 그대로 보여줘야 하기 때문이고, 자국어가 필요한 이유는 **어디로 가는 곳인지 본인이 알아야
  하기 때문**이다. 둘 중 하나만으로는 안 된다.
- **`name_en`/`name_zh`는 동기화 시점에 채운다** — 응급의료기관·보건기관 표준데이터는 한국어
  명칭만 주므로 배치 동기화 중 1회 생성한다(런타임 번역 아님, 시설 수십 건 규모의 일회성 작업).
  **시설 종류 접미사(보건소/보건지소/보건진료소/응급실 등)는 LLM이 아니라 고정 사전으로 강제
  매핑**하고 지명 부분만 생성한다 — 안전 기능이라 "보건지소"가 "clinic"과 "health center"로
  들쭉날쭉하면 안 된다. 생성 실패 시 해당 언어는 `null`로 두고 `name_ko`만 표시한다.
- **`phone`·`lat`/`lng`·`address_ko`는 원본 값을 그대로 쓴다** — 번역·가공 대상이 아니다.
  PRD 6장 다국어 키 원칙에 대한 의도적 예외이며 근거는 PRD 8장 상자에 기록.
- `category`는 다국어 키로 처리한다 (`emergency_room` / `health_center` / `health_subcenter` /
  `hospital`) — UI 라벨은 프론트가 언어별로 렌더링.
- `phone`이 `null`이면 전화 버튼을 렌더링하지 않는다. **틀린 응급연락처를 보여주느니 없는 편이
  낫다** (PRD 4장).

SOS 버튼은 별도 API 호출 없이 클라이언트에서 `tel:119` 링크만 연다 (PRD 2.1절).

---

## 5. 확정 필요 (백엔드팀 결정 → 이 문서 갱신)

- ~~`PATCH /api/itineraries/:id`에서 교체 대상 스탑을 특정할 방법~~ → 해결됨: `target_poi_id` 추가 (§3,
  하루에 스탑이 여럿일 때 `day`만으로 대상 특정 불가 — 1주차 백엔드 구현 중 발견해 확정)
- ~~`regenerate-stop`/`alerts trigger`/`alerts respond`의 인증 요구 여부~~ → 해결됨: 셋 다 Authorization
  필수 (§3 — 저장된 일정 전제이므로 게스트 호출 불가)

- ~~traffic(혼잡) 트리거의 상황별 후보 재선정 기준~~ → 해결됨: 이동시간 1시간 초과 시 트리거, 현재 위치
  기준 15분 이내 후보로 재선정 (PRD 3.5절, §3 `POST /api/alerts/trigger`)
- ~~`alerts`가 `proposed` 상태로 오래 방치될 때 처리~~ → 해결됨(PRD 3.6절): 3분 무응답 시 조건 감시
  cron이 자동으로 `dismissed` 전환(`responded_at`은 NULL로 남겨 사용자의 실제 No 클릭과 구분, PRD 4장)
- ~~Google 로그인 실패·거부 시 응답 형식~~ → 대부분 해결됨(PRD 3.9절, UX는 재시도 버튼으로 확정).
  다만 이건 Supabase Auth OAuth 팝업이 클라이언트 단에서 실패하는 경우라 원칙적으로 이 백엔드 API를
  타지 않음 — 팝업 성공 후 토큰 검증 자체가 실패하는 예외 케이스(`POST /api/itineraries` 401)는
  §2의 공통 인증 에러 형식을 그대로 따르면 되므로 별도 스펙 불필요
- ~~외부 API 실패 시 폴백 UX 원칙~~ → 해결됨(PRD 6장): TourAPI는 배치 동기화 전용이라 `/generate` 요청
  시점엔 실시간 호출 자체가 없음 — 동기화 실패해도 DB엔 마지막 성공 데이터가 남아있어 자연 폴백됨.
  ~~특정 시군 `pois` 0건일 때 `/generate` 응답~~ → 해결됨: 재시도 없이 즉시 `NO_POI_DATA` 에러 반환 (§1)
- ~~에러코드 표준 전반~~ → 해결됨: §0.1에 전체 목록 확정 (1주차 아키텍처 점검)
- ~~LLM 벤더~~ → 해결됨: Claude API tool use로 확정 (PRD 3.7절). §1의 구조화 출력 스키마는 원래
  벤더 상관없이 이식 가능하게 설계돼 있었어서 이 결정으로 인한 스키마 변경은 없음
- LLM 가중치 출력 **일관성**(같은 입력을 넣었을 때 값이 얼마나 흔들리는가) 검증 결과에 따라 `weights` 값을
  연속값(0~1) 그대로 둘지, 이산 단계(낮음/보통/높음/매우높음 → 0.2/0.5/0.75/1.0)로 서버에서 정규화할지
  (PRD 3.5절, `TEST_PLAN.md` §2). §1의 JSON 스키마는 **형식**(키 이름·범위)만 강제할 뿐 **일관성**까지
  보장하진 않으므로 이 항목은 스키마 도입 후에도 별개로 남아있음 — 혼동 주의.
