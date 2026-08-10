import { useState } from "react";
import type { CodeAnnotation, DiffFile } from "../../shared/types";
import { DiffCard } from "./DiffCard";

export function NormalDiffWorkspace({ files, annotations, onAddAnnotation, onOpenGuide }: { files: DiffFile[]; annotations: CodeAnnotation[]; onAddAnnotation(annotation: CodeAnnotation): void; onOpenGuide(): void }) {
  const [active, setActive] = useState(files[0]?.path ?? "");
  const activeFile = files.find((file) => file.path === active) ?? files[0];
  return (
    <div className="grid min-h-0 flex-1 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="border-r border-slate-200 bg-slate-50/60 p-3">
        <div className="mb-3 flex items-center justify-between px-2"><h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Changed files</h2><span className="font-mono text-[10px] text-slate-400">{files.length}</span></div>
        <nav className="space-y-1">{files.map((file) => <button key={file.path} type="button" onClick={() => setActive(file.path)} className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left ${activeFile?.path === file.path ? "bg-indigo-50 text-indigo-900" : "text-slate-700 hover:bg-white"}`}><span className="min-w-0 flex-1 truncate font-mono text-[11px]">{file.path}</span><span className="text-[10px] text-emerald-700">+{file.additions}</span></button>)}</nav>
      </aside>
      <main className="min-w-0 overflow-y-auto p-4 md:p-6">
        {!activeFile ? <div className="empty-panel"><h2>No local changes</h2><p>The working tree has no diff to review.</p></div> : <DiffCard file={activeFile} path={activeFile.path} annotations={annotations.filter((item) => item.filePath === activeFile.path)} onAddAnnotation={onAddAnnotation} />}
      </main>
    </div>
  );
}
