const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { apiError } = require('../middleware/errorHandler');
const { createProposedAlert, respondToAlert } = require('../lib/alertTrigger');

const router = express.Router();

// POST /api/alerts/trigger — 데모 전용 강제 트리거, "제안"만 생성 (API_CONTRACT.md §3)
router.post('/trigger', requireAuth, async (req, res, next) => {
  try {
    const { itinerary_id: itineraryId, trigger_type: triggerType, condition, day, target_poi_id: targetPoiId } = req.body;
    if (!itineraryId || !triggerType || !condition || !day || !targetPoiId) {
      throw apiError(400, 'INVALID_STRUCTURED_INPUT', 'itinerary_id/trigger_type/condition/day/target_poi_id는 필수입니다.');
    }

    const result = await createProposedAlert({ itineraryId, triggerType, condition, day, targetPoiId });

    if (result.isDuplicate) {
      return res.status(200).json({ data: { alert_id: result.alert.id, status: result.alert.status, reused: true }, error: null });
    }

    res.status(200).json({
      data: {
        alert_id: result.alert.id,
        itinerary_id: itineraryId,
        trigger_type: triggerType,
        condition,
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
    const result = await respondToAlert({ alertId: req.params.alert_id, response });
    res.status(200).json({ data: result, error: null });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
