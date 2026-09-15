// P2(라운드8) — 라운드7 문자 클래스 검증 도입 후 pois.name_zh가 20% null로 남은 것을 줄인다.
// 전체 재동기화 대신 이미 name_zh가 null인 row만 골라 번역을 한 번 더 시도한다 — 이미 성공한
// 값은 LLM 비결정성 때문에 다시 흔들 필요가 없다. translateName()의 문자 클래스 검증(라운드7)을
// 그대로 재사용하므로 검증 규칙 자체는 완화하지 않는다 — 재생성도 실패하면 null 그대로 둔다.
// 실행: `node regenerate_name_zh.js`
require('dotenv').config();
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../server/.env') });
const { createClient } = require('@supabase/supabase-js');
const { translateName } = require('./translate_name');
const { mapWithConcurrency } = require('./concurrency');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const CONCURRENCY = 8;

async function regenerateTable(table, nameField, kind) {
  const { data: rows, error } = await supabase.from(table).select(`id, ${nameField}`).is('name_zh', null);
  if (error) throw error;
  if (rows.length === 0) {
    console.log(`[regenerate_name_zh] ${table}: name_zh가 null인 row 없음`);
    return;
  }

  let fixed = 0;
  let stillNull = 0;
  await mapWithConcurrency(rows, CONCURRENCY, async (row) => {
    const nameKo = row[nameField];
    const { zh } = await translateName(nameKo, kind);
    if (!zh) {
      stillNull += 1;
      console.log(`[regenerate_name_zh] ${table} "${nameKo}" 재생성도 검증 실패 — null 유지`);
      return;
    }
    const { error: updateErr } = await supabase.from(table).update({ name_zh: zh }).eq('id', row.id);
    if (updateErr) {
      console.warn(`[regenerate_name_zh] ${table} "${nameKo}" 업데이트 실패:`, updateErr.message);
      return;
    }
    fixed += 1;
    console.log(`[regenerate_name_zh] ${table} "${nameKo}" → "${zh}" 재생성 성공`);
  });

  console.log(`[regenerate_name_zh] ${table}: 대상 ${rows.length}건 중 ${fixed}건 재생성 성공, ${stillNull}건 여전히 null`);
}

async function main() {
  await regenerateTable('pois', 'name', 'poi');
  await regenerateTable('care_facilities', 'name_ko', 'care');
}

main();
