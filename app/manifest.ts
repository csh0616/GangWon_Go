import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GANGWON GO",
    short_name: "GANGWON GO",
    description: "강원 여행 코스를 자동으로 만들고 실시간으로 관리해주는 여행 플래닝 서비스",
    start_url: "/ko",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0b7a55",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
