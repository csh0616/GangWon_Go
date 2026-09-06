// PRD 6장 (1주차 아키텍처 점검에서 신설) — 날짜/시각 판단은 전부 KST(Asia/Seoul) 기준.
// 서버는 UTC 환경(Railway/Render 기본값)에 배포되므로 toISOString()/getHours() 같은 로컬/UTC
// 혼용 방식을 쓰면 9시간이 어긋난다. "오늘"이 필요한 모든 코드는 이 모듈을 거칠 것.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// UTC now에 9시간을 더한 뒤 UTC getter로 읽으면 "KST 벽시계" 값이 나온다 (흔한 트릭).
function kstShifted(date = new Date()) {
  return new Date(date.getTime() + KST_OFFSET_MS);
}

// KST 기준 오늘 날짜 (YYYY-MM-DD)
function todayKstISO() {
  return kstShifted().toISOString().slice(0, 10);
}

// KST 기준 오늘 날짜 (YYYYMMDD, 기상청 base_date 포맷). offsetDays로 전날/다음날 계산 가능.
function todayKstYYYYMMDD(offsetDays = 0) {
  const d = kstShifted();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

// KST 기준 현재 시/분
function nowKstHourMinute() {
  const d = kstShifted();
  return { hour: d.getUTCHours(), minute: d.getUTCMinutes() };
}

module.exports = { todayKstISO, todayKstYYYYMMDD, nowKstHourMinute };
