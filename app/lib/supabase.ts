import { createClient } from "@supabase/supabase-js";

/**
 * 브라우저용 Supabase 클라이언트 — 단일 진입점 (P0-C, API_CONTRACT.md §0 인증 헤더 규칙).
 * SERVICE_ROLE 키는 RLS를 우회하므로 절대 여기(프론트/Vercel)에 두지 않는다 — 서버(/server)와
 * 감시 에이전트(/agent)에만 있어야 한다(HANDOFF_LOG 2026-09-15 11:30 PM 검수 항목).
 *
 * URL/anon key가 비어 있으면(로컬에 .env.local을 아직 안 넣은 경우 등) createClient 자체는
 * 성공하지만 실제 호출은 전부 실패한다 — app/lib/auth.ts가 그 실패를 NETWORK_ERROR 계열로
 * 흡수하므로 화면이 죽지는 않는다. 완전히 비활성화하기보다 "설정되면 바로 동작"하는 쪽을 택했다.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(supabaseUrl || "https://placeholder.supabase.co", supabaseAnonKey || "placeholder-anon-key", {
  auth: {
    // implicit 플로우: 리다이렉트로 돌아온 URL의 #access_token 해시를 클라이언트가 직접 파싱해
    // 세션을 만든다 — 별도 /auth/callback 서버 라우트가 필요 없다(이 작업은 /app,/components,
    // /i18n 범위라 서버 쪽 콜백 엔드포인트를 새로 만들 수 없다).
    flowType: "implicit",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
