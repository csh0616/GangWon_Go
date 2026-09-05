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
- `festival_event`는 "평창 효석문화제"(이효석문학관 일대, 실제 매년 9월 개최되는 축제) 1건만
  포함했고, 리허설 기간(3주차, 9/14~9/20)과 겹치도록 `event_start_date`/`event_end_date`를
  2026-09-10~09-19로 설정했다 — 실제 2026년 정확한 개최일은 아직 확인 전이라 리허설 전 재확인 필요.
- 매니징 리허설 문구용 2곳(PRD 8장)은 평창 "월정사 전나무숲길"(야외, 우천 시 교체 대상)과
  "평창무이예술관"(실내, 대체 후보)으로 정했다.
- `seed/care_seed.json`: 병원/보건지소 전화번호는 실제 확인 전이라 `119`(응급) 외엔 `null`로
  비워뒀다 — 잘못된 응급연락처 노출 리스크가 커서, 실제 번호는 `sync_medical.js` 실동기화로
  채우는 게 맞다고 판단했다 (`docs/HANDOFF_LOG.md` 블로커 참고).
