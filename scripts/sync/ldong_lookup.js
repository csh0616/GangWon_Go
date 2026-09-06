// 1회성 유틸 — 의료관광정보 서비스(MdclTursmService)의 /ldongCode를 실제 서비스키로 호출해
// 강원도 및 인제/홍천/평창의 lDongRegnCd/lDongSignguCd를 확인한다. 이 코드는 API가 자체 부여한
// 값이라 추측할 수 없다(docs/HANDOFF_LOG.md 2026-09-07 00:30 항목 — "추측 금지").
//
// 실행: `node ldong_lookup.js` (MEDICAL_TOURISM_SERVICE_KEY 필요, TourAPI/기상청 서버 장애 복구 후)
// 출력된 값을 medical_client.js의 REGION_TO_LDONG에 그대로 채워넣을 것.
require('dotenv').config();
const { callMedicalApi } = require('./medical_client');

async function main() {
  console.log('1단계: 시도 목록 조회 (lDongListYn=N) — 강원도 code 확인');
  const provinces = await callMedicalApi('ldongCode', { lDongListYn: 'N' });
  console.log(JSON.stringify(provinces, null, 2));

  // 이름이 요청 언어로 온다(예: "Gangwon-do") — 대소문자 무시하고 매칭
  const list = Array.isArray(provinces) ? provinces : [provinces];
  const gangwon = list.find((p) => /gangwon/i.test(p.name || ''));
  if (!gangwon) {
    console.log('\n강원도를 자동으로 못 찾았습니다 — 위 출력에서 수동으로 code를 확인하세요.');
    return;
  }
  console.log(`\n강원도 code: ${gangwon.code}`);

  console.log('\n2단계: 강원도 시군구 목록 조회 (lDongListYn=Y) — 인제/홍천/평창 코드 확인');
  const districts = await callMedicalApi('ldongCode', { lDongListYn: 'Y', lDongRegnCd: gangwon.code });
  console.log(JSON.stringify(districts, null, 2));
  console.log(
    '\n위 목록에서 Inje/Injae, Hongcheon, Pyeongchang에 해당하는 lDongSignguCd를 찾아 medical_client.js의 REGION_TO_LDONG에 채워넣으세요 (lDongRegnCd는 강원도 code 그대로, 시군구 코드는 3자리).'
  );
}

main().catch((err) => {
  console.error('[ldong_lookup] 실패:', err.message, err.cause ? `| cause: ${err.cause}` : '');
  process.exit(1);
});
