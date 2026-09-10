// PRD 8장 — 1주차 목업(seed) POI 데이터 로더. TourAPI 실동기화 전 프론트 작업을 막지 않기 위함이었다.
//
// **데모 DB에는 적재하지 않음 (라운드3, PRD 8장 "시드 → 실데이터 전환" 방침 확정)** — 실동기화 성공
// 확인 후(인제 61/홍천 80/평창 83건, 2026-09-10) 시드는 DB에서 이미 제거되었다. 시드엔 필터 테스트용
// 가상 축제("인제 자작나무숲 단풍축제", "홍천강 억새축제" 등)가 섞여 있어 실데이터와 함께 있으면
// 심사에서 "이 축제가 실제로 있느냐" 질문에 답할 수 없다. 이 스크립트 자체는 개발·테스트(로컬 DB,
// 오프라인 시나리오 등)용으로만 남겨둔다 — 실행하면 다시 섞이니 데모 직전엔 실행하지 말 것.
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

  // 주의: sync_pois.js(실동기화)와 달리 이 스크립트는 synced_at 기준 정리를 하지 않는다 — 그렇게
  // 하면 실데이터로 전환한 뒤 이 스크립트를 실수로 돌렸을 때 "이번 시드 목록보다 오래된" 실데이터가
  // 전부 삭제돼버린다(실데이터의 synced_at이 항상 더 예전이므로). content_id가 겹치지만 않으면
  // upsert도 실데이터를 건드리지 않으므로, 정리 없이 두는 쪽이 더 안전하다 — 이 스크립트가
  // "데모 DB에는 적재하지 않음"으로 격하된 이상, 남아있는 레거시 로우 정리는 더 이상 이 스크립트의
  // 책임이 아니다.

  console.log(`[seed_pois] ${rows.length}건 시드 완료 (${regionCodes.join(', ')})`);
}

main().catch((err) => {
  console.error('[seed_pois] 실패:', err.message);
  process.exit(1);
});
