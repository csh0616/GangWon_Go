// 배치 동기화 시 1회 생성하는 장소명/시설명 영문·중문 번역 (런타임 번역 아님, PRD 8장).
// ★ 시설·지형 접미사는 LLM이 아니라 고정 사전으로 강제 매핑한다 — 지명(고유명사) 부분만 LLM에
// 맡긴다. 같은 접미사가 장소마다 다르게 번역되면 목록이 일관성을 잃기 때문 (안전 기능인
// care_facilities는 특히 중요, pois도 동일 원칙 적용).
const path = require('path');
require('dotenv').config();
// scripts/sync/.env엔 ANTHROPIC_API_KEY가 없어서 server/.env를 보조로 로드 — dotenv.config()는
// 이미 설정된 값을 덮어쓰지 않으므로 순서가 안전하다.
require('dotenv').config({ path: path.join(__dirname, '../../server/.env') });
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-haiku-4-5-20251001';

// PRD 8장 "장소명 다국어" 상자 — POI 지형·시설 접미사 고정 사전
const POI_SUFFIX_DICT = {
  자연휴양림: { en: 'Recreational Forest', zh: '自然休养林' },
  박물관: { en: 'Museum', zh: '博物馆' },
  미술관: { en: 'Art Museum', zh: '美术馆' },
  해수욕장: { en: 'Beach', zh: '海水浴场' },
  캠핑장: { en: 'Campground', zh: '露营地' },
  전망대: { en: 'Observatory', zh: '瞭望台' },
  유원지: { en: 'Resort Area', zh: '游乐园' },
  폭포: { en: 'Falls', zh: '瀑布' },
  계곡: { en: 'Valley', zh: '溪谷' },
  시장: { en: 'Market', zh: '市场' },
  목장: { en: 'Ranch', zh: '牧场' },
  약수터: { en: 'Mineral Spring', zh: '药水泉' },
  온천: { en: 'Hot Spring', zh: '温泉' },
  향교: { en: 'Confucian School', zh: '乡校' },
  공원: { en: 'Park', zh: '公园' },
  숲길: { en: 'Forest Trail', zh: '林道' },
  사: { en: 'Temple', zh: '寺' },
  항: { en: 'Port', zh: '港' },
};

// PRD 8장 "care_facilities 데이터 소스 교체" 상자 — 시설 종류 접미사 고정 사전.
// 라운드6 【2】 — 전국 병·의원 찾기 서비스(dutyDivNam) 추가하며 의원/한의원/치과의원/종합병원 보강.
// 긴 접미사가 먼저 매칭되도록(stripKnownSuffix가 길이순 정렬) "종합병원"을 "병원"보다,
// "한의원"/"치과의원"을 "의원"보다 먼저 넣을 필요는 없다 — 정렬은 코드가 알아서 한다.
const CARE_SUFFIX_DICT = {
  보건의료원: { en: 'Health & Medical Center', zh: '保健医疗院' },
  보건지소: { en: 'Health Subcenter', zh: '保健支所' },
  보건진료소: { en: 'Health Clinic', zh: '保健诊疗所' },
  보건소: { en: 'Health Center', zh: '保健所' },
  의료원: { en: 'Medical Center', zh: '医疗院' },
  종합병원: { en: 'General Hospital', zh: '综合医院' },
  병원: { en: 'Hospital', zh: '医院' },
  치과의원: { en: 'Dental Clinic', zh: '牙科诊所' },
  한의원: { en: 'Korean Medicine Clinic', zh: '韩医诊所' },
  의원: { en: 'Clinic', zh: '诊所' },
};

const NAME_TOOL = {
  name: 'translate_place_name',
  description: '한국어 지명/고유명사를 영어(로마자 표기)와 중국어로 번역한다.',
  input_schema: {
    type: 'object',
    properties: {
      en: { type: ['string', 'null'] },
      zh: { type: ['string', 'null'] },
    },
    required: ['en', 'zh'],
    additionalProperties: false,
  },
  cache_control: { type: 'ephemeral' },
};

function stripKnownSuffix(name, suffixDict) {
  const matched = Object.keys(suffixDict)
    .filter((suf) => name.endsWith(suf))
    .sort((a, b) => b.length - a.length)[0];
  if (!matched) return { remainder: name, suffix: null };
  return { remainder: name.slice(0, name.length - matched.length).trim(), suffix: matched };
}

async function callTranslateRemainder(remainderKo) {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 200,
    tools: [NAME_TOOL],
    tool_choice: { type: 'tool', name: NAME_TOOL.name },
    messages: [
      {
        role: 'user',
        content:
          `다음은 한국 지명/고유명사의 일부(시설 종류 접미사는 이미 제거됨)다: "${remainderKo}"\n\n` +
          '영어는 국립국어원 로마자 표기법으로 음역하고 보통명사가 섞여 있으면 의미 번역해줘. ' +
          '중국어는 한자 지명이면 한자로, 아니면 음역해줘. 설명 없이 이름만 짧게.',
      },
    ],
  });
  const toolUse = res.content.find((b) => b.type === 'tool_use');
  return toolUse ? toolUse.input : { en: null, zh: null };
}

/**
 * @param {string} nameKo
 * @param {'poi'|'care'} kind - 어느 접미사 사전을 쓸지
 * @returns {Promise<{en: string|null, zh: string|null}>}
 */
async function translateName(nameKo, kind) {
  const suffixDict = kind === 'care' ? CARE_SUFFIX_DICT : POI_SUFFIX_DICT;
  const { remainder, suffix } = stripKnownSuffix(nameKo, suffixDict);

  let translated = { en: null, zh: null };
  if (remainder) {
    try {
      translated = await callTranslateRemainder(remainder);
    } catch (err) {
      console.warn(`[translate_name] "${nameKo}" 번역 실패:`, err.message);
      return { en: null, zh: null };
    }
  }

  const result = {};
  for (const lang of ['en', 'zh']) {
    const parts = [translated[lang], suffix ? suffixDict[suffix][lang] : null].filter(Boolean);
    // 중국어는 띄어쓰기 없이 붙여쓴다(月精 + 寺 → 月精寺), 영어는 공백으로 구분
    const separator = lang === 'zh' ? '' : ' ';
    result[lang] = parts.length > 0 ? parts.join(separator).trim() : null;
  }
  return result;
}

module.exports = { translateName, stripKnownSuffix, POI_SUFFIX_DICT, CARE_SUFFIX_DICT };
