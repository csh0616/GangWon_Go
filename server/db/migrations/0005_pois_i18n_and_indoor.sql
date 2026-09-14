-- GANGWON GO — 라운드5 【3】pois 장소명 다국어 + is_indoor (docs/HANDOFF_LOG.md 라운드5 지시)
-- 0001~0004는 이미 적용 완료 — 절대 수정하지 말 것.
--
-- name_en/name_zh: 배치 동기화 시 1회 생성(런타임 번역 아님, PRD 8장 "장소명 다국어" 상자).
-- name(한국어)은 절대 덮어쓰지 않음 — 병행 표기의 기준값.
-- is_indoor: 매니징 제안 모달의 실내/야외 배지 표시용(표시 전용, rain 트리거 판정 근거는 그대로 카테고리 기준).
--
-- 승현님이 Supabase SQL Editor에서 직접 실행 필요 — 서버에서 자동 실행되지 않습니다.

alter table pois add column if not exists name_en text;
alter table pois add column if not exists name_zh text;
alter table pois add column if not exists is_indoor boolean not null default false;
