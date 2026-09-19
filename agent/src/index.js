// PRD 3.6절 — 실시간 조건 감시 에이전트, 5~10분 주기. `node src/index.js`로 상시 실행.
const path = require('path');
const cron = require('node-cron');
const { tick } = require('./monitor');
const { ENABLE_TRAFFIC_WATCH } = require(path.join(__dirname, '../../server/src/lib/alertTrigger'));

const SCHEDULE = '*/5 * * * *'; // 5분 주기 (PRD 3.6절 5~10분 범위 내)

console.log('[agent] 조건 감시 에이전트 시작 (5분 주기)');
// 카카오모빌리티 일일 쿼터(10,000건) 소진 방지 — traffic 감시는 기본 꺼짐(ENABLE_TRAFFIC_WATCH=true로 켬).
console.log(`[agent] traffic 감시: ${ENABLE_TRAFFIC_WATCH ? '켜짐' : '꺼짐(기본값)'}`);
tick(); // 기동 즉시 1회 실행
cron.schedule(SCHEDULE, tick);
