"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { RefreshCw } from "lucide-react";
import { pickName, type UiLocale } from "@/app/lib/localized";
import type { Day } from "@/app/lib/types";

declare global {
  interface Window {
    kakao?: {
      maps: {
        load: (cb: () => void) => void;
        LatLng: new (lat: number, lng: number) => unknown;
        Map: new (container: HTMLElement, options: Record<string, unknown>) => {
          setCenter: (latlng: unknown) => void;
        };
        CustomOverlay: new (options: Record<string, unknown>) => { setMap: (map: unknown) => void };
        Polyline: new (options: Record<string, unknown>) => { setMap: (map: unknown) => void };
      };
    };
  }
}

const KAKAO_KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
const SDK_LOAD_TIMEOUT_MS = 5000;

type Status = "loading" | "ready" | "failed";

/**
 * 카카오맵 JS SDK 래퍼 (PRD 3장 확정 기술스택). 스탑 마커는 커스텀 오버레이라 라벨을 선택 언어로
 * 그릴 수 있다 — 배경 타일 자체의 언어 옵션은 카카오 개발자 문서(en/kakaomap/common,
 * apis.map.kakao.com/web/documentation)에 별도 파라미터가 없는 것으로 실측 확인했다
 * (2026-09-13, docs/HANDOFF_LOG.md 기록). 그래서 배경 타일은 한국어로 남고 마커만 선택 언어로 그린다
 * — PRD 6장이 이미 수용 가능하다고 명시한 결과와 일치.
 *
 * SDK 로드 실패(키 없음/네트워크 차단) 시 지도를 비우지 않고 MapFallback으로 대체한다(TEST_PLAN.md B-001).
 */
export function MapView({ day, onRetry }: { day: Day; onRetry?: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>(KAKAO_KEY ? "loading" : "failed");
  const t = useTranslations("result");
  const tc = useTranslations("common");
  const locale = useLocale() as UiLocale;

  useEffect(() => {
    if (!KAKAO_KEY || !containerRef.current) return;
    let cancelled = false;
    const timeout = setTimeout(() => !cancelled && setStatus("failed"), SDK_LOAD_TIMEOUT_MS);

    const scriptId = "kakao-maps-sdk";
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;

    function init() {
      if (cancelled || !window.kakao || !containerRef.current) return;
      window.kakao.maps.load(() => {
        if (cancelled || !containerRef.current) return;
        clearTimeout(timeout);
        const first = day.stops[0];
        const center = new window.kakao!.maps.LatLng(first?.lat ?? 37.5, first?.lng ?? 128.4);
        const map = new window.kakao!.maps.Map(containerRef.current, { center, level: 8 });

        day.stops.forEach((stop) => {
          const { primary } = pickName(stop.name, locale);
          const el = document.createElement("div");
          el.className = "ggo-marker";
          el.style.cssText =
            "display:flex;align-items:center;gap:4px;padding:5px 9px;border-radius:999px;background:#0B7A55;color:#fff;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(25,31,40,.25);transform:translateY(-50%);";
          el.textContent = `${stop.order} · ${primary}`;
          const overlay = new window.kakao!.maps.CustomOverlay({
            position: new window.kakao!.maps.LatLng(stop.lat, stop.lng),
            content: el,
            yAnchor: 1,
          });
          overlay.setMap(map);
        });

        setStatus("ready");
      });
    }

    if (existing) {
      init();
    } else {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_KEY}&autoload=false&libraries=services`;
      script.onload = init;
      script.onerror = () => !cancelled && setStatus("failed");
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
    // day.stops 좌표가 바뀌는 경우(부분 재구성)는 지금 범위에서 지도를 새로 그리지 않고 다음 진입 때 반영
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === "failed") {
    return (
      <div className="flex h-full flex-col items-center gap-3 bg-bg-subtler px-8 pb-8 pt-10 text-center md:justify-center md:pt-8">
        <p className="text-[15px] font-bold tracking-tight">{t("mapFallbackTitle")}</p>
        <p className="max-w-xs text-[12.5px] leading-relaxed text-muted">{t("mapFallbackBody")}</p>
        <button
          type="button"
          onClick={() => {
            setStatus(KAKAO_KEY ? "loading" : "failed");
            onRetry?.();
          }}
          className="mt-1 flex items-center gap-1.5 rounded-full bg-bg px-4 py-2 text-[12.5px] font-semibold text-ink-soft shadow-sm"
        >
          <RefreshCw size={13} strokeWidth={1.8} />
          {t("mapFallbackAction")}
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-bg-subtler">
      <div ref={containerRef} className="h-full w-full" />
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center text-[12.5px] font-medium text-muted">
          {tc("loading")}
        </div>
      )}
    </div>
  );
}
