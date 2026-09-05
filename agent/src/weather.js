// 기상청 단기예보 API(getVilageFcst) 클라이언트 (PRD 3.6절 — 5~10분 주기 매니징 트리거용).
//
// 블로커: 기상청 API는 위경도가 아니라 격자 좌표(nx/ny)를 쓴다. 인제/홍천/평창 세 시군의 정확한
// 격자값은 기상청이 제공하는 "동네예보 격자 좌표 변환기"로 직접 조회해야 하고, 이 세션은 실제
// 서비스키/네트워크가 없어 검증하지 못했다 — 아래 GRID를 채우기 전엔 fetchRainStatus가 명시적으로
// 에러를 던진다 (틀린 좌표로 조용히 엉뚱한 지역 날씨를 가져오는 것을 막기 위함). docs/HANDOFF_LOG.md 참고.
require('dotenv').config();

const BASE_URL = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst';
const SERVICE_KEY = process.env.KMA_SERVICE_KEY;

// TODO: 기상청 격자 좌표 변환기(https://www.kma.go.kr)로 실제 값 확인 후 채울 것
const REGION_GRID = {
  injae: null, // { nx: ?, ny: ? }
  hongcheon: null,
  pyeongchang: null,
};

function nearestBaseTime() {
  // 단기예보는 02,05,08,11,14,17,20,23시(+10분 이후)에만 발표 — 가장 최근 발표시각으로 스냅
  const slots = [23, 20, 17, 14, 11, 8, 5, 2];
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const effectiveHour = minute >= 10 ? hour : hour - 1;
  const slot = slots.find((s) => s <= effectiveHour) ?? 23;
  const date = new Date(now);
  if (effectiveHour < 2 && slot === 23) date.setDate(date.getDate() - 1);
  const yyyymmdd = date.toISOString().slice(0, 10).replace(/-/g, '');
  return { baseDate: yyyymmdd, baseTime: `${String(slot).padStart(2, '0')}00` };
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
