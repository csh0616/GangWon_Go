// PRD 3.7절 (Claude API 확정) / API_CONTRACT.md §1 — LLM은 파싱(가중치 추출)과 내레이션에만 사용.
// 코스 구조 자체는 만들지 않는다. 구조화 출력(tool use)으로 스키마를 강제한다.
const Anthropic = require('@anthropic-ai/sdk');
const env = require('../config/env');
const { CATEGORY_KEYS, emptyWeights } = require('./categories');

const client = new Anthropic({ apiKey: env.anthropicApiKey });

// 데모 단계: 가볍고 빠른 티어 우선 사용 (PRD 3.7절 — Haiku급)
const MODEL = 'claude-haiku-4-5-20251001';

const WEIGHTS_SCHEMA_PROPERTIES = CATEGORY_KEYS.reduce((acc, key) => {
  acc[key] = { type: 'number', minimum: 0, maximum: 1 };
  return acc;
}, {});

// API_CONTRACT.md §1 출력 스키마 그대로
const EXTRACT_WEIGHTS_TOOL = {
  name: 'extract_travel_preferences',
  description:
    '여행자의 자유 텍스트에서 7개 카테고리별 관심도 가중치(0~1)와 활동 강도를 추출한다. ' +
    '텍스트에 언급되지 않은 카테고리는 0으로 응답한다.',
  input_schema: {
    type: 'object',
    properties: {
      weights: {
        type: 'object',
        properties: WEIGHTS_SCHEMA_PROPERTIES,
        required: [...CATEGORY_KEYS],
        additionalProperties: false,
      },
      activity_level: { type: 'string', enum: ['low', 'medium', 'high'] },
    },
    required: ['weights', 'activity_level'],
    additionalProperties: false,
  },
  cache_control: { type: 'ephemeral' },
};

// API_CONTRACT.md §1 4단계 — narration/region_reason/blurbs를 "한 번의 LLM 상호작용"으로 받는다.
// 원안은 이걸 문자 그대로 API 호출 1건으로 구현했었는데, 라운드5 실측 결과 스탑 9개(3일) 기준
// 그 한 번의 호출 자체가 출력 토큰만으로 10~12초가 걸려 3초 예산을 크게 초과했다(모델 생성 속도가
// 병목 — 호출 횟수/네트워크 왕복 문제가 아니었음, docs/HANDOFF_LOG.md 라운드5 항목에 실측치 기록).
// 그래서 "직렬 호출 두 번"이 아니라 "병렬 호출 여러 개"로 재해석했다: narration/region_reason은
// 작은 별도 호출로, blurbs는 스탑을 작은 묶음으로 나눠 각 묶음을 별도 호출로 — 전부 Promise.all로
// 동시에 쏘면 지연시간은 총 출력 토큰이 아니라 "가장 느린 한 묶음"만큼만 걸린다(실측 3초대로 개선).
// 계약 문구("한 번의 호출")의 의도(직렬 호출로 지연이 배가되는 것 방지)는 지키면서 방식만 바꾼
// 것이라 HANDOFF_LOG.md에 계약 문구 보정 제안으로 남긴다.
const BLURB_CHUNK_SIZE = 3;

const LOCALIZED_SCHEMA = {
  type: 'object',
  properties: {
    ko: { type: ['string', 'null'] },
    en: { type: ['string', 'null'] },
    zh: { type: ['string', 'null'] },
  },
  required: ['ko', 'en', 'zh'],
  additionalProperties: false,
};

const NARRATION_ONLY_TOOL = {
  name: 'generate_narration',
  description: '완성된 여행 코스에 대해 한국어/영어/중국어 코스 요약과, 필요하면 시군을 고른 이유를 생성한다.',
  input_schema: {
    type: 'object',
    properties: {
      narration: LOCALIZED_SCHEMA,
      region_reason: LOCALIZED_SCHEMA,
    },
    required: ['narration', 'region_reason'],
    additionalProperties: false,
  },
  cache_control: { type: 'ephemeral' },
};

const BLURB_MAX_LENGTH = 40;

function truncateBlurb(text) {
  if (typeof text !== 'string') return null;
  return text.length > BLURB_MAX_LENGTH ? text.slice(0, BLURB_MAX_LENGTH) : text;
}

function isValidWeightsPayload(payload) {
  if (!payload || typeof payload !== 'object') return false;
  const { weights, activity_level: activityLevel } = payload;
  if (!weights || typeof weights !== 'object') return false;
  const keysMatch = CATEGORY_KEYS.every((key) => typeof weights[key] === 'number' && weights[key] >= 0 && weights[key] <= 1);
  const levelValid = ['low', 'medium', 'high'].includes(activityLevel);
  return keysMatch && levelValid;
}

async function callExtractWeightsOnce(freeText) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    tools: [EXTRACT_WEIGHTS_TOOL],
    tool_choice: { type: 'tool', name: EXTRACT_WEIGHTS_TOOL.name },
    messages: [{ role: 'user', content: freeText }],
  });
  const toolUse = response.content.find((block) => block.type === 'tool_use');
  return toolUse ? toolUse.input : null;
}

/**
 * 실패/스키마 검증 실패 시 1회 재시도 후에도 안 되면 null (호출부가 각자의 폴백 정책을 정한다 —
 * /generate는 전부 0, regenerate-stop은 저장된 preference_weights. 1주차 점검 #18: 이 둘을
 * 하나로 뭉쳐뒀던 게 regenerate-stop에서도 전부 0으로 덮어써버리는 버그의 원인이었음).
 */
async function extractWeightsRaw(freeText) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const payload = await callExtractWeightsOnce(freeText);
      if (isValidWeightsPayload(payload)) return payload;
      // eslint-disable-next-line no-console
      console.warn(`[llm] weights 스키마 검증 실패 (attempt ${attempt + 1})`, payload);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[llm] weights 호출 실패 (attempt ${attempt + 1})`, err.message);
    }
  }
  return null;
}

/**
 * API_CONTRACT.md §1 — free_text가 있을 때만 호출. 실패 시 weights 전부 0 + activity_level medium으로
 * 폴백 (에러로 코스 생성을 막지 않음). /generate 전용 폴백 정책.
 */
async function extractPreferenceWeights(freeText) {
  if (!freeText || !freeText.trim()) {
    return { weights: emptyWeights(), activity_level: 'medium' };
  }
  const result = await extractWeightsRaw(freeText);
  if (result) return result;
  // eslint-disable-next-line no-console
  console.error('[llm] extractPreferenceWeights 최종 실패 — weights 전부 0, activity_level medium으로 폴백');
  return { weights: emptyWeights(), activity_level: 'medium' };
}

/**
 * PRD 3.5절 부분 재구성 전용 — free_text가 있을 때 이 스탑만의 가중치를 새로 뽑는다. 실패 시
 * /generate와 달리 전부 0이 아니라 **저장된 preference_weights**로 폴백한다(1주차 점검 #18) —
 * 원래 취향을 완전히 잃는 것보다 낫다.
 * @param {string} freeText
 * @param {object} fallbackWeights - itinerary.preference_weights
 */
async function extractStopWeights(freeText, fallbackWeights) {
  if (!freeText || !freeText.trim()) return fallbackWeights;
  const result = await extractWeightsRaw(freeText);
  if (result) return result.weights;
  // eslint-disable-next-line no-console
  console.error('[llm] extractStopWeights 최종 실패 — 저장된 preference_weights로 폴백');
  return fallbackWeights;
}

function emptyLocalized() {
  return { ko: null, en: null, zh: null };
}

async function callNarrationOnly({ regionInstruction, regionCodes, stopLines }) {
  const prompt =
    `다음은 완성된 여행 코스다 (시군: ${regionCodes.join(', ')}).\n\n${regionInstruction}\n\n` +
    `스탑 목록:\n${stopLines}\n\n` +
    '이 코스의 전반적인 분위기·속도·테마를 한두 문장(언어당 80자 이내)으로 요약해라. ' +
    '스탑을 하나하나 나열하거나 일자별로 설명하지 마라 — 개별 스탑 설명은 이미 각 카드의 blurb가 맡는다.';
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    tools: [NARRATION_ONLY_TOOL],
    tool_choice: { type: 'tool', name: NARRATION_ONLY_TOOL.name },
    messages: [{ role: 'user', content: prompt }],
  });
  // max_tokens에 걸려 tool_use 인자 JSON이 중간에 끊기면 SDK가 예외 없이 빈/불완전 input을 준다
  // (실측 발견 — narration이 조용히 전부 빈 값이 되던 원인). 이 경우는 명시적으로 실패로 취급한다.
  if (response.stop_reason === 'max_tokens') {
    throw new Error('narration 생성이 max_tokens에 도달해 잘렸습니다.');
  }
  const toolUse = response.content.find((block) => block.type === 'tool_use');
  if (!toolUse || !toolUse.input || !toolUse.input.narration) throw new Error('구조화 출력 없음');
  return toolUse.input;
}

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) chunks.push(array.slice(i, i + size));
  return chunks;
}

/**
 * API_CONTRACT.md §1 4단계 — 코스 요약(narration) + 지역 선택 이유(region_reason) + 스탑별
 * 한 줄 설명(blurbs)을 만든다. 한 번의 거대한 호출 대신, narration 호출 하나와 스탑을 작은
 * 묶음으로 나눈 blurb 호출 여러 개를 Promise.all로 동시에 쏜다 (위 BLURB_CHUNK_SIZE 주석 참고 —
 * 실측상 이래야 3초 예산 근처로 들어온다). 청크 하나가 실패해도 그 스탑들만 blurb null이 되고
 * 나머지 청크와 narration은 정상 반환된다 — 계약이 가정한 "전부 성공/전부 null"보다 나은 부분
 * 성능저하이므로 안전한 방향의 변경이지만, 계약 문구와 다르다는 점은 HANDOFF_LOG에 남긴다.
 *
 * @param {object} params
 * @param {Array} params.days - buildItineraryDays() 결과 (day/date/region_code/stops[])
 * @param {boolean} params.isAutoRegion - "어디든지"로 서버가 지역을 골랐는지 (3.5절 2.4단계)
 * @param {string[]} params.regionCodes - 최종적으로 쓰인 시군 목록
 * @returns {Promise<{narration: object, regionReason: object|null, blurbsByPoiId: Map}>}
 */
async function generateNarrationBundle({ days, isAutoRegion, regionCodes }) {
  const allStops = days.flatMap((d) => d.stops.map((s) => ({ day: d.day, poi_id: s.poi_id, name: s.name.ko, category: s.category })));

  if (allStops.length === 0) {
    return { narration: emptyLocalized(), regionReason: null, blurbsByPoiId: new Map() };
  }

  const regionInstruction = isAutoRegion
    ? `사용자가 시군을 직접 고르지 않아 자유 텍스트 취향에 맞춰 ${regionCodes.join(', ')}을 선택했다. region_reason에 그 이유를 한 줄로 3개 언어 모두 작성해라.`
    : '사용자가 이 시군을 직접 선택했다. region_reason은 생성하지 말고 ko/en/zh 전부 null로 둬라.';
  const stopLines = allStops.map((s) => `day ${s.day} | poi_id=${s.poi_id} | ${s.name} | ${s.category}`).join('\n');

  const stopChunks = chunk(allStops, BLURB_CHUNK_SIZE);

  const [narrationResult, ...blurbChunkMaps] = await Promise.all([
    callNarrationOnly({ regionInstruction, regionCodes, stopLines }).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('[llm] narration 생성 실패 — narration/region_reason null로 진행', err.message);
      return null;
    }),
    ...stopChunks.map((stopChunk) => generateCandidateBlurbs(stopChunk.map((s) => ({ id: s.poi_id, name: s.name, category: s.category })))),
  ]);

  const blurbsByPoiId = new Map();
  blurbChunkMaps.forEach((chunkMap) => chunkMap.forEach((v, k) => blurbsByPoiId.set(k, v)));

  const narration = narrationResult?.narration || emptyLocalized();
  const regionReason = isAutoRegion ? narrationResult?.region_reason || emptyLocalized() : null;

  return { narration, regionReason, blurbsByPoiId };
}

const CANDIDATE_BLURB_TOOL = {
  name: 'generate_candidate_blurbs',
  description: '장소 후보 목록에 대해 40자 이내 한 줄 설명을 한국어/영어/중국어로 생성한다.',
  input_schema: {
    type: 'object',
    properties: {
      blurbs: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            poi_id: { type: 'string' },
            ko: { type: ['string', 'null'] },
            en: { type: ['string', 'null'] },
            zh: { type: ['string', 'null'] },
          },
          required: ['poi_id', 'ko', 'en', 'zh'],
          additionalProperties: false,
        },
      },
    },
    required: ['blurbs'],
    additionalProperties: false,
  },
  cache_control: { type: 'ephemeral' },
};

/**
 * regenerate-stop 후보 목록용 — API_CONTRACT.md §3 candidates[].blurb. 후보가 최대 3개뿐이라
 * 작은 별도 호출로 처리(narration 호출과 스키마가 달라 통합 안 함).
 */
async function generateCandidateBlurbs(candidates) {
  if (!candidates || candidates.length === 0) return new Map();
  const lines = candidates.map((c) => `poi_id=${c.id} | ${c.name} | ${c.category}`).join('\n');
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 800,
      tools: [CANDIDATE_BLURB_TOOL],
      tool_choice: { type: 'tool', name: CANDIDATE_BLURB_TOOL.name },
      messages: [
        {
          role: 'user',
          content:
            `다음 장소들에 대해 poi_id를 그대로 써서 40자 이내 한 줄 설명을 만들어라.\n\n${lines}\n\n` +
            '영업시간·가격·연락처·휴무일은 넣지 마라. 권유·홍보 문구 금지.',
        },
      ],
    });
    // max_tokens에 걸려 인자 JSON이 잘리면 blurbs가 빈 배열/undefined가 되어 아래 forEach가 자연히
    // 아무것도 채우지 않는다 — narration과 달리 여기선 "일부 후보만 blurb 없음"으로 안전하게 저하된다.
    if (response.stop_reason === 'max_tokens') {
      throw new Error('blurb 생성이 max_tokens에 도달해 잘렸습니다.');
    }
    const toolUse = response.content.find((block) => block.type === 'tool_use');
    const map = new Map();
    (toolUse?.input?.blurbs || []).forEach((b) => {
      map.set(b.poi_id, { ko: truncateBlurb(b.ko), en: truncateBlurb(b.en), zh: truncateBlurb(b.zh) });
    });
    return map;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[llm] generateCandidateBlurbs 실패 — blurb 없이 진행', err.message);
    return new Map();
  }
}

module.exports = { extractPreferenceWeights, extractStopWeights, generateNarrationBundle, generateCandidateBlurbs };
