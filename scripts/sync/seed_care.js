// PRD 2.1절 — 여행 케어 안내 최소 5건/시군. 전화번호는 실제 확인 전이라 119(응급) 외에는 null로
// 두었다 — 잘못된 응급연락처를 보여주는 것이 안전 기능 특성상 리스크가 크다고 판단.
// docs/HANDOFF_LOG.md에 "데모 전 실제 번호 확인 필요" 블로커로 기록해뒀다.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  const seedPath = path.join(__dirname, 'seed', 'care_seed.json');
  const rows = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));

  const regionCodes = [...new Set(rows.map((r) => r.region_code))];
  const syncStartedAt = new Date().toISOString();

  // content_id 기준 upsert (sync_medical.js와 동일 패턴, 라운드2 점검 #4) — care_facilities도
  // name_en/name_zh/address_en/address_zh 다국어 스키마로 개편됐다(0002 마이그레이션).
  const { error: upsertErr } = await supabase.from('care_facilities').upsert(
    rows.map((r) => ({ ...r, synced_at: syncStartedAt })),
    { onConflict: 'content_id' }
  );
  if (upsertErr) throw upsertErr;

  // 0001 시절 content_id 없이 들어간 레거시 로우 정리 (해당 region만)
  const { error: deleteErr } = await supabase.from('care_facilities').delete().in('region_code', regionCodes).is('content_id', null);
  if (deleteErr) throw deleteErr;

  console.log(`[seed_care] ${rows.length}건 시드 완료 (${regionCodes.join(', ')})`);
}

main().catch((err) => {
  console.error('[seed_care] 실패:', err.message);
  process.exit(1);
});
