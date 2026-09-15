"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Header } from "@/components/layout/Header";
import { ResultView } from "@/components/result/ResultView";
import { LoadingScreen } from "@/components/result/LoadingScreen";
import { GenerateErrorScreen } from "@/components/result/GenerateErrorScreen";
import { SaveFlowModal } from "@/components/save/SaveFlowModal";
import { useWatch } from "@/components/managing/WatchContext";
import { generateItinerary, narrateItinerary } from "@/app/lib/api";
import {
  loadGuestItinerary,
  loadPendingRequest,
  saveGuestItinerary,
  clearGuestItinerary,
  markJustSaved,
  consumePendingSave,
} from "@/app/lib/storage";
import type {
  ErrorCode,
  GenerateRequest,
  GenerateResponseData,
  Localized,
  NarrateRequestDay,
  NarrateResponseData,
} from "@/app/lib/types";

/** narrate 요청은 프롬프트에 필요한 값(장소명·카테고리·시군)만 담는다(API_CONTRACT.md §1) */
function buildNarrateDays(result: GenerateResponseData): NarrateRequestDay[] {
  return result.itinerary_json.days.map((d) => ({
    day: d.day,
    region_code: d.region_code,
    stops: d.stops.map((s) => ({ poi_id: s.poi_id, name_ko: s.name.ko ?? "", category: s.category })),
  }));
}

function hasText(loc: Localized | null | undefined): loc is Localized {
  return Boolean(loc && (loc.ko || loc.en || loc.zh));
}

/**
 * narrate 응답을 기존 결과에 병합한다. narrate는 실패해도 200 + 전부 null로 오므로(계약),
 * 값이 있을 때만 덮어쓴다 — 이미 채워진 걸 null로 되돌리지 않는다.
 */
function mergeNarration(base: GenerateResponseData, narrate: NarrateResponseData): GenerateResponseData {
  const blurbByPoiId = new Map(narrate.blurbs.map((b) => [b.poi_id, b]));
  return {
    ...base,
    itinerary_json: {
      ...base.itinerary_json,
      narration: hasText(narrate.narration) ? narrate.narration : base.itinerary_json.narration,
      region_reason: hasText(narrate.region_reason) ? narrate.region_reason : base.itinerary_json.region_reason,
      days: base.itinerary_json.days.map((d) => ({
        ...d,
        stops: d.stops.map((s) => {
          const blurb = blurbByPoiId.get(s.poi_id);
          return hasText(blurb) ? { ...s, blurb } : s;
        }),
      })),
    },
  };
}

type ViewState =
  | { kind: "loading"; request: GenerateRequest }
  | { kind: "error"; request: GenerateRequest; code: ErrorCode }
  | { kind: "ready"; request: GenerateRequest; result: GenerateResponseData }
  | { kind: "empty" };

export default function GuestResultPage() {
  const router = useRouter();
  const { setWatchedId } = useWatch();
  const [state, setState] = useState<ViewState>({ kind: "empty" });
  const [saveOpen, setSaveOpen] = useState(false);
  const [resumeMode, setResumeMode] = useState<"save" | "retry" | undefined>(undefined);

  // /generate 응답이 오면 즉시 코스를 그리고, 이어서 narrate를 호출해 설명을 채운다
  // (API_CONTRACT.md §1) — 로딩 스피너를 두 번 보여주지 않으므로 state는 건드리지 않고
  // 나중에 채워질 때만 "ready" 상태를 조용히 갱신한다.
  const fillNarration = useCallback((request: GenerateRequest, result: GenerateResponseData) => {
    narrateItinerary(request.lang, result.selected_regions, buildNarrateDays(result))
      .then((res) => {
        if (!res.data) return;
        setState((prev) => {
          if (prev.kind !== "ready") return prev;
          const merged = mergeNarration(prev.result, res.data);
          saveGuestItinerary({ request: prev.request, response: merged });
          return { ...prev, result: merged };
        });
      })
      .catch(() => {
        // narrate는 부가 기능 — 실패해도 이미 그려진 코스는 그대로 둔다(설명 없이 유지)
      });
  }, []);

  const runGenerate = useCallback(
    async (request: GenerateRequest) => {
      setState({ kind: "loading", request });
      try {
        const res = await generateItinerary(request);
        if (res.data) {
          saveGuestItinerary({ request, response: res.data });
          setState({ kind: "ready", request, result: res.data });
          fillNarration(request, res.data);
        } else {
          setState({ kind: "error", request, code: res.error.code });
        }
      } catch {
        // generateItinerary는 이제 throw하지 않지만(P0-A), 어떤 경로로든 예외가 새어나와도
        // loading 상태에 박제되지 않도록 마지막 방어선을 둔다.
        setState({ kind: "error", request, code: "NETWORK_ERROR" });
      }
    },
    [fillNarration]
  );

  useEffect(() => {
    // sessionStorage는 SSR에 없으므로 마운트 후 클라이언트에서만 읽어 하이드레이션한다
    const existing = loadGuestItinerary();
    if (existing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ kind: "ready", request: existing.request, result: existing.response });
      return;
    }
    const pending = loadPendingRequest();
    if (!pending) {
      router.replace("/");
      return;
    }
    runGenerate(pending);
    // 마운트 시 1회만 — 이후 재생성은 사용자의 재시도 클릭으로만 트리거
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // 저장 버튼 → Google 로그인은 전체 페이지 리다이렉트다(P0-C) — 돌아왔을 때 코스가
    // 준비된 뒤(state가 "ready"가 된 뒤) 저장을 이어가려던 흔적이 있었는지 한 번만 확인한다.
    if (state.kind !== "ready") return;
    if (!consumePendingSave()) return;

    // Google 동의 화면에서 취소하면 Supabase가 redirectTo에 error 계열 쿼리스트링(또는 해시)을
    // 붙여 돌려보낸다 — implicit 플로우 클라이언트가 처리하고 남긴 잔여값이므로 확인 후 지운다.
    const url = new URL(window.location.href);
    const hadOAuthError = url.searchParams.has("error") || window.location.hash.includes("error=");
    if (url.search || url.hash) {
      window.history.replaceState(null, "", url.pathname);
    }

    // sessionStorage/URL(외부 상태)에서 되돌아온 것을 반영하는 것이라 렌더 중 파생이 불가능하다
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaveOpen(true);
    setResumeMode(hadOAuthError ? "retry" : "save");
  }, [state.kind]);

  if (state.kind === "empty") return null;

  if (state.kind === "loading") {
    return <LoadingScreen request={state.request} />;
  }

  if (state.kind === "error") {
    const code =
      state.code === "NO_CANDIDATE" || state.code === "NETWORK_ERROR" ? state.code : "INTERNAL_ERROR";
    return (
      <GenerateErrorScreen
        code={code}
        onRetry={() => runGenerate(state.request)}
        onChangeConditions={() => router.push("/")}
      />
    );
  }

  const { request, result } = state;

  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <div className="flex-grow">
        <ResultView
          itineraryJson={result.itinerary_json}
          selectedRegions={result.selected_regions}
          preferenceWeights={result.preference_weights}
          startDate={request.start_date}
          endDate={request.end_date}
          companions={request.companions}
          relationship={request.relationship}
          status="unsaved"
          onSave={() => setSaveOpen(true)}
        />
      </div>
      <SaveFlowModal
        open={saveOpen}
        onClose={() => {
          setSaveOpen(false);
          setResumeMode(undefined);
        }}
        result={result}
        meta={{
          start_date: request.start_date,
          end_date: request.end_date,
          companions: request.companions,
          relationship: request.relationship,
        }}
        resumeMode={resumeMode}
        onSaved={(id) => {
          clearGuestItinerary();
          markJustSaved(id);
          setWatchedId(id);
          router.replace(`/itinerary/${id}`);
        }}
      />
    </div>
  );
}
