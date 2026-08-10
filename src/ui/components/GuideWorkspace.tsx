import { useEffect, useMemo, useRef, useState } from "react";
import type { CodeAnnotation, PersonalReviewSnapshot, ProjectedSection, ReviewProjection } from "../../shared/types";
import { formatFeedback } from "../../shared/feedback";
import { DiffCard } from "./DiffCard";
import { Markdown } from "./Markdown";
import { Alert, Check, ChevronDown } from "./Icons";

function statusCounts(projection: ReviewProjection): string {
  return `${projection.changedCount} changed, ${projection.addedCount} added, ${projection.removedCount} removed`;
}

function Chapter({ section, position, total, collapsed, onCollapse, onToggleReviewed, annotations, onAddAnnotation, onReveal }: { section: ProjectedSection; position: number; total: number; collapsed: boolean; onCollapse(value: boolean): void; onToggleReviewed(): void; annotations: CodeAnnotation[]; onAddAnnotation(annotation: CodeAnnotation): void; onReveal(path: string): void }) {
  if (collapsed) return <section className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3" data-testid={`chapter-${section.id}`}><button type="button" onClick={onToggleReviewed} className={`review-check ${section.reviewed ? "review-check-on" : ""}`} aria-label={section.reviewed ? "Un-mark as reviewed" : "Mark as reviewed"}>{section.reviewed && <Check className="h-3 w-3" />}</button><button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => onCollapse(false)}><span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">{section.title}</span><span className="text-[11px] text-slate-500">{section.files.length} diff{section.files.length === 1 ? "" : "s"}{section.reviewed ? " · reviewed" : ""}</span><span className="font-mono text-[10px] text-slate-400">{String(position).padStart(2,"0")} / {String(total).padStart(2,"0")}</span><ChevronDown className="h-4 w-4 -rotate-90 text-slate-400" /></button></section>;
  return (
    <section className="overflow-clip rounded-lg border border-slate-200 bg-white" data-testid={`chapter-${section.id}`}>
      <div className="chapter-grid">
        <aside className="border-b border-slate-200 p-5 md:border-b-0 md:border-r md:p-6"><div className="chapter-sticky">
          <div className="flex items-start gap-3"><span className="font-mono text-[10px] text-slate-400">{String(position).padStart(2,"0")} / {String(total).padStart(2,"0")}</span><h2 className="min-w-0 flex-1 text-[15px] font-semibold leading-snug text-slate-950">{section.title}</h2><button type="button" onClick={() => onCollapse(true)} title="Collapse chapter"><ChevronDown className="h-4 w-4 rotate-180 text-slate-400" /></button></div>
          <div className="mt-3"><Markdown value={section.overview} className="text-slate-600" /></div>
          {section.kind === "guide" && <button type="button" className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-slate-700" onClick={onToggleReviewed}><span className={`review-check ${section.reviewed ? "review-check-on" : ""}`}>{section.reviewed && <Check className="h-3 w-3" />}</span>Reviewed</button>}
          <h3 className="mt-6 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Files in this chapter</h3>
          <div className="mt-2 space-y-1.5">{section.files.map((item) => <button key={item.path} type="button" onClick={() => onReveal(item.path)} className="flex w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-2 text-left hover:border-indigo-300 hover:bg-indigo-50/40"><span className="min-w-0 flex-1 truncate font-mono text-[11px] font-medium text-slate-700">{item.path.split("/").at(-1)}</span>{item.status !== "unchanged" && <span className={`status-dot status-${item.status}`} title={item.status} />}{item.file && <span className="font-mono text-[10px]"><span className="text-emerald-700">+{item.file.additions}</span> <span className="text-rose-700">-{item.file.deletions}</span></span>}</button>)}</div>
        </div></aside>
        <div className="min-w-0 space-y-4 bg-slate-50/40 p-3 md:p-4">{section.files.map((item) => <DiffCard key={item.path} file={item.file} path={item.path} summary={item.summary} status={item.status} annotations={annotations.filter((annotation) => annotation.filePath === item.path)} onAddAnnotation={onAddAnnotation} />)}</div>
      </div>
    </section>
  );
}

export function GuideWorkspace({ snapshot, projection, annotations, generalFeedback, onAnnotations, onGeneralFeedback, onCommitGeneralFeedback, onReviewed, onRegenerate }: { snapshot: PersonalReviewSnapshot; projection: ReviewProjection; annotations: CodeAnnotation[]; generalFeedback: string; onAnnotations(value: CodeAnnotation[]): void; onGeneralFeedback(value: string): void; onCommitGeneralFeedback(value: string): void; onReviewed(value: boolean[]): void; onRegenerate(): void }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => Object.fromEntries(projection.sections.map((section) => [section.id, section.reviewed])));
  const [previousOpen, setPreviousOpen] = useState(false);
  const [overallOpen, setOverallOpen] = useState(false);
  const sectionsRef = useRef(projection.sections);
  useEffect(() => { sectionsRef.current = projection.sections; }, [projection.sections]);
  const activeRound = snapshot.rounds.at(-1)!;
  const previousRounds = snapshot.rounds.slice(0, -1);
  const reviewedCount = snapshot.reviewedSections.filter(Boolean).length;
  const reveal = (path: string) => {
    const section = sectionsRef.current.find((item) => item.files.some((file) => file.path === path));
    if (section) setCollapsed((current) => ({ ...current, [section.id]: false }));
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-file-path="${CSS.escape(path)}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const toggleReviewed = (section: ProjectedSection) => {
    if (section.sourceIndex == null) return;
    const next = [...snapshot.reviewedSections];
    next[section.sourceIndex] = !next[section.sourceIndex];
    onReviewed(next);
    if (next[section.sourceIndex]) setCollapsed((current) => ({ ...current, [section.id]: true }));
  };
  const previousMarkdown = useMemo(() => previousRounds.map((round) => ({ id: round.id, markdown: formatFeedback(round), createdAt: round.createdAt })), [previousRounds]);
  return (
    <div className="mx-auto w-full max-w-[1500px] p-4 pb-32 md:p-7 md:pb-36">
      <div className="mb-5 max-w-4xl"><h1 className="text-xl font-semibold tracking-tight text-slate-950 md:text-2xl">{snapshot.guide.title}</h1><p className="mt-1.5 text-sm leading-relaxed text-slate-600">{snapshot.guide.intent}</p><p className="mt-2 font-mono text-[11px] text-slate-400">{snapshot.guide.sections.length} chapters · {projection.sections.reduce((total, section) => total + section.files.length, 0)} files · {reviewedCount}/{snapshot.guide.sections.length} reviewed · generated by Claude Code</p></div>
      {projection.stale && <div className="mb-5 rounded-lg border border-amber-300 bg-amber-50 p-4" data-testid="stale-banner"><div className="flex gap-3"><Alert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><div className="min-w-0 flex-1"><h2 className="text-sm font-semibold text-amber-950">Code has changed since this walkthrough was generated.</h2><p className="mt-1 text-xs leading-relaxed text-amber-900/80">The existing guide has been reused, and its explanations may be outdated. {statusCounts(projection)}.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" className="button-primary" onClick={() => { const target = projection.sections.flatMap((section) => section.files).find((file) => file.status !== "unchanged"); if (target) reveal(target.path); }}>Review updates</button><button type="button" className="button-secondary" onClick={onRegenerate}>Regenerate guide · invokes Claude Code</button></div></div></div></div>}
      <div className="space-y-4">{projection.sections.map((section, index) => <Chapter key={section.id} section={section} position={index + 1} total={projection.sections.length} collapsed={Boolean(collapsed[section.id])} onCollapse={(value) => setCollapsed((current) => ({ ...current, [section.id]: value }))} onToggleReviewed={() => toggleReviewed(section)} annotations={annotations} onAddAnnotation={(annotation) => onAnnotations([...annotations, annotation])} onReveal={reveal} />)}</div>
      {previousMarkdown.length > 0 && <section className="mt-5 rounded-lg border border-slate-200 bg-white"><button type="button" className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-slate-700" onClick={() => setPreviousOpen((value) => !value)}>Previous feedback <ChevronDown className={`h-4 w-4 transition ${previousOpen ? "rotate-180" : ""}`} /></button>{previousOpen && <div className="border-t border-slate-200 p-4">{previousMarkdown.map((item) => <div key={item.id} className="mb-4 last:mb-0"><p className="mb-2 font-mono text-[10px] text-slate-400">{new Date(item.createdAt).toLocaleString()}</p><pre className="overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs text-slate-700">{item.markdown}</pre></div>)}</div>}</section>}
      <div className="feedback-drawer"><div className="mx-auto max-w-[1500px] px-4 py-2.5 md:px-7"><button type="button" className="flex w-full items-center gap-3 text-left" onClick={() => setOverallOpen((value) => !value)} aria-expanded={overallOpen}><ChevronDown className={`h-4 w-4 text-slate-500 transition ${overallOpen ? "rotate-180" : ""}`} /><span className="text-sm font-semibold text-slate-800">Overall feedback</span><span className="min-w-0 flex-1 truncate text-[11px] text-slate-500">{generalFeedback.trim() || "Add high-level feedback to the copied Markdown."}</span></button>{overallOpen && <textarea id="overall-feedback" aria-label="Overall feedback" value={generalFeedback} onChange={(event) => onGeneralFeedback(event.target.value)} onBlur={(event) => onCommitGeneralFeedback(event.target.value)} className="mt-2 min-h-20 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" placeholder="Add high-level feedback about this change…" />}</div></div>
    </div>
  );
}
