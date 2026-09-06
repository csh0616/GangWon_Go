-- GANGWON GO — 초기 스키마 (PRD 4장 / ERD_SEQUENCE.md §1 기준)
-- Supabase 대시보드 SQL Editor에서 실행하거나 `supabase db push`로 적용하세요.
--
-- 이 파일의 users/itineraries/pois/alerts/care_facilities 정의는 PRD 4장과 100% 일치합니다.
-- pois.adult_only, care_facilities 테이블은 1주차 백엔드 구현 중 제안했던 항목으로,
-- PM이 PRD 4장/6장에 확정 반영했습니다 (PR #3, docs/HANDOFF_LOG.md 2026-09-06 21:00 항목).

create extension if not exists "pgcrypto";

-- ── ENUM 타입 ────────────────────────────────────────────────────────────
create type poi_category_tag as enum (
  'nature_hiking',
  'onsen_wellness',
  'culture_history',
  'food_local',
  'festival_event',
  'shopping',
  'leisure_sports'
);

create type relationship_type as enum (
  'couple',
  'family_with_kids',
  'friends',
  'solo',
  'group'
);

create type itinerary_status as enum ('draft', 'active', 'completed', 'cancelled');

create type alert_trigger_type as enum ('weather', 'traffic', 'festival');

create type alert_status as enum ('proposed', 'confirmed', 'dismissed');

create type region_code_type as enum ('injae', 'hongcheon', 'pyeongchang');

-- ── users (PRD 3.9절 — 로그인(저장) 시점에만 생성) ──────────────────────
create table users (
  id uuid primary key,  -- Supabase auth.uid() 그대로 사용 (FK 아님, 동일 값)
  created_at timestamptz not null default now(),
  preferred_lang text,
  auth_provider text not null default 'google'
);

-- ── itineraries ──────────────────────────────────────────────────────────
create table itineraries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  region_codes region_code_type[] not null,  -- 항상 1개 값만 (PRD 3.5절 — 시군 단일 선택)
  start_date date not null,
  end_date date not null,
  companions int not null,
  relationship relationship_type not null,
  status itinerary_status not null default 'active',
  itinerary_json jsonb not null,
  preference_weights jsonb not null,
  created_at timestamptz not null default now()
);

create index idx_itineraries_active_scan on itineraries (status, start_date, end_date);

-- ── pois (TourAPI/의료관광정보 동기화, /scripts/sync) ───────────────────
create table pois (
  id uuid primary key default gen_random_uuid(),
  region_code region_code_type not null,
  name text not null,
  category text not null,
  lat double precision not null,
  lng double precision not null,
  tags poi_category_tag[] not null default '{}',
  adult_only boolean not null default false,  -- 신규 추가, 위 헤더 참고
  event_start_date date,  -- festival_event만 값 있음
  event_end_date date,
  synced_at timestamptz not null default now()
);

create index idx_pois_region on pois (region_code);
create index idx_pois_tags on pois using gin (tags);

-- ── alerts (매니징 트리거 로그) ──────────────────────────────────────────
-- previous_poi_id/proposed_poi_id는 의도적으로 pois(id)에 대한 FK가 아니다 (1주차 아키텍처 점검 #10).
-- itinerary_json의 poi_id와 동일한 "스냅샷 참조" 성격(PRD 4장 스냅샷 정책, ERD_SEQUENCE.md §1)이라
-- 참조 무결성 대상이 아니며, /scripts/sync가 delete+insert로 POI의 uuid를 매번 새로 발급하기 때문에
-- 하드 FK를 걸면 재동기화 시 기존 alerts가 깨지고, 반대로 alerts가 하나라도 있으면 그 시군 동기화가
-- FK 위반으로 막힌다.
create table alerts (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references itineraries(id) on delete cascade,
  trigger_type alert_trigger_type not null,
  condition text not null,
  triggered_at timestamptz not null default now(),
  status alert_status not null default 'proposed',
  day int not null,
  previous_poi_id uuid not null,
  proposed_poi_id uuid not null,
  responded_at timestamptz  -- NULL = 미응답(3분 타임아웃 포함), 값 있음 = 사용자가 실제 응답
);

create index idx_alerts_itinerary on alerts (itinerary_id);
create unique index idx_alerts_dedupe_proposed on alerts (itinerary_id, day, previous_poi_id) where status = 'proposed';

-- Realtime 배달 (1주차 아키텍처 점검 #3) — publication에 등록된 테이블만 push되므로 이게 없으면
-- 프론트 구독은 SUBSCRIBED로 성공하고도 아무 이벤트를 못 받는다. replica identity full은
-- UPDATE 이벤트(confirmed/dismissed 전환)에도 itinerary_id 등 전체 컬럼이 실려서 프론트 필터가 걸리게 한다.
alter publication supabase_realtime add table alerts;
alter table alerts replica identity full;

-- ── care_facilities (API_CONTRACT.md §4, PRD 4장 확정) ──────────────────
create table care_facilities (
  id uuid primary key default gen_random_uuid(),
  region_code region_code_type not null,
  name text not null,
  category text not null,  -- hospital | pharmacy | emergency 등
  phone text,
  lat double precision,
  lng double precision,
  synced_at timestamptz not null default now()
);

create index idx_care_region on care_facilities (region_code);

-- ── RLS ──────────────────────────────────────────────────────────────────
-- 백엔드(Express)는 service role 키로 RLS를 우회해 직접 쓰기/읽기를 수행한다. 아래 정책은
-- 프론트가 Supabase Realtime으로 alerts를 직접 구독하는 경로(PRD 6장 — itinerary 단위 구독,
-- 다른 사용자 알림이 섞이면 안 됨)를 위한 최소 방어선이다.

alter table users enable row level security;
alter table itineraries enable row level security;
alter table alerts enable row level security;
alter table pois enable row level security;
alter table care_facilities enable row level security;

create policy "users_select_own" on users for select using (auth.uid() = id);

create policy "itineraries_select_own" on itineraries for select using (auth.uid() = user_id);

-- Realtime 채널 `alerts:itinerary_id=eq.{id}` 구독 시 이 정책으로 본인 itinerary의 alert만 보인다.
create policy "alerts_select_own_itinerary" on alerts for select using (
  itinerary_id in (select id from itineraries where user_id = auth.uid())
);

-- pois/care_facilities는 게스트도 코스를 보므로 공개 읽기 (쓰기는 service role 전용, 정책 없음 = 차단)
create policy "pois_public_read" on pois for select using (true);
create policy "care_public_read" on care_facilities for select using (true);
