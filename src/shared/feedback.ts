import type { CodeAnnotation, PersonalReviewRound } from "./types";

function escapePath(path: string): string {
  return path.replaceAll("`", "\\`");
}

function annotationSort(a: CodeAnnotation, b: CodeAnnotation): number {
  return (a.lineStart ?? -1) - (b.lineStart ?? -1) || (a.lineEnd ?? -1) - (b.lineEnd ?? -1) || a.createdAt - b.createdAt || a.id.localeCompare(b.id);
}

function annotationPrefix(annotation: CodeAnnotation): string {
  const label = annotation.conventionalLabel === "question" ? "Question: " : "";
  if (annotation.lineStart == null) return `File comment: ${label}`;
  if (annotation.lineEnd != null && annotation.lineEnd !== annotation.lineStart) {
    return `Lines ${annotation.lineStart}–${annotation.lineEnd} — ${label}`;
  }
  return `Line ${annotation.lineStart}: ${label}`;
}

export function formatFeedback(round: PersonalReviewRound): string {
  const parts = ["# Guided review feedback"];
  const overall = round.generalFeedback.trim();
  if (overall) parts.push(`## Overall\n\n${overall}`);
  const groups = new Map<string, CodeAnnotation[]>();
  for (const annotation of round.annotations) {
    if (!annotation.body.trim()) continue;
    const group = groups.get(annotation.filePath) ?? [];
    group.push(annotation);
    groups.set(annotation.filePath, group);
  }
  for (const path of [...groups.keys()].toSorted()) {
    const annotations = groups.get(path)!.toSorted(annotationSort);
    parts.push(`## \`${escapePath(path)}\`\n\n${annotations.map((annotation) => `- ${annotationPrefix(annotation)}${annotation.body.trim()}`).join("\n")}`);
  }
  return `${parts.join("\n\n")}\n`;
}
