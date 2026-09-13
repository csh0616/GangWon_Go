// 전국보건기관표준데이터는 좌표를 안 주고 주소만 준다 — 카카오 로컬 주소 검색 API로 지오코딩한다.
// 같은 Kakao REST 키(카카오모빌리티와 동일 앱 키)로 동작 확인됨(실측).
const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.join(__dirname, '../../server/.env') });

const KAKAO_KEY = process.env.KAKAO_MOBILITY_API_KEY;

/**
 * @param {string} address - 도로명 또는 지번 주소
 * @returns {Promise<{lat: number, lng: number} | null>} 실패/결과없음 시 null
 */
async function geocodeAddress(address) {
  if (!KAKAO_KEY) throw new Error('KAKAO_MOBILITY_API_KEY가 설정되지 않았습니다 (.env 확인).');
  const res = await fetch(`https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`, {
    headers: { Authorization: `KakaoAK ${KAKAO_KEY}` },
  });
  if (!res.ok) {
    console.warn(`[geocode] "${address}" 조회 실패: HTTP ${res.status}`);
    return null;
  }
  const json = await res.json();
  const doc = json?.documents?.[0];
  if (!doc) return null;
  return { lat: Number(doc.y), lng: Number(doc.x) };
}

module.exports = { geocodeAddress };
