// 대한민국 대략 경계 — (0,0) 등 좌표 누락/파싱 실패 로우를 걸러내는 sanity check (1주차 점검 #14).
// sync_pois.js에 있던 걸 라운드3에서 공용화 — sync_medical.js/sync_festivals.js도 같은 사고
// 유형("0" 문자열이 Number("0")=0으로 파싱돼 저장되는 것)을 막아야 한다 (라운드3 점검 #6/#10).
const KOREA_LAT_RANGE = [33, 39];
const KOREA_LNG_RANGE = [124, 132];

function isValidKoreaCoord(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= KOREA_LAT_RANGE[0] &&
    lat <= KOREA_LAT_RANGE[1] &&
    lng >= KOREA_LNG_RANGE[0] &&
    lng <= KOREA_LNG_RANGE[1]
  );
}

module.exports = { isValidKoreaCoord, KOREA_LAT_RANGE, KOREA_LNG_RANGE };
