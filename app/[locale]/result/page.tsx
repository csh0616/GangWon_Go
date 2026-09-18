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
    const pending = loadPendingRequest();

    // MainForm에서 조건을 바꿔 새로 제출하면 pending_request는 새 값으로 덮어써지지만
    // guest_itinerary는 이전 생성 결과가 그대로 남아 있다 — existing만 보고 먼저 반환하면
    // 조건을 바꿔도 이전 코스가 계속 나온다(외부 검수 리포트 01). pending이 존재하고
    // existing.request와 다르면 이전 결과를 무효화하고 새로 생성한다. 같은 조건이면(또는
    // pending이 없으면) 기존 캐시를 그대로 쓴다 — 재생성 낭비를 피한다.
    if (existing && pending && JSON.stringify(existing.request) !== JSON.stringify(pending)) {
      clearGuestItinerary();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      runGenerate(pending);
      return;
    }

    if (existing) {
      setState({ kind: "ready", request: existing.request, result: existing.response });
      return;
    }
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

    // implicit 플로우는 #access_token 해시로 토큰을 받고, supabase-js가 detectSessionInUrl로
    // 그 해시를 비동기로 파싱해 세션을 만든다. 여기서 해시를 먼저 지워버리면(예전에 실제로
    // 그랬다) 로그인이 아예 성립하지 않는다 — 로그인 후에도 배너·모달이 계속 뜨던 버그의
    // 원인 1이었다. 해시는 절대 건드리지 않는다. 지울 것은 Google 동의 화면 취소 시 붙는
    // error 계열 "쿼리스트링"뿐이며, hadOAuthError 판정을 먼저 끝낸 뒤에 지운다.
    const url = new URL(window.location.href);
    const hadOAuthError = url.searchParams.has("error");
    if (hadOAuthError) {
      url.searchParams.delete("error");
      url.searchParams.delete("error_code");
      url.searchParams.delete("error_description");
      window.history.replaceState(null, "", url.pathname + url.search + window.location.hash);
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
