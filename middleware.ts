import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // 정적 파일/내부 next 경로/mock API 제외. backend도 제외해야 한다 — 안 그러면 이 미들웨어가
  // /backend/:path*(next.config.ts의 same-origin 리라이트 대상, P0-F)를 /ko/backend/:path*로
  // 리다이렉트해버려서 리라이트 규칙 자체가 매치되지 않는다(실측: curl로 307 확인).
  matcher: ["/((?!api|_next|backend|.*\\..*).*)"],
};
