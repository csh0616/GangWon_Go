import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Noto_Sans_KR } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { AlertListener } from "@/components/managing/AlertListener";
import { WatchProvider } from "@/components/managing/WatchContext";
import "../globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-sans-kr",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GANGWON GO",
  description: "AI Agent 기반 강원도 외국인 관광객 맞춤형 여행 플래닝 & 실시간 매니징",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "GANGWON GO",
  },
  // public/ 아래 파일이라 app/icon.png·app/apple-icon.png 자동 인식 규칙 밖이라 직접 연결한다.
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

// viewportFit: "cover" — 화면 전체(노치·홈 인디케이터 영역까지)를 쓰게 하고, 그 영역은
// env(safe-area-inset-*)로 별도 대응한다(결과 화면 모바일 바텀시트의 저장 버튼 하단
// 패딩에 사용 — components/result/ResultView.tsx). 이 값이 없으면 env()가 항상 0으로
// 계산돼 안전영역 대응 자체가 무의미해진다.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b7a55",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale}>
      <body className={`${plusJakarta.variable} ${notoSansKr.variable}`}>
        <NextIntlClientProvider>
          <WatchProvider>
            {children}
            <AlertListener />
          </WatchProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
