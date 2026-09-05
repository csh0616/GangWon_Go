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

const NARRATION_TOOL = {
  name: 'generate_narration',
  description: '완성된 여행 코스에 대해 영어/중국어 내레이션 문장을 생성한다.',
  input_schema: {
    type: 'object',
    properties: {
      narration: {
        type: 'object',
        properties: {
          en: { type: ['string', 'null'] },
          zh: { type: ['string', 'null'] },
        },
        required: ['en', 'zh'],
        additionalProperties: false,
      },
    },
    required: ['narration'],
    additionalProperties: false,
  },
  cache_control: { type: 'ephemeral' },
};

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
 * API_CONTRACT.md §1 — free_text가 있을 때만 호출. 실패/스키마 검증 실패 시 1회 재시도,
 * 그래도 실패하면 weights 전부 0 + activity_level medium으로 폴백 (에러로 코스 생성을 막지 않음).
 */
async function extractPreferenceWeights(freeText) {
  if (!freeText || !freeText.trim()) {
    return { weights: emptyWeights(), activity_level: 'medium' };
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const payload = await callExtractWeightsOnce(freeText);
      if (isValidWeightsPayload(payload)) return payload;
      // eslint-disable-next-line no-console
      console.warn(`[llm] extractPreferenceWeights 스키마 검증 실패 (attempt ${attempt + 1})`, payload);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[llm] extractPreferenceWeights 호출 실패 (attempt ${attempt + 1})`, err.message);
    }
  }

  // eslint-disable-next-line no-console
  console.error('[llm] extractPreferenceWeights 최종 실패 — weights 전부 0, activity_level medium으로 폴백');
  return { weights: emptyWeights(), activity_level: 'medium' };
}

/**
 * (선택) 완성된 코스에 내레이션만 추가. 실패 시 문장 생략, 코스 자체는 정상 반환 (API_CONTRACT.md §1).
 */
async function generateNarration(itineraryDays) {
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 500,
      tools: [NARRATION_TOOL],
      tool_choice: { type: 'tool', name: NARRATION_TOOL.name },
      messages: [
        {
          role: 'user',
          content: `다음 여행 코스에 대해 영어(en)와 중국어(zh) 내레이션을 작성해줘:\n${JSON.stringify(itineraryDays)}`,
        },
      ],
    });
    const toolUse = response.content.find((block) => block.type === 'tool_use');
    if (toolUse && toolUse.input && toolUse.input.narration) {
      return toolUse.input.narration;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[llm] generateNarration 실패 — 내레이션 없이 진행', err.message);
  }
  return { en: null, zh: null };
}

module.exports = { extractPreferenceWeights, generateNarration };
