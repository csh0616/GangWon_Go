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

    // care_facilities가 name_en/name_zh/address_en/address_zh로 다국어 개편됨 (0002 마이그레이션,
    // PRD 4장 갱신 — 의료관광정보 서비스가 한국어를 아예 제공하지 않아 단일 name 컬럼을 못 씀).
    // 프론트가 이미 알고 있는 현재 로케일에 맞는 필드를 골라 쓰면 되므로 lang 파라미터 없이 둘 다 반환.
    const { data, error } = await supabaseAdmin
      .from('care_facilities')
      .select('name_en, name_zh, category, phone, address_en, address_zh, lat, lng')
      .eq('region_code', regionCode);
    if (error) throw error;

    res.status(200).json({ data, error: null });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
