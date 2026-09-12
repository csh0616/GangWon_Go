"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { RefreshCw } from "lucide-react";
import { pickName, type UiLocale } from "@/app/lib/localized";
import type { Day } from "@/app/lib/types";

type KakaoLatLng = { toString?: () => string };
type KakaoOverlay = { setMap: (map: KakaoMap | null) => void };
type KakaoPolyline = { setMap: (map: KakaoMap | null) => void };
type KakaoBounds = { extend: (latlng: KakaoLatLng) => void };
type KakaoMap = {
  setCenter: (latlng: KakaoLatLng) => void;
  setBounds: (bounds: KakaoBounds) => void;
};

declare global {
  interface Window {
    kakao?: {
      maps: {
        load: (cb: () => void) => void;
        LatLng: new (lat: number, lng: number) => KakaoLatLng;
        LatLngBounds: new () => KakaoBounds;
        Map: new (container: HTMLElement, options: Record<string, unknown>) => KakaoMap;
        CustomOverlay: new (options: Record<string, unknown>) => KakaoOverlay;
        Polyline: new (options: Record<string, unknown>) => KakaoPolyline;
      };
    };
  }
}

const KAKAO_KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
const SDK_LOAD_TIMEOUT_MS = 5000;

type Status = "loading" | "ready" | "failed";

function buildMarkerEl(label: string): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText =
    "display:flex;align-items:center;gap:4px;padding:5px 9px;border-radius:999px;background:#0B7A55;color:#fff;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(25,31,40,.25);transform:translateY(-50%);";
  el.textContent = label;
  return el;
}

function buildMyLocationEl(): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText =
    "width:14px;height:14px;border-radius:999px;background:#2E7CF6;border:3px solid #fff;box-shadow:0 1px 4px rgba(25,31,40,.35);";
  return el;
}

/**
 * 카카오맵 JS SDK 래퍼 (PRD 3장 확정 기술스택, PRD 2.1절 수용기준: 마커·경로선·언어 전환·내 위치).
 * 스탑 마커는 커스텀 오버레이라 라벨을 선택 언어로 그릴 수 있다 — 배경 타일 자체의 언어 옵션은
 * 카카오 개발자 문서(en/kakaomap/common, apis.map.kakao.com/web/documentation)에 별도 파라미터가
 * 없는 것으로 실측 확인했다(docs/HANDOFF_LOG.md). 그래서 배경 타일은 한국어로 남고 마커만 선택
 * 언어로 그린다 — PRD 6장이 이미 수용 가능하다고 명시한 결과와 일치.
 *
 * SDK 로드 실패(키 없음/네트워크 차단) 시 지도를 비우지 않고 MapFallback으로 대체한다(TEST_PLAN.md B-001).
 *
 * SDK 스크립트/지도 인스턴스는 마운트 시 한 번만 만들고(ref로 유지), day가 바뀌면 마커·경로선만
 * 걷어내고 다시 그린다 — 다중 시군 코스에서 DAY 2가 다른 시군이어도 지도가 그 시군을 따라간다.
 */
export function MapView({
  day,
  onRetry,
  onMyLocationChange,
}: {
  day: Day;
  onRetry?: () => void;
  onMyLocationChange?: (hasLocation: boolean) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const markerOverlaysRef = useRef<KakaoOverlay[]>([]);
  const polylineRef = useRef<KakaoPolyline | null>(null);
  const myLocationOverlayRef = useRef<KakaoOverlay | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const [status, setStatus] = useState<Status>(KAKAO_KEY ? "loading" : "failed");
  const t = useTranslations("result");
  const tc = useTranslations("common");
  const locale = useLocale() as UiLocale;

  // 1) SDK 로드 + 지도 인스턴스 생성 — 마운트 시 한 번만
  useEffect(() => {
    if (!KAKAO_KEY || !containerRef.current) return;
    let cancelled = false;
    const timeout = setTimeout(() => !cancelled && setStatus("failed"), SDK_LOAD_TIMEOUT_MS);

    const scriptId = "kakao-maps-sdk";
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;

    function init() {
      if (cancelled || !window.kakao || !containerRef.current) return;
      window.kakao.maps.load(() => {
        if (cancelled || !containerRef.current || !window.kakao) return;
        clearTimeout(timeout);
        const center = new window.kakao.maps.LatLng(37.5, 128.4);
        mapRef.current = new window.kakao.maps.Map(containerRef.current, { center, level: 8 });
        setStatus("ready");
      });
    }

    if (existing) {
      init();
    } else {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_KEY}&autoload=false`;
      script.onload = init;
      script.onerror = () => !cancelled && setStatus("failed");
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, []);

  // 2) day(또는 언어)가 바뀔 때마다 마커·경로선만 다시 그림 — 지도 인스턴스는 그대로 재사용
  useEffect(() => {
    const kakao = window.kakao;
    const map = mapRef.current;
    if (!kakao || !map || status !== "ready") return;

    markerOverlaysRef.current.forEach((o) => o.setMap(null));
    markerOverlaysRef.current = [];
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    if (day.stops.length === 0) return;

    const ordered = [...day.stops].sort((a, b) => a.order - b.order);
    const bounds = new kakao.maps.LatLngBounds();

    ordered.forEach((stop) => {
      const position = new kakao.maps.LatLng(stop.lat, stop.lng);
      bounds.extend(position);
      const { primary } = pickName(stop.name, locale);
      const overlay = new kakao.maps.CustomOverlay({
        position,
        content: buildMarkerEl(`${stop.order} · ${primary}`),
        yAnchor: 1,
      });
      overlay.setMap(map);
      markerOverlaysRef.current.push(overlay);
    });

    if (ordered.length > 1) {
      const path = ordered.map((s) => new kakao.maps.LatLng(s.lat, s.lng));
      const polyline = new kakao.maps.Polyline({
        path,
        strokeWeight: 4,
        strokeColor: "#0B7A55",
        strokeOpacity: 0.75,
        strokeStyle: "solid",
      });
      polyline.setMap(map);
      polylineRef.current = polyline;
      map.setBounds(bounds);
    } else {
      map.setCenter(new kakao.maps.LatLng(ordered[0].lat, ordered[0].lng));
    }
  }, [day, status, locale]);

  // 3) 내 위치 파란점 — 페이지가 열려 있는 동안만 갱신, 서버 전송/저장 없음(PRD 2.1절)
  useEffect(() => {
    const kakao = window.kakao;
    const map = mapRef.current;
    if (status !== "ready" || !kakao || !map || typeof navigator === "undefined" || !navigator.geolocation) {
      onMyLocationChange?.(false);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const latlng = new kakao.maps.LatLng(position.coords.latitude, position.coords.longitude);
        myLocationOverlayRef.current?.setMap(null);
        const overlay = new kakao.maps.CustomOverlay({ position: latlng, content: buildMyLocationEl(), zIndex: 10 });
        overlay.setMap(map);
        myLocationOverlayRef.current = overlay;
        onMyLocationChange?.(true);
      },
      () => {
        onMyLocationChange?.(false);
      },
      { enableHighAccuracy: false, maximumAge: 15000, timeout: 8000 }
    );
    watchIdRef.current = watchId;

    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      myLocationOverlayRef.current?.setMap(null);
      myLocationOverlayRef.current = null;
      onMyLocationChange?.(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

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
