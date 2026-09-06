// 모든 응답은 { data, error } 형태로 통일 (API_CONTRACT.md §0.1)
// §0.1 확정 사항: 목록에 없는 실패(DB 에러, 외부 API 에러 등)는 원문을 로그에만 남기고, 응답에는
// INTERNAL_ERROR + 일반화된 메시지만 내려보낸다 — Postgres/PostgREST 원문(제약 이름, enum 타입명 등)을
// 그대로 노출하지 않는다. apiError()로 만든 에러만 지정한 status/code/message 그대로 응답한다.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // eslint-disable-next-line no-console
  console.error('[error]', err);

  if (err.isApiError) {
    return res.status(err.status).json({ data: null, error: { code: err.code, message: err.message } });
  }
  return res.status(500).json({ data: null, error: { code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' } });
}

function apiError(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  err.isApiError = true;
  return err;
}

module.exports = { errorHandler, apiError };
