// 기상청 단기예보 API(getVilageFcst) 클라이언트 (PRD 3.6절 — 5~10분 주기 매니징 트리거용).
//
// 기상청 API는 위경도가 아니라 격자 좌표(nx/ny)를 쓴다. REGION_GRID는 시군 대표 좌표를
// kmaGrid.js의 공식(LCC 변환)으로 계산한 값이며(1주차 아키텍처 점검 이후 반영, 서울시청
// 기준점(60,127)/부산·대전·제주 교차검증 통과), 실제 서비스키로 최초 호출해 응답이 정상 오는지
// 검증은 TourAPI/기상청 서버 장애로 아직 못 했다 (docs/HANDOFF_LOG.md 2026-09-07 00:30 항목).
require('dotenv').config();
const path = require('path');
const { todayKstYYYYMMDD, nowKstHourMinute } = require(path.join(__dirname, '../../server/src/lib/time'));
const { latLngToKmaGrid } = require(path.join(__dirname, '../../server/src/lib/kmaGrid'));

const BASE_URL = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst';
const SERVICE_KEY = process.env.KMA_SERVICE_KEY;

// 시군 대표 좌표(군청 소재지, seed 데이터의 전통시장/보건의료원 좌표와 동일) → 기상청 격자로 변환
// (kmaGrid.js의 공식 사용). 실제 서비스키로 최초 호출해 응답이 정상 오는지 검증 필요 — 격자가 1~2칸
// 어긋나도 같은 시군 인접 동네 예보라 데모에는 영향 없는 수준이지만, 정밀 서비스 전환 시
// 기상청 "동네예보 격자좌표" 조회 화면으로 재확인 권장.
const REGION_COORDS = {
  injae: { lat: 38.0692, lng: 128.1706 }, // 인제읍
  hongcheon: { lat: 37.696, lng: 127.885 }, // 홍천읍
  pyeongchang: { lat: 37.3706, lng: 128.39 }, // 평창읍
};

const REGION_GRID = Object.fromEntries(Object.entries(REGION_COORDS).map(([region, coord]) => [region, latLngToKmaGrid(coord.lat, coord.lng)]));

// PRD 6장(1주차 점검 #4) — hour/minute을 KST로 통일. 이전엔 getHours()(서버 로컬/UTC)와
// toISOString()(UTC 날짜)을 섞어 써서 base_date가 실제와 1~2일 어긋났다.
function nearestBaseTime() {
  // 단기예보는 02,05,08,11,14,17,20,23시(+10분 이후)에만 발표 — 가장 최근 발표시각으로 스냅
  const slots = [23, 20, 17, 14, 11, 8, 5, 2];
  const { hour, minute } = nowKstHourMinute();
  const effectiveHour = minute >= 10 ? hour : hour - 1;
  const found = slots.find((s) => s <= effectiveHour);
  const usesPreviousDay = found === undefined; // effectiveHour < 2 → 전날 23시 발표 사용
  const slot = found ?? 23;
  const baseDate = todayKstYYYYMMDD(usesPreviousDay ? -1 : 0);
  return { baseDate, baseTime: `${String(slot).padStart(2, '0')}00` };
}

/**
 * PTY(강수형태) 코드가 0(없음)이 아니면 비/눈 등 강수 중으로 판단 (PRD 3.5절 rain 조건).
 */
async function fetchRainStatus(regionCode) {
  const grid = REGION_GRID[regionCode];
  if (!grid) {
    throw new Error(`${regionCode}의 기상청 격자좌표(nx/ny)가 설정되지 않았습니다 — weather.js REGION_GRID 확인.`);
  }
  if (!SERVICE_KEY) {
    throw new Error('KMA_SERVICE_KEY가 설정되지 않았습니다 (.env 확인).');
  }
  const { baseDate, baseTime } = nearestBaseTime();
  const params = new URLSearchParams({
    serviceKey: SERVICE_KEY,
    numOfRows: '100',
    pageNo: '1',
    dataType: 'JSON',
    base_date: baseDate,
    base_time: baseTime,
    nx: String(grid.nx),
    ny: String(grid.ny),
  });
  const res = await fetch(`${BASE_URL}?${params.toString()}`);
  if (!res.ok) throw new Error(`기상청 API 호출 실패: HTTP ${res.status}`);
  const json = await res.json();
  const items = json?.response?.body?.items?.item || [];
  const pty = items.find((i) => i.category === 'PTY');
  return { isRaining: !!pty && Number(pty.fcstValue) !== 0 };
}

module.exports = { fetchRainStatus, REGION_GRID };
