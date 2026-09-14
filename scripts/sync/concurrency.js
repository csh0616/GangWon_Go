// 여러 sync_*.js 스크립트가 공통으로 쓰는 워커풀 — LLM/지오코딩 호출을 순차로 하면 건수가 많을 때
// 너무 오래 걸려서(라운드5 sync_pois.js 487건), 제한된 동시성으로 병렬 처리한다.
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index;
      index += 1;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

module.exports = { mapWithConcurrency };
