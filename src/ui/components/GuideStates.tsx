import { useEffect, useState } from "react";
import { Alert } from "./Icons";

export function EmptyGuide({ onGenerate, onBack }: { onGenerate(): void; onBack(): void }) {
  return <div className="state-page"><div className="state-card"><h2>Start a guided review?</h2><p>Claude Code can organize the current diff into a chaptered walkthrough. Generation runs only after you choose it.</p><div className="mt-6 flex gap-2"><button type="button" className="button-primary" onClick={onGenerate}>Generate guide</button><button type="button" className="button-secondary" onClick={onBack}>Back to diff</button></div></div></div>;
}

export function GeneratingGuide({ startedAt, onCancel }: { startedAt: number; onCancel(): void }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const update = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    update();
    const timer = setInterval(update, 1_000);
    return () => clearInterval(timer);
  }, [startedAt]);
  return <div className="mx-auto w-full max-w-6xl p-5 md:p-8"><div className="mb-6 flex items-center justify-between"><div><h2 className="text-lg font-semibold text-slate-950">Organizing the review…</h2><p className="mt-1 text-sm text-slate-500">Claude Code is reading the supplied changeset. {elapsed}s elapsed.</p></div><button type="button" className="button-secondary" onClick={onCancel}>Cancel</button></div><div className="space-y-4">{[0,1,2].map((item) => <div key={item} className="animate-pulse rounded-lg border border-slate-200 p-5"><div className="h-4 w-56 rounded bg-slate-200" /><div className="mt-4 grid gap-6 md:grid-cols-[360px_1fr]"><div className="space-y-2"><div className="h-3 rounded bg-slate-100" /><div className="h-3 w-4/5 rounded bg-slate-100" /></div><div className="h-32 rounded bg-slate-100" /></div></div>)}</div></div>;
}

export function FailedGuide({ message, onRetry, onBack }: { message: string; onRetry(): void; onBack(): void }) {
  return <div className="state-page"><div className="state-card"><Alert className="mb-4 h-7 w-7 text-rose-600" /><h2>Guide generation failed</h2><p>{message}</p><div className="mt-6 flex gap-2"><button type="button" className="button-primary" onClick={onRetry}>Retry</button><button type="button" className="button-secondary" onClick={onBack}>Back to diff</button></div></div></div>;
}
