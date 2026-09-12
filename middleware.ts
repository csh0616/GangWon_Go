import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // 정적 파일/내부 next 경로/mock API 제외
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
