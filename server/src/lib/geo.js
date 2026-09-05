// PRD 3장 — 동선 최적화: "순서 결정"은 Haversine + 2-opt (로컬 연산, 근사치로 충분).
// 실제 지도 동선(카카오모빌리티 Directions API)은 이 파일과 무관 — 순서가 정해진 뒤 인접 스탑끼리만 호출.

const EARTH_RADIUS_KM = 6371;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function haversineKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, h)));
}

function totalRouteDistance(route) {
  let sum = 0;
  for (let i = 0; i < route.length - 1; i += 1) {
    sum += haversineKm(route[i], route[i + 1]);
  }
  return sum;
}

function reverseSegment(route, i, k) {
  return [...route.slice(0, i), ...route.slice(i, k + 1).reverse(), ...route.slice(k + 1)];
}

/**
 * 2-opt로 방문 순서를 최적화한다. Haversine 상대 비교이므로 근사치로 충분 (PRD 3장).
 * @param {Array} stops - {lat, lng, ...} 객체 배열. 순서는 입력 배열 순서를 초기해로 사용.
 * @param {object} [options]
 * @param {boolean} [options.pinFirst] - true면 stops[0]을 고정(스왑 대상에서 제외).
 *   축제 앵커 스탑을 첫 스탑으로 고정할 때 사용 (PRD 3.5절 — 앵커 스탑 우선 배치).
 */
function twoOptOptimize(stops, { pinFirst = false } = {}) {
  if (stops.length < 3) return stops.slice();
  let route = stops.slice();
  const startIdx = pinFirst ? 1 : 0;
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = startIdx; i < route.length - 1; i += 1) {
      for (let k = i + 1; k < route.length; k += 1) {
        const candidate = reverseSegment(route, i, k);
        if (totalRouteDistance(candidate) < totalRouteDistance(route) - 1e-9) {
          route = candidate;
          improved = true;
        }
      }
    }
  }
  return route;
}

/**
 * 단순 반복 k-means (lat/lng 기준). 표본이 작은 데모 규모(시군당 10~15개)에 맞춘 가벼운 구현.
 * @param {Array} points - {lat, lng, ...} 배열
 * @param {number} k - 클러스터(일자) 수
 * @returns {Array<Array>} k개의 포인트 배열
 */
function kMeansCluster(points, k, { iterations = 10 } = {}) {
  if (points.length === 0) return Array.from({ length: k }, () => []);
  if (k <= 1) return [points.slice()];

  // 초기 중심: 점수 순으로 이미 정렬돼 들어온다고 가정하고 균등 간격으로 시드 선택 (결정론적)
  const step = Math.max(1, Math.floor(points.length / k));
  let centroids = Array.from({ length: k }, (_, i) => {
    const p = points[Math.min(i * step, points.length - 1)];
    return { lat: p.lat, lng: p.lng };
  });

  let assignment = new Array(points.length).fill(0);

  for (let iter = 0; iter < iterations; iter += 1) {
    let changed = false;
    points.forEach((p, idx) => {
      let best = 0;
      let bestDist = Infinity;
      centroids.forEach((c, ci) => {
        const d = haversineKm(p, c);
        if (d < bestDist) {
          bestDist = d;
          best = ci;
        }
      });
      if (assignment[idx] !== best) changed = true;
      assignment[idx] = best;
    });

    centroids = centroids.map((_, ci) => {
      const members = points.filter((_, idx) => assignment[idx] === ci);
      if (members.length === 0) return centroids[ci];
      const avgLat = members.reduce((s, p) => s + p.lat, 0) / members.length;
      const avgLng = members.reduce((s, p) => s + p.lng, 0) / members.length;
      return { lat: avgLat, lng: avgLng };
    });

    if (!changed) break;
  }

  const clusters = Array.from({ length: k }, () => []);
  points.forEach((p, idx) => clusters[assignment[idx]].push(p));
  return clusters;
}

module.exports = { haversineKm, totalRouteDistance, twoOptOptimize, kMeansCluster };
