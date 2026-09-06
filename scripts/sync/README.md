# /scripts/sync — 데이터 동기화 (PRD 5장/8장)

## 실행

```bash
cd scripts/sync
cp .env.example .env   # 값 채우기
npm install

node seed_pois.js       # 1주차 시드: 인제/홍천/평창 POI (즉시 실행 가능, 외부 API 키 불필요)
node seed_care.js       # 1주차 시드: 여행 케어 안내 데이터

node sync_pois.js       # 실제 TourAPI 배치 동기화 (TOURAPI_SERVICE_KEY 필요)

node ldong_lookup.js    # 의료관광정보 지역코드 1회 조회 (MEDICAL_TOURISM_SERVICE_KEY 필요) —
                         # 출력된 lDongRegnCd/lDongSignguCd를 medical_client.js의 REGION_TO_LDONG에 채워넣을 것
node sync_medical.js    # 실제 의료관광정보 배치 동기화 (위 REGION_TO_LDONG을 먼저 채워야 동작)
```

TourAPI/의료관광정보 API 서버(`apis.data.go.kr`)가 현재 장애라(docs/HANDOFF_LOG.md 2026-09-07 00:30
항목) 위 실호출 3개는 서버 복구 전까지 실행해도 실패한다 — 코드/스펙은 확정 반영해뒀다.

## TourAPI → 7개 카테고리 매핑 규칙 (이번 세션에서 확정, `category_mapping.js`)

PRD 3.5절/API_CONTRACT.md §1이 "세부 매핑은 백엔드팀이 구현하면서 확정"이라고 위임한 부분.
`docs/HANDOFF_LOG.md`에도 근거를 기록했다.

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

## 의료관광정보 서비스(MdclTursmService) 스펙 (라운드2에서 확정, `medical_client.js`)

- base URL: `https://apis.data.go.kr/B551011/MdclTursmService` (라운드1의 `MedicalTourismService`는 오타였음)
- `/areaBasedList` 목록 응답에 `tel`/`mapX`/`mapY`/`baseAddr`가 이미 포함돼 `/detailCommon` 호출 불필요
- 응답 필드는 **camelCase**(`contentId`, `mapX`, `mapY` 등) — TourAPI(KorService2)는 반대로 전부
  소문자라 두 스크립트를 같은 케이싱 규칙으로 통일하면 안 됨
- `langDivCd`는 ENG/JPN/CHS/RUS만 있고 한국어가 없음 — ENG·CHS 두 번 호출해 `contentId` 기준으로 병합
- 지역코드(`lDongRegnCd`/`lDongSignguCd`)는 API 자체 부여값이라 추측 불가 — `ldong_lookup.js`를
  실제 서비스키로 1회 실행해 확인 후 `medical_client.js`에 하드코딩

## POI/시설 id 안정성 (`content_id`, 라운드2에서 추가)

`pois`/`care_facilities` 모두 이제 `content_id`(TourAPI/의료관광정보 원본 콘텐츠 ID) 기준으로
upsert한다 — 예전 delete+insert 방식은 재동기화마다 새 uuid를 발급해서, `itineraries.itinerary_json`
스냅샷이 들고 있는 옛 poi_id로 매니징 에이전트가 `pois`를 재조회하면 0건이 되고 rain 트리거가 로그
한 줄 없이 영구 무동작이 되는 문제가 있었다. 시드 데이터에도 `seed-<region>-NNN` 형태의 임의
content_id를 부여해 같은 규칙을 따르게 했다.

## 시드 데이터 관련 참고

- `seed/pois_seed.json`: 좌표는 각 장소의 공개적으로 알려진 대략 위치를 기반으로 한 근사치다.
  실제 TourAPI 동기화(`sync_pois.js`)가 정확한 mapx/mapy로 덮어쓴다.
- `festival_event`는 "평창 효석문화제"(이효석문학관 일대, 실제 매년 9월 개최되는 축제) 1건 포함,
  리허설 기간(3주차, 9/14~9/20)과 겹치도록 `event_start_date`/`event_end_date`를 2026-09-10~09-19로
  설정했다 — 실제 2026년 정확한 개최일은 아직 확인 전이라 리허설 전 재확인 필요.
- 인제/홍천에도 축제 앵커 로직을 시연할 수 있도록 **데모 전용 가상 축제** 2건을 추가했다(1주차
  아키텍처 점검 요청) — "인제 자작나무숲 단풍축제(데모)"(09-15~09-16), "홍천강 억새축제(데모)"
  (09-17~09-18). **실제로 존재하는 축제가 아니다** — 이름에 "(데모)"를 붙이고 `category`도
  "지역축제(데모 픽스처)"로 표시해 실제 축제와 구분되게 했다. 실제 TourAPI 축제 데이터가 들어오면
  이 두 로우는 자연히 덮어써진다. 좌표는 각각 원대리 자작나무숲/홍천강 실제 POI와 겹치지 않도록
  300m 정도 떨어뜨렸다(라운드2 점검 #10 — 지도에서 두 마커가 완전히 겹치던 문제).
- 매니징 리허설 문구용 2곳(PRD 8장)은 평창 "월정사 전나무숲길"(야외, 우천 시 교체 대상)과
  "평창무이예술관"(실내, 대체 후보)으로 정했다.
- `adult_only: true`는 3건(인제 "내린천"-래프팅, 홍천 "힐리언스 선마을"-웰니스 리조트, 평창
  "알펜시아리조트"-스키점프 체험)에 표시했다 — 세 곳 모두 연령/체중 제한이 있는 액티비티 유형이라
  개연성 있게 골랐지만, **실제 시설의 정확한 연령 제한 정책을 확인한 값은 아니다**. `family_with_kids`
  필터 로직을 QA가 검증할 수 있게 만든 테스트 픽스처 플래그로 이해할 것 — 실제 서비스 전환 시
  각 시설의 실제 정책으로 재확인 필요.
- `seed/care_seed.json`: 병원/보건지소 전화번호는 실제 확인 전이라 `119`(응급) 외엔 `null`로
  비워뒀다 — 잘못된 응급연락처 노출 리스크가 커서, 실제 번호는 `sync_medical.js` 실동기화로
  채우는 게 맞다고 판단했다 (`docs/HANDOFF_LOG.md` 블로커 참고). 이름/주소는 의료관광정보 서비스가
  한국어를 제공하지 않는다는 라운드2 확정 스펙에 맞춰 `name_en`/`name_zh`/`address_en`/`address_zh`로
  기계적으로 번역했다(읍/면/보건지소/보건의료원의 표준 영문·한자 표기 사용) — 실제 API 데이터가
  이 값을 그대로 덮어쓴다.
