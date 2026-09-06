const { getUserFromToken } = require('../config/supabaseClient');

function extractToken(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}

// API_CONTRACT.md §0 — 로그인 필요 엔드포인트용. 저장/조회/부분수정/알림 응답은 여기부터 인증 게이트.
// try/catch로 감싸지 않으면 Supabase 호출 실패 시 unhandled rejection으로 Node 15+ 기본값에 따라
// 프로세스가 죽는다 (1주차 점검 #16).
async function requireAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ data: null, error: { code: 'AUTH_REQUIRED', message: 'Authorization 헤더가 필요합니다.' } });
    }
    const user = await getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ data: null, error: { code: 'AUTH_REQUIRED', message: '유효하지 않은 토큰입니다.' } });
    }
    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { requireAuth };
