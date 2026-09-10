# /scripts/sync — 데이터 동기화 (PRD 5장/8장)

## 실행

```bash
cd scripts/sync
cp .env.example .env   # 값 채우기
npm install

node sync_pois.js       # TourAPI 배치 동기화 (TOURAPI_SERVICE_KEY 필요) — 인제/홍천/평창 실데이터
node sync_festivals.js  # 전국문화축제표준데이터 배치 동기화 (FESTIVAL_SERVICE_KEY/FESTIVAL_BASE_URL 필요)
                         # — TourAPI 축제 데이터가 거의 없어 보완용
node sync_medical.js    # 실제 의료관광정보 배치 동기화 (MEDICAL_TOURISM_SERVICE_KEY 필요) —
                         # 인제/홍천/평창 전부 0건으로 확인됨, 아래 "실데이터 현황" 참고
node ldong_lookup.js    # 의료관광정보 지역코드 1회 조회 유틸 — REGION_TO_LDONG은 이미 채워져 있음

node seed_pois.js       # 개발·테스트 전용 — 데모 DB에는 적재하지 않음 (아래 참고)
node seed_care.js       # 데모 DB에도 여전히 적재됨 (care_facilities만, 아래 참고)
```

## serviceKey 이중 인코딩 (라운드3 P0, 실측으로 확인된 유일한 해법)

공공데이터포털이 발급하는 "Encoding" 키를 `URLSearchParams`에 넣으면 이미 인코딩된 문자를 또
인코딩해서(`%2B` → `%252B`) `SERVICE_KEY_IS_NOT_REGISTERED_ERROR`(HTTP 403)가 난다.
`tourapi_client.js`/`medical_client.js`/`agent/src/weather.js`/`sync_festivals.js` 전부
**`serviceKey`만 `URLSearchParams` 밖으로 빼서 URL 문자열에 그대로 붙인다** — 나머지 파라미터는
지금처럼 인코딩. 새 API 클라이언트를 추가할 때도 이 패턴을 따를 것.

## `sigunguCode`가 전부 틀려 있었음 (라운드3, 실측으로 발견)

`tourapi_client.js`의 `REGION_TO_SIGUNGU`가 라운드1부터 추정치로 남아 있었는데, 실제
`areaCode2?areaCode=32` 조회 결과 **전부 틀렸다** — 인제=5는 실제로 속초시, 홍천=3은 동해시,
평창=7은 양양군 데이터였다("평창" 89건 전부에 대관령/진부/봉평/월정사 등 평창 지명이 하나도
없고 양양송이축제/낙산사/남애항처럼 양양 지명만 나오는 것으로 확인). 올바른 값(`areaCode2` 응답
전량 확인)으로 교정: **인제=10, 홍천=16, 평창=15**. 재동기화로 잘못된 데이터는 이미 정리됨
(synced_at 기준 자동 정리, 아래 참고).

## `days` 배열 불변식과의 관계는 없음 — 별개로, TourAPI → 7개 카테고리 매핑 규칙 (`category_mapping.js`)

PRD 3.5절/API_CONTRACT.md §1이 "세부 매핑은 백엔드팀이 구현하면서 확정"이라고 위임한 부분.

| PRD 7개 카테고리 | TourAPI 기준 |
|---|---|
| `nature_hiking` | cat1=`A01`(자연) |
| `onsen_wellness` | cat2=`A0202`(휴양관광지 — 온천/스파/자연휴양림 등) |
| `culture_history` | contentTypeId=`14`(문화시설) 또는 cat2 in {`A0201`,`A0203`,`A0204`,`A0205`,`A0206`} |
| `food_local` | contentTypeId=`39`(음식점) 또는 cat1=`A05` |
| `festival_event` | contentTypeId=`15`(축제공연행사) 또는 cat2 in {`A0207`,`A0208`} |
| `shopping` | contentTypeId=`38`(쇼핑) 또는 cat1=`A04` |
| `leisure_sports` | contentTypeId=`28`(레포츠) 또는 cat1=`A03` |

어느 것도 매칭 안 되면(숙박=B02, 여행코스=C01 등) 동기화 대상에서 제외 — PRD 2.3절 스코프 밖.

## 전국문화축제표준데이터 (`sync_festivals.js`, 라운드3 신규)

TourAPI 축제 콘텐츠타입(15)이 강원 3개 시군에 거의 없어서(축제 2건뿐) 행안부 표준데이터로 보완.

- 응답 최상위가 `response.body`가 아니라 **`body`** 바로 아래(`header`/`body`) — TourAPI/의료관광정보와
  다름, 실측 확인.
- 파라미터는 `type=json`(TourAPI 계열의 `_type`과 다름), `pageNo`/`numOfRows`.
- 지역 파라미터가 없어 전량(1,305건)을 받아 `rdnmadr`/`lnmadr` 주소 문자열로 "인제군"/"홍천군"/
  "평창군" 포함 여부를 필터.
- 좌표(`latitude`/`longitude`)가 빈 로우가 많음(과거 연도 상당수) — `geo_validate.js`의
  `isValidKoreaCoord`로 제외.
- 고유 ID 필드가 없어 `insttCode` + 축제명 + 시작일을 해시해 `content_id`를 결정론적으로 생성
  (`fest-<insttCode>-<hash12>`) — 같은 입력이면 항상 같은 값이라 upsert가 안정적으로 동작.

## POI/시설 id 안정성 (`content_id`, 라운드2에서 추가, 라운드3에서 정리 로직 보강)

`pois`/`care_facilities` 모두 `content_id` 기준으로 upsert한다 — delete+insert 방식은 재동기화마다
새 uuid를 발급해서 매니징 에이전트의 재조회가 깨지는 문제가 있었다. 라운드3부터는 지역별
`synced_at < 이번 실행 시각` 기준으로 이번 목록에 없었던 로우(폐업/종료된 축제 등)까지 정리한다
(`sync_pois.js`/`sync_medical.js`/`sync_festivals.js` 공통 패턴) — `content_id is null` 로우만
지우던 이전 방식으로는 목록에서 사라진 POI가 영구히 남는 문제를 못 잡았다.

**주의**: `seed_pois.js`는 이 패턴을 쓰지 않는다 — 실데이터로 전환한 뒤 실수로 돌리면 "이번 시드
목록보다 오래된" 실데이터가 전부 삭제돼버리기 때문. 자세한 이유는 파일 내 주석 참고.

## 실데이터 현황 (라운드3, 2026-09-10 실측)

시드 → 실데이터 전환 완료(PRD 8장 방침). 시군별 최종 건수/카테고리 분포, 리허설 장소 대체안,
축제 동기화 결과는 `docs/HANDOFF_LOG.md`의 라운드3 완료 항목에 정리되어 있다. 요약:

- `pois`: 시드(41건, `content_id`가 `seed-`로 시작) 전부 제거됨, TourAPI + 전국문화축제표준데이터
  실데이터만 존재.
- `care_facilities`: **여전히 시드만 존재** — `sync_medical.js`로 인제/홍천/평창을 조회하면 3개
  시군 전부 0건이다. 강원도 전체에 등록된 의료관광 인증 시설이 원주시 2곳뿐이라(API/파라미터
  문제 아님, 실측 확인), 이 지역엔 애초에 대체할 실데이터가 없다. PRD 8장 "실데이터 전환" 원칙을
  이 테이블에는 적용하지 않기로 했다 — SOS/의료 안내는 항상 접근 가능해야 하는 안전 기능이라
  빈 목록보다 출처를 알 수 있는 목업이 낫다고 판단(`seed_care.js` 파일 내 주석 참고). PM 확인 필요.
- 기상청 단기예보 API는 `serviceKey` 인코딩을 고쳤는데도 여전히 `SERVICE_KEY_IS_NOT_REGISTERED_ERROR`
  (HTTP 403)다 — TourAPI/의료관광정보/축제 API는 같은 방식으로 전부 성공했으므로 인코딩 문제가
  아니라, 이 키가 이 API 상품에 대해 활용신청/승인이 안 된 상태일 가능성이 높다. 공공데이터포털에서
  "국내여행 단기예보 조회서비스"(또는 동일 상품) 활용신청 상태 확인 필요.
