import type { CategoryKey, Localized, RegionCode } from "../types";

export type MockPoi = {
  poi_id: string;
  region_code: RegionCode;
  name: Localized;
  category: CategoryKey;
  is_indoor: boolean;
  lat: number;
  lng: number;
  blurb: Localized;
};

/**
 * 데모 3개 시군(인제·홍천·평창) POI 목업. docs/API_CONTRACT.md §1 예시(월정사 전나무숲길·
 * 평창무이예술관)와 이름·좌표를 맞춰 일관성을 유지했다. 아래 표시는 실제 화면 검증용 의도적 결함을
 * 섞은 것 — 지우지 말 것:
 *  - poi_pc_05(대관령한우타운): name.en = null (HANDOFF_LOG 2026-09-10 20:00 항목의 실제 예시와 동일)
 *  - poi_hc_04: blurb.en = null (부분 번역 누락)
 */
export const MOCK_POIS: MockPoi[] = [
  // ── 평창 ─────────────────────────────────────────────
  {
    poi_id: "poi_pc_01",
    region_code: "pyeongchang",
    name: {
      ko: "월정사 전나무숲길",
      en: "Woljeongsa Fir Forest Trail",
      zh: "月精寺冷杉林道",
    },
    category: "nature_hiking",
    is_indoor: false,
    lat: 37.7318,
    lng: 128.5926,
    blurb: {
      ko: "천년 전나무가 늘어선 1km 흙길",
      en: "A 1km path through thousand-year-old firs",
      zh: "穿过千年冷杉的1公里林间小路",
    },
  },
  {
    poi_id: "poi_pc_02",
    region_code: "pyeongchang",
    name: {
      ko: "평창무이예술관",
      en: "Pyeongchang Mui Art Museum",
      zh: "平昌武夷艺术馆",
    },
    category: "culture_history",
    is_indoor: true,
    lat: 37.5891,
    lng: 128.3742,
    blurb: {
      ko: "옛 분교를 고친 미술관",
      en: "A former village school turned art museum",
      zh: "由旧分校改建的美术馆",
    },
  },
  {
    poi_id: "poi_pc_03",
    region_code: "pyeongchang",
    name: {
      ko: "대관령삼양목장",
      en: "Daegwallyeong Samyang Ranch",
      zh: "大关岭三养牧场",
    },
    category: "nature_hiking",
    is_indoor: false,
    lat: 37.6206,
    lng: 128.6764,
    blurb: {
      ko: "능선을 따라 펼쳐진 초록 목장",
      en: "A green ranch spread along the ridge",
      zh: "沿山脊展开的绿色牧场",
    },
  },
  {
    poi_id: "poi_pc_04",
    region_code: "pyeongchang",
    name: {
      ko: "용평리조트 스키 슬로프",
      en: "Yongpyong Resort Ski Slope",
      zh: "龙平度假村滑雪场",
    },
    category: "leisure_sports",
    is_indoor: false,
    lat: 37.6392,
    lng: 128.6797,
    blurb: {
      ko: "국내 최초의 스키 리조트 슬로프",
      en: "Korea's first ski resort slope",
      zh: "韩国第一家滑雪度假村雪道",
    },
  },
  {
    poi_id: "poi_pc_05",
    region_code: "pyeongchang",
    name: { ko: "대관령한우타운", en: null, zh: "大关岭韩牛城" },
    category: "food_local",
    is_indoor: true,
    lat: 37.6801,
    lng: 128.7189,
    blurb: {
      ko: "고원에서 기른 한우 전문 식당가",
      en: "Hanwoo beef restaurants raised on the highland",
      zh: "高原饲养韩牛专门餐厅街",
    },
  },
  {
    poi_id: "poi_pc_06",
    region_code: "pyeongchang",
    name: {
      ko: "평창올림픽시장",
      en: "Pyeongchang Olympic Market",
      zh: "平昌奥运市场",
    },
    category: "shopping",
    is_indoor: false,
    lat: 37.3706,
    lng: 128.3927,
    blurb: {
      ko: "동계올림픽 이름을 딴 오일장",
      en: "A market named after the Winter Olympics",
      zh: "以冬奥会命名的五日集市",
    },
  },
  {
    poi_id: "poi_pc_07",
    region_code: "pyeongchang",
    name: {
      ko: "평창효석문화제",
      en: "Pyeongchang Hyoseok Culture Festival",
      zh: "平昌孝石文化节",
    },
    category: "festival_event",
    is_indoor: false,
    lat: 37.6564,
    lng: 128.3925,
    blurb: {
      ko: "메밀꽃밭에서 열리는 가을 문학 축제",
      en: "An autumn literary festival in buckwheat fields",
      zh: "荞麦花田中的秋季文学节",
    },
  },
  {
    poi_id: "poi_pc_08",
    region_code: "pyeongchang",
    name: {
      ko: "오대산 소금강 계곡",
      en: "Odaesan Sogeumgang Valley",
      zh: "五台山小金刚溪谷",
    },
    category: "nature_hiking",
    is_indoor: false,
    lat: 37.79,
    lng: 128.6,
    blurb: {
      ko: "작은 금강산이라 불리는 계곡길",
      en: "A valley trail nicknamed 'Little Geumgang'",
      zh: "被称为小金刚山的溪谷步道",
    },
  },

  // ── 홍천 ─────────────────────────────────────────────
  {
    poi_id: "poi_hc_01",
    region_code: "hongcheon",
    name: { ko: "삼봉약수", en: "Sambong Mineral Spring", zh: "三峰药水" },
    category: "nature_hiking",
    is_indoor: false,
    lat: 37.9,
    lng: 128.35,
    blurb: {
      ko: "탄산 성분이 나는 계곡 약수터",
      en: "A carbonated mineral spring in the valley",
      zh: "山谷中带碳酸味的药水泉",
    },
  },
  {
    poi_id: "poi_hc_02",
    region_code: "hongcheon",
    name: { ko: "홍천강 래프팅", en: "Hongcheon River Rafting", zh: "洪川江漂流" },
    category: "leisure_sports",
    is_indoor: false,
    lat: 37.75,
    lng: 127.92,
    blurb: {
      ko: "여울이 순한 초보자용 래프팅 구간",
      en: "A gentle rafting stretch for beginners",
      zh: "水流平缓适合新手的漂流河段",
    },
  },
  {
    poi_id: "poi_hc_03",
    region_code: "hongcheon",
    name: { ko: "수타사", en: "Sutasa Temple", zh: "水打寺" },
    category: "culture_history",
    is_indoor: false,
    lat: 37.686,
    lng: 127.98,
    blurb: {
      ko: "계곡을 낀 조용한 천년 고찰",
      en: "A quiet thousand-year temple by the valley",
      zh: "溪谷旁静谧的千年古刹",
    },
  },
  {
    poi_id: "poi_hc_04",
    region_code: "hongcheon",
    name: { ko: "홍천 딸기마을 체험장", en: "Hongcheon Strawberry Farm", zh: "洪川草莓村体验园" },
    category: "food_local",
    is_indoor: false,
    lat: 37.7,
    lng: 127.87,
    blurb: { ko: "제철 딸기를 직접 따보는 체험 농장", en: null, zh: "亲手采摘应季草莓的体验农场" },
  },
  {
    poi_id: "poi_hc_05",
    region_code: "hongcheon",
    name: { ko: "비발디파크 온천", en: "Vivaldi Park Hot Spring", zh: "维瓦尔第公园温泉" },
    category: "onsen_wellness",
    is_indoor: true,
    lat: 37.65,
    lng: 127.9,
    blurb: {
      ko: "리조트 안에 있는 실내 온천",
      en: "An indoor hot spring inside the resort",
      zh: "度假村内的室内温泉",
    },
  },
  {
    poi_id: "poi_hc_06",
    region_code: "hongcheon",
    name: { ko: "홍천전통시장", en: "Hongcheon Traditional Market", zh: "洪川传统市场" },
    category: "shopping",
    is_indoor: false,
    lat: 37.694,
    lng: 127.885,
    blurb: {
      ko: "화전민 마을에서 시작된 오일장",
      en: "A market that began in a slash-and-burn village",
      zh: "起源于火田民村落的五日集市",
    },
  },

  // ── 인제 ─────────────────────────────────────────────
  {
    poi_id: "poi_ij_01",
    region_code: "injae",
    name: { ko: "내린천 카약", en: "Naerincheon Kayaking", zh: "内麟川皮划艇" },
    category: "leisure_sports",
    is_indoor: false,
    lat: 38.05,
    lng: 128.3,
    blurb: {
      ko: "맑은 협곡을 가르는 카약 코스",
      en: "A kayak course cutting through a clear gorge",
      zh: "穿越清澈峡谷的皮划艇路线",
    },
  },
  {
    poi_id: "poi_ij_02",
    region_code: "injae",
    name: { ko: "자작나무숲", en: "Wonandae Birch Forest", zh: "白桦树林" },
    category: "nature_hiking",
    is_indoor: false,
    lat: 38.06,
    lng: 128.33,
    blurb: {
      ko: "하얀 자작나무가 빽빽한 숲길",
      en: "A trail dense with white birch trees",
      zh: "白桦树密布的林间步道",
    },
  },
  {
    poi_id: "poi_ij_03",
    region_code: "injae",
    name: { ko: "인제산촌민속박물관", en: "Inje Mountain Folk Museum", zh: "麟蹄山村民俗博物馆" },
    category: "culture_history",
    is_indoor: true,
    lat: 38.07,
    lng: 128.17,
    blurb: {
      ko: "산골 생활 도구를 모은 박물관",
      en: "A museum of mountain village tools",
      zh: "收藏山村生活用具的博物馆",
    },
  },
  {
    poi_id: "poi_ij_04",
    region_code: "injae",
    name: { ko: "필례약수온천", en: "Pillye Mineral Spring Spa", zh: "必礼药水温泉" },
    category: "onsen_wellness",
    is_indoor: false,
    lat: 38.1,
    lng: 128.2,
    blurb: {
      ko: "산속 노천 약수 온천",
      en: "An open-air mineral spring bath in the mountains",
      zh: "山中的露天药水温泉",
    },
  },
  {
    poi_id: "poi_ij_05",
    region_code: "injae",
    name: { ko: "용대리 황태마을", en: "Yongdae-ri Dried Pollack Village", zh: "龙垈里黄太村" },
    category: "food_local",
    is_indoor: false,
    lat: 38.18,
    lng: 128.35,
    blurb: {
      ko: "황태 덕장이 줄지은 마을",
      en: "A village lined with dried pollack racks",
      zh: "排满明太鱼晾晒架的村庄",
    },
  },
];

export function poiById(id: string): MockPoi | undefined {
  return MOCK_POIS.find((p) => p.poi_id === id);
}

export function poisByRegion(region: RegionCode): MockPoi[] {
  return MOCK_POIS.filter((p) => p.region_code === region);
}
