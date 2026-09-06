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

  // INSERT 먼저, 성공한 뒤에만 이전 데이터 DELETE (sync_pois.js와 동일 패턴, 1주차 점검 #15)
  const { error: insertErr } = await supabase.from('pois').insert(rows.map((r) => ({ ...r, synced_at: syncStartedAt })));
  if (insertErr) throw insertErr;

  const { error: deleteErr } = await supabase.from('pois').delete().in('region_code', regionCodes).lt('synced_at', syncStartedAt);
  if (deleteErr) throw deleteErr;

  console.log(`[seed_pois] ${rows.length}건 시드 완료 (${regionCodes.join(', ')})`);
}

main().catch((err) => {
  console.error('[seed_pois] 실패:', err.message);
  process.exit(1);
});
