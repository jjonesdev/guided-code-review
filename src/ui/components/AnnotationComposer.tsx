import { useState } from "react";
import type { CodeAnnotation } from "../../shared/types";

export interface AnnotationDraft {
  filePath: string;
  lineStart?: number;
  lineEnd?: number;
  side?: "old" | "new";
}

export function AnnotationComposer({ draft, onAdd, onCancel }: { draft: AnnotationDraft; onAdd(annotation: CodeAnnotation): void; onCancel(): void }) {
  const [body, setBody] = useState("");
  const [question, setQuestion] = useState(false);
  const range = draft.lineStart == null ? `File comment on ${draft.filePath}` : `${draft.lineStart === draft.lineEnd || draft.lineEnd == null ? "Line" : "Lines"} ${draft.lineStart}${draft.lineEnd && draft.lineEnd !== draft.lineStart ? `–${draft.lineEnd}` : ""} in ${draft.filePath}`;
  return (
    <div className="border-t border-slate-200 bg-slate-50/70 p-3" data-testid="annotation-composer">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-md border border-slate-200 bg-white p-0.5 text-xs">
          <button type="button" className={`rounded px-3 py-1.5 ${!question ? "bg-indigo-50 font-medium text-indigo-800" : "text-slate-600"}`} onClick={() => setQuestion(false)}>Comment</button>
          <button type="button" className={`rounded px-3 py-1.5 ${question ? "bg-indigo-50 font-medium text-indigo-800" : "text-slate-600"}`} onClick={() => setQuestion(true)}>Question</button>
        </div>
        <span className="font-mono text-[10px] text-slate-500">{range}</span>
      </div>
      <textarea autoFocus value={body} onChange={(event) => setBody(event.target.value)} placeholder={question ? "What needs clarification?" : "Leave a review comment…"} className="min-h-24 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm leading-relaxed outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11px] text-slate-500">Markdown supported</span>
        <div className="flex gap-2">
          <button type="button" className="button-secondary" onClick={onCancel}>Cancel</button>
          <button type="button" className="button-primary" disabled={!body.trim()} onClick={() => onAdd({ id: crypto.randomUUID(), filePath: draft.filePath, body: body.trim(), lineStart: draft.lineStart, lineEnd: draft.lineEnd, side: draft.side, conventionalLabel: question ? "question" : undefined, createdAt: Date.now() })}>Add comment</button>
        </div>
      </div>
    </div>
  );
}
