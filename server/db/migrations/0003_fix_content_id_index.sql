-- GANGWON GO — 라운드3 인덱스 수정 (docs/HANDOFF_LOG.md 2026-09-07 09:00 PM 지시)
-- 0001/0002는 이미 Supabase에 적용 완료 — 절대 수정하지 말 것.
--
-- 0002의 partial unique index(`where content_id is not null`)는 PostgreSQL의 `ON CONFLICT`가
-- arbiter로 추론하지 못해 upsert가 전부 42P10(no unique or exclusion constraint matching the
-- ON CONFLICT specification)으로 실패했다(로컬 PostgreSQL 16으로 재현 확인). 일반 unique index는
-- NULL을 서로 다른 값으로 취급하므로(NULL <> NULL) 0002 주석이 의도했던 "NULL은 유니크 제약 예외"는
-- WHERE 절 없이도 그대로 유지된다 — 술어만 제거하면 된다.
--
-- 승현님이 이미 Supabase에서 아래와 동일한 내용을 직접 실행해 인덱스를 교체하고 재시드까지
-- 완료했습니다. 이 파일은 그 실행 내용을 DB 상태와 일치시키기 위한 기록입니다.
--
-- 이후 마이그레이션(0003+)부터 방어절(if exists/if not exists)을 넣기로 함(라운드3 점검 #9) —
-- 사람이 SQL Editor에서 직접 실행하는 방식이라 재실행 시 에러 없이 안전해야 한다.

drop index if exists idx_pois_content_id;
drop index if exists idx_care_content_id;

create unique index if not exists idx_pois_content_id on pois (content_id);
create unique index if not exists idx_care_content_id on care_facilities (content_id);
