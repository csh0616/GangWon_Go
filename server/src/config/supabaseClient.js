const { createClient } = require('@supabase/supabase-js');
const env = require('./env');

// service role 클라이언트: RLS를 우회하는 트러스티드 서버 전용 (PRD 3.9절 users/itineraries upsert 등)
const supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// anon 클라이언트: 사용자가 보낸 Bearer 토큰 검증 전용 (auth.getUser)
const supabaseAuthClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function getUserFromToken(token) {
  const { data, error } = await supabaseAuthClient.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

module.exports = { supabaseAdmin, supabaseAuthClient, getUserFromToken };
