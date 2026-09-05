// 모든 응답은 { data, error } 형태로 통일 (API_CONTRACT.md §0)
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // eslint-disable-next-line no-console
  console.error('[error]', err);
  const status = err.status || 500;
  const code = err.code || 'INTERNAL_ERROR';
  res.status(status).json({ data: null, error: { code, message: err.message || '서버 오류가 발생했습니다.' } });
}

function apiError(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

module.exports = { errorHandler, apiError };
