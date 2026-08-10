import { lazy, Suspense, useState } from "react";
import type { CodeAnnotation, DiffFile, ReviewFileStatus } from "../../shared/types";
import { AnnotationComposer, type AnnotationDraft } from "./AnnotationComposer";
import { Message } from "./Icons";

const DiffViewer = lazy(() => import("./DiffViewer").then((module) => ({ default: module.DiffViewer })));

const STATUS_COPY: Record<ReviewFileStatus, string> = { unchanged: "", changed: "Changed since review", added: "Added since review", removed: "No longer present" };

export function DiffCard({ file, path, status = "unchanged", summary, annotations, onAddAnnotation }: { file?: DiffFile; path: string; status?: ReviewFileStatus; summary?: string; annotations: CodeAnnotation[]; onAddAnnotation(annotation: CodeAnnotation): void }) {
  const [draft, setDraft] = useState<AnnotationDraft | null>(null);
  const fileComments = annotations.filter((annotation) => annotation.lineStart == null);
  return (
    <article id={`file-${CSS.escape(path)}`} data-file-path={path} className="scroll-mt-20 overflow-hidden rounded-lg border border-slate-200 bg-white">
      {summary && <p className="border-b border-slate-100 px-4 py-2.5 text-xs leading-relaxed text-slate-600">{summary}</p>}
      <header className="flex min-h-10 items-center gap-3 border-b border-slate-200 bg-slate-50/80 px-3">
        <span className="min-w-0 flex-1 truncate font-mono text-xs font-semibold text-slate-800">{path}</span>
        {file && <span className="font-mono text-[11px]"><span className="text-emerald-700">+{file.additions}</span> <span className="text-rose-700">-{file.deletions}</span></span>}
        {STATUS_COPY[status] && <span className={`status-label status-${status}`}>{STATUS_COPY[status]}</span>}
        {file && <button type="button" className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-[11px] text-slate-600 hover:bg-white hover:text-slate-950" onClick={() => setDraft({ filePath: path })}><Message className="h-3.5 w-3.5" />Comment on file</button>}
      </header>
      {file ? <Suspense fallback={<div className="h-36 animate-pulse bg-slate-50" aria-label="Loading diff" />}><DiffViewer file={file} annotations={annotations} onSelectLines={setDraft} /></Suspense> : <div className="flex min-h-32 items-center justify-center p-8 text-center text-sm text-slate-500">This file is not present in the current diff. Its previous patch remains available under Previous feedback.</div>}
      {fileComments.map((annotation) => <div key={annotation.id} className="border-t border-indigo-100 bg-indigo-50 px-4 py-2.5 text-xs text-slate-800"><span className="mr-1 font-semibold text-indigo-800">{annotation.conventionalLabel === "question" ? "File question:" : "File comment:"}</span>{annotation.body}</div>)}
      {draft && <AnnotationComposer draft={draft} onCancel={() => setDraft(null)} onAdd={(annotation) => { onAddAnnotation(annotation); setDraft(null); }} />}
    </article>
  );
}
