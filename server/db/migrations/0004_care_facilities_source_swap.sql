-- GANGWON GO — 라운드5 【2】care_facilities 데이터 소스 교체 (docs/HANDOFF_LOG.md 라운드5 지시)
-- 0001~0003은 이미 Supabase에 적용 완료 — 절대 수정하지 말 것.
--
-- 의료관광정보 서비스(MdclTursmService)는 인제/홍천/평창 전부 0건이라 데이터셋을 교체한다
-- (국립중앙의료원 응급의료기관 + 전국보건기관표준데이터). 두 데이터셋 다 한국어 명칭만 제공하므로
-- name_ko/address_ko를 신설해 한국어를 주 표시값으로 쓴다. address_en/address_zh는
-- API_CONTRACT.md §4/타입 정의(app/lib/types.ts CareFacility)에 없는 필드라 제거한다 —
-- phone/lat/lng/address_ko는 원본 그대로, 번역·가공 대상이 아니다(PRD 8장).
--
-- 승현님이 Supabase SQL Editor에서 직접 실행 필요 — 서버에서 자동 실행되지 않습니다.

alter table care_facilities add column if not exists name_ko text;
alter table care_facilities add column if not exists address_ko text;
alter table care_facilities drop column if exists address_en;
alter table care_facilities drop column if exists address_zh;
