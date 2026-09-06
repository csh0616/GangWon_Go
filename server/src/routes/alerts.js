const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { apiError } = require('../middleware/errorHandler');
const { createProposedAlert, respondToAlert, ALLOWED_TRIGGER_TYPES, ALLOWED_CONDITIONS } = require('../lib/alertTrigger');

const router = express.Router();

// POST /api/alerts/trigger — 데모 전용 강제 트리거, "제안"만 생성 (API_CONTRACT.md §3)
router.post('/trigger', requireAuth, async (req, res, next) => {
  try {
    const { itinerary_id: itineraryId, trigger_type: triggerType, condition, day, target_poi_id: targetPoiId } = req.body;
    if (!itineraryId || !triggerType || !condition || !day || !targetPoiId) {
      throw apiError(400, 'INVALID_STRUCTURED_INPUT', 'itinerary_id/trigger_type/condition/day/target_poi_id는 필수입니다.');
    }
    // enum 검증 없이 DB에 바로 넣으면 잘못된 값이 Postgres enum 에러 → 500이 된다 (라운드2 점검 #7)
    if (!ALLOWED_TRIGGER_TYPES.includes(triggerType)) {
      throw apiError(400, 'INVALID_STRUCTURED_INPUT', `trigger_type은 ${ALLOWED_TRIGGER_TYPES.join('|')} 중 하나여야 합니다.`);
    }
    if (!ALLOWED_CONDITIONS.includes(condition)) {
      throw apiError(400, 'INVALID_STRUCTURED_INPUT', `condition은 ${ALLOWED_CONDITIONS.join('|')} 중 하나여야 합니다.`);
    }

    // 1주차 점검 #1 — 소유권 검사 없이 itinerary_id/alert_id만으로 남의 일정을 조회·변경할 수 있었음.
    const result = await createProposedAlert({ itineraryId, userId: req.user.id, triggerType, condition, day, targetPoiId });

    // 중복이어도 신규 생성과 완전히 동일한 응답 형태 (1주차 점검 #5). trigger_type/condition은
    // 요청값이 아니라 실제 반환되는 alert(중복이면 기존 alert)의 값을 쓴다 (라운드2 점검 #3) —
    // cron이 rain 알림을 먼저 만든 뒤 데모 버튼을 traffic으로 눌러도 message.key와 어긋나지 않는다.
    res.status(200).json({
      data: {
        alert_id: result.alert.id,
        itinerary_id: itineraryId,
        trigger_type: result.alert.trigger_type,
        condition: result.alert.condition,
        status: 'proposed',
        message: result.message,
        proposed_stop: result.proposedStop,
        triggered_at: result.alert.triggered_at,
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/alerts/:alert_id/respond — Yes/No 응답, 실제 적용은 여기서만 (API_CONTRACT.md §3)
router.post('/:alert_id/respond', requireAuth, async (req, res, next) => {
  try {
    const { response } = req.body;
    if (response !== 'yes' && response !== 'no') {
      throw apiError(400, 'INVALID_STRUCTURED_INPUT', 'response는 yes 또는 no만 허용됩니다.');
    }
    const result = await respondToAlert({ alertId: req.params.alert_id, userId: req.user.id, response });
    res.status(200).json({ data: result, error: null });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
