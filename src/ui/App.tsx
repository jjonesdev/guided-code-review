import { useCallback, useEffect, useMemo, useState } from "react";
import type { CodeAnnotation, GuideJobState, ReviewStatePayload } from "../shared/types";
import { api, initializeCapability } from "./api";
import { GuideWorkspace } from "./components/GuideWorkspace";
import { EmptyGuide, FailedGuide, GeneratingGuide } from "./components/GuideStates";
import { NormalDiffWorkspace } from "./components/NormalDiffWorkspace";
import { ArrowLeft, Check, Copy } from "./components/Icons";

initializeCapability();

export function App() {
  const [state, setState] = useState<ReviewStatePayload | null>(null);
  const [mode, setMode] = useState<"diff" | "guide">("diff");
  const [job, setJob] = useState<GuideJobState>({ status: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [fallback, setFallback] = useState<string | null>(null);
  const [localFeedback, setLocalFeedback] = useState("");
  const scenario = useMemo(() => new URLSearchParams(location.search).get("fixtureState") ?? undefined, []);
  const clipboardFailureFixture = useMemo(() => new URLSearchParams(location.search).get("clipboard") === "fail", []);

  const activeRound = state?.snapshot?.rounds.at(-1);
  const annotations = activeRound?.annotations ?? [];
  useEffect(() => { setLocalFeedback(activeRound?.generalFeedback ?? ""); }, [activeRound?.id, activeRound?.generalFeedback]);

  useEffect(() => {
    api.review(scenario).then((payload) => {
      setState(payload);
      if (payload.fixtureScenario === "generating") { setMode("guide"); setJob({ status: "generating", startedAt: Date.now() - 4_000 }); }
      if (payload.fixtureScenario === "failed") { setMode("guide"); setJob({ status: "failed", message: "Claude Code exited before returning a valid structured guide." }); }
      if (scenario === "empty" || scenario === "stale" || scenario === "ready") setMode("guide");
    }).catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load the review."));
  }, [scenario]);

  const generate = useCallback(async (regenerate = false) => {
    setMode("guide"); setJob({ status: "generating", startedAt: Date.now() }); setError(null);
    try { const payload = await api.generate(regenerate); setState(payload); setJob({ status: "ready" }); }
    catch (caught) { setJob({ status: "failed", message: caught instanceof Error ? caught.message : "Guide generation failed." }); }
  }, []);

  const save = useCallback(async (update: { reviewedSections?: boolean[]; annotations?: CodeAnnotation[]; generalFeedback?: string }) => {
    try { setState(await api.update(update)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save the review."); }
  }, []);

  const copyFeedback = useCallback(async () => {
    try {
      if (state?.snapshot && localFeedback !== activeRound?.generalFeedback) await save({ generalFeedback: localFeedback });
      const { markdown } = await api.feedback();
      try {
        if (state?.fixture && clipboardFailureFixture) throw new Error("fixture clipboard failure");
        await navigator.clipboard.writeText(markdown);
        setToast("Feedback copied"); setFallback(null); setTimeout(() => setToast(null), 2_500);
      } catch {
        setFallback(markdown); setError("Clipboard access failed. Select and copy the Markdown below manually.");
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not prepare feedback."); }
  }, [activeRound?.generalFeedback, clipboardFailureFixture, localFeedback, save, state?.fixture, state?.snapshot]);

  if (!state && !error) return <div className="state-page"><div className="text-sm text-slate-500">Loading local review…</div></div>;
  if (!state) return <div className="state-page"><div className="state-card"><h2>Review could not open</h2><p>{error}</p></div></div>;
  const guideVisible = mode === "guide";
  const progress = state.snapshot ? `${state.snapshot.reviewedSections.filter(Boolean).length} of ${state.snapshot.guide.sections.length} reviewed` : "";
  return (
    <div className="flex h-dvh flex-col bg-white text-slate-900">
      <header className="app-header">
        <button type="button" className="header-link" onClick={() => setMode(guideVisible ? "diff" : "guide")}><ArrowLeft className={`h-4 w-4 ${guideVisible ? "" : "rotate-180"}`} />{guideVisible ? "Back to diff" : "Guided Review"}</button>
        <div className="min-w-0 flex-1 truncate text-sm font-semibold">{guideVisible && state.snapshot ? state.snapshot.guide.title : "Local changes"}</div>
        {guideVisible && progress && <span className="hidden text-xs text-slate-500 sm:inline">{progress}</span>}
        {state.snapshot && <button type="button" className="button-primary" onClick={copyFeedback}><Copy className="h-4 w-4" />Copy feedback</button>}
      </header>
      {error && <div className="flex items-center justify-between border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-800"><span>{error}</span><button type="button" className="font-semibold" onClick={() => setError(null)}>Dismiss</button></div>}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!guideVisible ? <NormalDiffWorkspace files={state.files} annotations={annotations} onAddAnnotation={(annotation) => save({ annotations: [...annotations, annotation] })} onOpenGuide={() => setMode("guide")} /> :
          job.status === "generating" ? <GeneratingGuide startedAt={job.startedAt} onCancel={async () => { await api.cancel(); setJob({ status: "cancelled" }); }} /> :
          job.status === "failed" ? <FailedGuide message={job.message} onRetry={() => generate(false)} onBack={() => setMode("diff")} /> :
          !state.snapshot || !state.projection ? <EmptyGuide onGenerate={() => generate(false)} onBack={() => setMode("diff")} /> :
          <GuideWorkspace snapshot={state.snapshot} projection={state.projection} annotations={annotations} generalFeedback={localFeedback} onAnnotations={(value) => save({ annotations: value })} onGeneralFeedback={setLocalFeedback} onCommitGeneralFeedback={(value) => save({ generalFeedback: value })} onReviewed={(value) => save({ reviewedSections: value })} onRegenerate={() => generate(true)} />}
      </div>
      {toast && <div className="toast"><Check className="h-4 w-4 text-emerald-700" />{toast}</div>}
      {fallback && <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-3xl rounded-lg border border-slate-300 bg-white p-4 shadow-xl"><div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold">Copy Markdown manually</h2><button type="button" className="text-xs font-semibold" onClick={() => setFallback(null)}>Close</button></div><textarea readOnly value={fallback} onFocus={(event) => event.currentTarget.select()} className="h-52 w-full rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-xs" /></div>}
    </div>
  );
}
