# /scripts/sync — 데이터 동기화 (PRD 5장/8장)

## 실행

```bash
cd scripts/sync
cp .env.example .env   # 값 채우기
npm install

node seed_pois.js       # 1주차 시드: 인제/홍천/평창 POI (즉시 실행 가능, 외부 API 키 불필요)
node seed_care.js       # 1주차 시드: 여행 케어 안내 데이터

node sync_pois.js       # 실제 TourAPI 배치 동기화 (TOURAPI_SERVICE_KEY 필요)
node sync_medical.js    # 실제 의료관광정보 배치 동기화 (MEDICAL_TOURISM_SERVICE_KEY 필요, 응답 스키마 미검증)
```

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
  이 두 로우는 자연히 덮어써진다.
- 매니징 리허설 문구용 2곳(PRD 8장)은 평창 "월정사 전나무숲길"(야외, 우천 시 교체 대상)과
  "평창무이예술관"(실내, 대체 후보)으로 정했다.
- `adult_only: true`는 3건(인제 "내린천"-래프팅, 홍천 "힐리언스 선마을"-웰니스 리조트, 평창
  "알펜시아리조트"-스키점프 체험)에 표시했다 — 세 곳 모두 연령/체중 제한이 있는 액티비티 유형이라
  개연성 있게 골랐지만, **실제 시설의 정확한 연령 제한 정책을 확인한 값은 아니다**. `family_with_kids`
  필터 로직을 QA가 검증할 수 있게 만든 테스트 픽스처 플래그로 이해할 것 — 실제 서비스 전환 시
  각 시설의 실제 정책으로 재확인 필요.
- `seed/care_seed.json`: 병원/보건지소 전화번호는 실제 확인 전이라 `119`(응급) 외엔 `null`로
  비워뒀다 — 잘못된 응급연락처 노출 리스크가 커서, 실제 번호는 `sync_medical.js` 실동기화로
  채우는 게 맞다고 판단했다 (`docs/HANDOFF_LOG.md` 블로커 참고).
