-- GANGWON GO — 라운드2 스키마 변경 (docs/HANDOFF_LOG.md 2026-09-07 00:30 PM 지시)
-- 0001_init_schema.sql은 이미 Supabase에 적용 완료 — 절대 수정하지 말 것. 이후 스키마 변경은
-- 전부 이런 식으로 새 0002_, 0003_... 파일로 이어서 작성한다.

-- ── pois.content_id (라운드2 #4) ────────────────────────────────────────
-- TourAPI가 부여한 콘텐츠 ID. 재동기화 시 이 값을 upsert 키로 써서 `id`(uuid)가 유지되게 한다.
-- 기존 delete+insert 방식은 매번 새 uuid를 발급해서, itineraries.itinerary_json 스냅샷이 들고
-- 있는 옛 poi_id로 pois를 재조회하면 0건이 되고 rain 트리거가 로그 없이 영구 무동작이 됐다.
-- 0001 적용 이후 이미 들어간 시드 39건은 content_id가 NULL인 채로 남는데, partial unique index라
-- NULL은 유니크 제약에 안 걸린다 — 이후 seed_pois.js/sync_pois.js가 content_id 기준 upsert로
-- 다시 채우면서, 같은 region의 NULL-content_id 레거시 로우를 정리한다(각 스크립트 참고).
alter table pois add column content_id text;
create unique index idx_pois_content_id on pois (content_id) where content_id is not null;

-- ── care_facilities 다국어 컬럼 개편 (라운드2, PRD 4장 갱신) ────────────
-- 의료관광정보 서비스(MdclTursmService)는 langDivCd로 ENG/JPN/CHS/RUS만 제공하고 한국어 응답이
-- 아예 없다. 단일 name 컬럼으론 담을 수 없어 언어별 컬럼으로 분리하고, content_id 기준으로
-- ENG·CHS 두 응답을 같은 row에 합친다(동기화 코드 쪽 처리, sync_medical.js 참고).
alter table care_facilities add column content_id text;
create unique index idx_care_content_id on care_facilities (content_id) where content_id is not null;

alter table care_facilities add column name_en text;
alter table care_facilities add column name_zh text;
alter table care_facilities add column address_en text;
alter table care_facilities add column address_zh text;
alter table care_facilities drop column name;
