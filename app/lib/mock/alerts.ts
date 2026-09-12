import type { AlertPayload } from "../types";

/**
 * Realtime push / POST /api/alerts/trigger 목업 payload (API_CONTRACT.md §3).
 * itn_ongoing_pyeongchang의 DAY 1 첫 스탑(월정사 전나무숲길, 야외)을 대상으로 한 "비" 트리거 예시.
 * 실제 계약 예시(Odaesan → Alpensia)와 같은 질문형 톤을 그대로 따른다.
 */
export function buildMockAlert(itineraryId: string, alertId = "alt_demo_001"): AlertPayload {
  return {
    alert_id: alertId,
    itinerary_id: itineraryId,
    trigger_type: "weather",
    condition: "rain",
    status: "proposed",
    message: {
      ko: "비가 옵니다. 월정사 전나무숲길 대신 알펜시아 스카이워크 전시관으로 변경할까요?",
      en: "It's raining. Replace Woljeongsa Fir Forest Trail with Alpensia Skywalk Exhibition Hall?",
      zh: "下雨了。要把月精寺冷杉林道换成阿尔卑西亚天空步道展览馆吗？",
    },
    proposed_stop: {
      day: 1,
      previous_poi_id: "poi_pc_01",
      candidate_poi: {
        poi_id: "poi_pc_99",
        name: {
          ko: "알펜시아 스카이워크 전시관",
          en: "Alpensia Skywalk Exhibition Hall",
          zh: "阿尔卑西亚天空步道展览馆",
        },
        category: "culture_history",
        is_indoor: true,
        lat: 37.6653,
        lng: 128.6862,
      },
    },
    triggered_at: new Date().toISOString(),
  };
}
