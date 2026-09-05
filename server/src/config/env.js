require('dotenv').config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    // eslint-disable-next-line no-console
    console.warn(`[env] ${name} is not set — 관련 기능이 동작하지 않습니다 (.env 확인)`);
  }
  return value;
}

module.exports = {
  port: process.env.PORT || 4000,
  supabaseUrl: required('SUPABASE_URL'),
  supabaseAnonKey: required('SUPABASE_ANON_KEY'),
  supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  anthropicApiKey: required('ANTHROPIC_API_KEY'),
  kakaoMobilityApiKey: process.env.KAKAO_MOBILITY_API_KEY || '',
  kmaServiceKey: process.env.KMA_SERVICE_KEY || '',
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};
