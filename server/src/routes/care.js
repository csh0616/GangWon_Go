const express = require('express');
const { supabaseAdmin } = require('../config/supabaseClient');
const { apiError } = require('../middleware/errorHandler');
const { REGION_CODES } = require('../lib/categories');

const router = express.Router();

// GET /api/care?region_code=injae — 로그인 불필요, 항상 접근 가능 (API_CONTRACT.md §4)
// care_facilities 테이블은 PRD 4장에 아직 없는 신규 테이블 — HANDOFF_LOG.md에 제안 기록 (PRD 4장 규칙).
router.get('/', async (req, res, next) => {
  try {
    const { region_code: regionCode } = req.query;
    if (!regionCode || !REGION_CODES.includes(regionCode)) {
      throw apiError(400, 'INVALID_STRUCTURED_INPUT', `region_code는 ${REGION_CODES.join('|')} 중 하나여야 합니다.`);
    }

    // care_facilities 데이터 소스 교체(라운드5 【2】, 0004 마이그레이션) — 국립중앙의료원 응급의료기관
    // 조회 서비스로 바뀌면서 한국어 명칭/주소가 원본으로 들어온다. name_ko/address_ko는 원본 그대로,
    // name_en/name_zh는 동기화 시점 1회 생성(API_CONTRACT.md §4 — 한국어+사용자 언어 항상 병행 표기).
    const { data, error } = await supabaseAdmin
      .from('care_facilities')
      .select('name_ko, name_en, name_zh, category, phone, address_ko, lat, lng')
      .eq('region_code', regionCode);
    if (error) throw error;

    res.status(200).json({ data, error: null });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
