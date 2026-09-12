"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Header } from "@/components/layout/Header";
import { ResultView } from "@/components/result/ResultView";
import { LoadingScreen } from "@/components/result/LoadingScreen";
import { GenerateErrorScreen } from "@/components/result/GenerateErrorScreen";
import { SaveFlowModal } from "@/components/save/SaveFlowModal";
import { useWatch } from "@/components/managing/WatchContext";
import { generateItinerary } from "@/app/lib/api";
import {
  loadGuestItinerary,
  loadPendingRequest,
  saveGuestItinerary,
  clearGuestItinerary,
  markJustSaved,
} from "@/app/lib/storage";
import type { ErrorCode, GenerateRequest, GenerateResponseData } from "@/app/lib/types";

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

  const runGenerate = useCallback(async (request: GenerateRequest) => {
    setState({ kind: "loading", request });
    const res = await generateItinerary(request);
    if (res.data) {
      saveGuestItinerary({ request, response: res.data });
      setState({ kind: "ready", request, result: res.data });
    } else {
      setState({ kind: "error", request, code: res.error.code });
    }
  }, []);

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

  if (state.kind === "empty") return null;

  if (state.kind === "loading") {
    return <LoadingScreen request={state.request} />;
  }

  if (state.kind === "error") {
    const code = state.code === "NO_CANDIDATE" ? "NO_CANDIDATE" : "INTERNAL_ERROR";
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
        onClose={() => setSaveOpen(false)}
        result={result}
        meta={{
          start_date: request.start_date,
          end_date: request.end_date,
          companions: request.companions,
          relationship: request.relationship,
        }}
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
