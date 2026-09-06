// PRD 8장 — 1주차 목업(seed) POI 데이터 로더. TourAPI 실동기화 전 프론트 작업을 막지 않기 위함.
// 스키마는 sync_pois.js와 동일해서, 나중에 실제 동기화가 이 데이터를 그대로 덮어쓴다.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  const seedPath = path.join(__dirname, 'seed', 'pois_seed.json');
  const rows = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));

  const regionCodes = [...new Set(rows.map((r) => r.region_code))];
  const syncStartedAt = new Date().toISOString();

  // content_id 기준 upsert (sync_pois.js와 동일 패턴, 라운드2 점검 #4) — 시드도 같은 규칙을 따라야
  // 실제 TourAPI 동기화로 자연스럽게 넘어갈 때 id 안정성이 끊기지 않는다.
  const { error: upsertErr } = await supabase.from('pois').upsert(
    rows.map((r) => ({ ...r, synced_at: syncStartedAt })),
    { onConflict: 'content_id' }
  );
  if (upsertErr) throw upsertErr;

  // 0001 시절 content_id 없이 들어간 레거시 로우 정리 (해당 region만)
  const { error: deleteErr } = await supabase.from('pois').delete().in('region_code', regionCodes).is('content_id', null);
  if (deleteErr) throw deleteErr;

  console.log(`[seed_pois] ${rows.length}건 시드 완료 (${regionCodes.join(', ')})`);
}

main().catch((err) => {
  console.error('[seed_pois] 실패:', err.message);
  process.exit(1);
});
