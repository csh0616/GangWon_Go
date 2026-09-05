// PRD 3.6절 — 실시간 조건 감시 에이전트, 5~10분 주기. `node src/index.js`로 상시 실행.
const cron = require('node-cron');
const { tick } = require('./monitor');

const SCHEDULE = '*/5 * * * *'; // 5분 주기 (PRD 3.6절 5~10분 범위 내)

console.log('[agent] 조건 감시 에이전트 시작 (5분 주기)');
tick(); // 기동 즉시 1회 실행
cron.schedule(SCHEDULE, tick);
