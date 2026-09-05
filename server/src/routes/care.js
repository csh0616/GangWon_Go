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

    const { data, error } = await supabaseAdmin.from('care_facilities').select('name, category, phone, lat, lng').eq('region_code', regionCode);
    if (error) throw error;

    res.status(200).json({ data, error: null });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
