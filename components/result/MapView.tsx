"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
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
  setLevel: (level: number) => void;
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

// effect 2가 매번 다시 계산하는 "이 day를 화면에 어떻게 잡을지"를 fitToCourse()가 그대로
// 재사용할 수 있게 저장해둔다. 스탑이 2개 이상이면 setBounds, 1개면 setCenter로 갈리는
// 기존 분기(아래 effect 2)를 그대로 반영 — union으로 both case를 명시해 fitToCourse가
// setBounds 하나로 억지로 통일하지 않게 한다(단일 스탑에 setBounds를 쓰면 확대 배율이
// 기존과 달라진다).
type CourseView = { kind: "bounds"; bounds: KakaoBounds } | { kind: "center"; latlng: KakaoLatLng };

export type MapViewHandle = {
  panToMyLocation: () => void;
  fitToCourse: () => void;
};

/**
 * SDK 로드를 모듈 스코프에 한 번만 캐시해둔다. 이유: 개발 모드의 React Strict Mode는 effect를
 * 마운트→클린업→재마운트로 두 번 태운다. 예전 구현처럼 `<script>` 태그와 onload 핸들러를 effect
 * 안에서 직접 관리하면, 첫 번째 마운트가 만든 태그가 DOM에 남은 채(스크립트 태그 자체는 지워지지
 * 않음) 두 번째 마운트가 "이미 있는 태그"로 오인해 로드 완료를 기다리지 않고 지나가 버리고, 정작
 * 그 태그의 onload는 첫 번째 마운트의 콜백(이미 cancelled)만 붙어 있어 아무 것도 실행되지 않는다
 * — 카카오맵 제품을 활성화한 뒤 실측하다가 "영원히 불러오는 중"에 멈추는 걸로 발견했다. 프로미스를
 * 모듈 전역에 캐시해두면 몇 번을 다시 mount해도 항상 같은 로드 시도를 공유해 이 문제가 없다.
 */
let kakaoSdkPromise: Promise<void> | null = null;

function loadKakaoSdk(): Promise<void> {
  if (kakaoSdkPromise) return kakaoSdkPromise;

  kakaoSdkPromise = new Promise<void>((resolve, reject) => {
    if (window.kakao?.maps?.LatLng) {
      resolve();
      return;
    }

    const onSdkScriptLoaded = () => {
      if (!window.kakao) {
        reject(new Error("kakao maps sdk script loaded but window.kakao missing"));
        return;
      }
      window.kakao.maps.load(() => resolve());
    };

    const scriptId = "kakao-maps-sdk";
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existing) {
      if (window.kakao) {
        onSdkScriptLoaded();
      } else {
        existing.addEventListener("load", onSdkScriptLoaded, { once: true });
      }
      existing.addEventListener("error", () => reject(new Error("kakao sdk script error")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_KEY}&autoload=false`;
    script.onload = onSdkScriptLoaded;
    script.onerror = () => reject(new Error("kakao sdk script error"));
    document.head.appendChild(script);
  });

  // 실패하면 캐시를 비워 다음 시도(재시도 버튼)가 새로 시도할 수 있게 한다
  kakaoSdkPromise.catch(() => {
    kakaoSdkPromise = null;
  });

  return kakaoSdkPromise;
}

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
export const MapView = forwardRef<
  MapViewHandle,
  {
    day: Day;
    onRetry?: () => void;
    onMyLocationChange?: (hasLocation: boolean) => void;
  }
>(function MapView({ day, onRetry, onMyLocationChange }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const markerOverlaysRef = useRef<KakaoOverlay[]>([]);
  const polylineRef = useRef<KakaoPolyline | null>(null);
  const myLocationOverlayRef = useRef<KakaoOverlay | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const courseViewRef = useRef<CourseView | null>(null);
  const lastPositionRef = useRef<{ lat: number; lng: number } | null>(null);

  const [status, setStatus] = useState<Status>(KAKAO_KEY ? "loading" : "failed");
  const [retryTick, setRetryTick] = useState(0);
  const t = useTranslations("result");
  const tc = useTranslations("common");
  const locale = useLocale() as UiLocale;

  // 1) SDK 로드 + 지도 인스턴스 생성. retryTick이 바뀌면(재시도 버튼) 다시 시도한다.
  useEffect(() => {
    if (!KAKAO_KEY || !containerRef.current) return;
    let cancelled = false;
    const timeout = setTimeout(() => !cancelled && setStatus("failed"), SDK_LOAD_TIMEOUT_MS);

    loadKakaoSdk()
      .then(() => {
        if (cancelled || !containerRef.current || !window.kakao) return;
        clearTimeout(timeout);
        const center = new window.kakao.maps.LatLng(37.5, 128.4);
        mapRef.current = new window.kakao.maps.Map(containerRef.current, { center, level: 8 });
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("failed");
      });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [retryTick]);

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

    if (day.stops.length === 0) {
      courseViewRef.current = null;
      return;
    }

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
      courseViewRef.current = { kind: "bounds", bounds };
    } else {
      const center = new kakao.maps.LatLng(ordered[0].lat, ordered[0].lng);
      map.setCenter(center);
      courseViewRef.current = { kind: "center", latlng: center };
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
        // panToMyLocation()이 되돌아갈 좌표가 없으면 아무 일도 못 하므로 여기 저장해둔다
        // (오버레이만 그리고 좌표 자체는 버리던 것이 이번 기능의 전제 조건이었다).
        lastPositionRef.current = { lat: position.coords.latitude, lng: position.coords.longitude };
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
      lastPositionRef.current = null;
      onMyLocationChange?.(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useImperativeHandle(
    ref,
    () => ({
      panToMyLocation() {
        const map = mapRef.current;
        const kakao = window.kakao;
        const pos = lastPositionRef.current;
        if (!map || !kakao || !pos) return;
        map.setCenter(new kakao.maps.LatLng(pos.lat, pos.lng));
        map.setLevel(5);
      },
      fitToCourse() {
        const map = mapRef.current;
        const view = courseViewRef.current;
        if (!map || !view) return;
        if (view.kind === "bounds") map.setBounds(view.bounds);
        else map.setCenter(view.latlng);
      },
    }),
    []
  );

  if (status === "failed") {
    return (
      <div className="flex h-full flex-col items-center gap-3 bg-bg-subtler px-8 pb-8 pt-10 text-center md:justify-center md:pt-8">
        <p className="text-[15px] font-bold tracking-tight">{t("mapFallbackTitle")}</p>
        <p className="max-w-xs text-[12.5px] leading-relaxed text-muted">{t("mapFallbackBody")}</p>
        <button
          type="button"
          onClick={() => {
            setStatus(KAKAO_KEY ? "loading" : "failed");
            setRetryTick((n) => n + 1);
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
});
