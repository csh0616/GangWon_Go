// PRD 2.1절 — 여행 케어 안내 최소 5건/시군. 전화번호는 실제 확인 전이라 119(응급) 외에는 null로
// 두었다 — 잘못된 응급연락처를 보여주는 것이 안전 기능 특성상 리스크가 크다고 판단.
// docs/HANDOFF_LOG.md에 "데모 전 실제 번호 확인 필요" 블로커로 기록해뒀다.
//
// **이 시드는 현재도 데모 DB에 그대로 적재되어 있다 (pois와 다름, 라운드3 실측 확인)** —
// sync_medical.js로 실제 의료관광정보 서비스를 인제/홍천/평창에 대해 조회하면 3개 시군 전부
// 0건이다(Gangwon-do 전체에 등록된 시설이 원주시 2곳뿐 — 의료관광 인증 시설 자체가 이 지역엔
// 없음, API/파라미터 문제 아님). 실제 대체 데이터가 없으므로 PRD 8장의 "실데이터 확보 시 시드
// 제거" 원칙을 이 테이블에는 적용하지 않기로 했다 — SOS/의료 안내는 로그인 여부와 무관하게 항상
// 접근 가능해야 하는 안전 기능이라(PRD 2.1절), 빈 목록보다는 출처를 알 수 있는 목업이 낫다고
// 판단. PM 확인 필요 (docs/HANDOFF_LOG.md 참고).
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
