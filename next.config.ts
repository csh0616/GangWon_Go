import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // 백엔드를 same-origin 뒤에 숨긴다 — *.up.railway.app이 광고/피싱 차단 목록에 자주 올라가
  // 있어, 심사위원 브라우저의 확장 프로그램이 그 도메인만 차단해도 "생성중"에서 멈춰버린다
  // (HANDOFF_LOG 2026-09-15 배포본 2차 점검). NEXT_PUBLIC_API_BASE_URL을 /backend로 돌리면
  // 브라우저가 보는 요청이 전부 same-origin이 되어 차단 대상 도메인 자체가 사라진다.
  async rewrites() {
    return [
      {
        source: "/backend/:path*",
        destination: "https://gangwongo-production.up.railway.app/:path*",
      },
    ];
  },
};

export default withNextIntl(nextConfig);
