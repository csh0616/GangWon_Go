// 기상청 단기예보(getVilageFcst)는 위경도가 아니라 격자좌표(nx/ny)를 쓴다. 이 파일은 기상청이
// 공개한 Lambert Conformal Conic 변환 공식을 그대로 구현한다 (기상청 "기상자료개방포털" 배포
// 예제 코드에 실린 표준 알고리즘 — 여러 공개 구현체가 동일한 상수를 쓴다). 임의로 암기한 nx/ny
// 숫자를 하드코딩하는 대신, 위경도 → 격자 변환을 코드로 남겨 언제든 같은 입력으로 같은 결과를
// 재현·검증할 수 있게 했다 (1주차 아키텍처 점검 이후 실좌표 확인 과정에서 결정).
const RE = 6371.00877; // 지구 반경(km)
const GRID = 5.0; // 격자 간격(km)
const SLAT1 = 30.0; // 투영 위도1(deg)
const SLAT2 = 60.0; // 투영 위도2(deg)
const OLON = 126.0; // 기준점 경도(deg)
const OLAT = 38.0; // 기준점 위도(deg)
const XO = 43; // 기준점 X좌표(GRID)
const YO = 136; // 기준점 Y좌표(GRID)
const DEGRAD = Math.PI / 180.0;

function latLngToKmaGrid(lat, lng) {
  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD;
  const slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD;
  const olat = OLAT * DEGRAD;

  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);

  let ra = Math.tan(Math.PI * 0.25 + (lat * DEGRAD) * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);
  let theta = lng * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2 * Math.PI;
  if (theta < -Math.PI) theta += 2 * Math.PI;
  theta *= sn;

  const nx = Math.floor(ra * Math.sin(theta) + XO + 0.5);
  const ny = Math.floor(ro - ra * Math.cos(theta) + YO + 0.5);
  return { nx, ny };
}

module.exports = { latLngToKmaGrid };
