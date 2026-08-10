import { useMemo, useState } from "react";
import { PatchDiff, type DiffLineAnnotation, type SelectedLineRange } from "@pierre/diffs/react";
import type { CodeAnnotation, DiffFile } from "../../shared/types";
import type { AnnotationDraft } from "./AnnotationComposer";

export function DiffViewer({ file, annotations, onSelectLines }: { file: DiffFile; annotations: CodeAnnotation[]; onSelectLines(draft: AnnotationDraft): void }) {
  const [selection, setSelection] = useState<SelectedLineRange | null>(null);
  const lineAnnotations = useMemo<DiffLineAnnotation<CodeAnnotation>[]>(() => annotations.flatMap((annotation) => {
    if (annotation.lineStart == null) return [];
    return [{ side: annotation.side === "old" ? "deletions" : "additions", lineNumber: annotation.lineStart, metadata: annotation }];
  }), [annotations]);
  return (
    <div className="pierre-shell" data-testid={`diff-${file.path}`}>
      <PatchDiff<CodeAnnotation>
        patch={file.patch}
        disableWorkerPool
        selectedLines={selection}
        lineAnnotations={lineAnnotations}
        options={{
          diffStyle: "unified",
          overflow: "scroll",
          lineDiffType: "word-alt",
          hunkSeparators: "line-info-basic",
          themeType: "light",
          disableFileHeader: true,
          enableLineSelection: true,
          onLineSelected(range) {
            setSelection(range);
            if (!range) return;
            onSelectLines({
              filePath: file.path,
              lineStart: Math.min(range.start, range.end),
              lineEnd: Math.max(range.start, range.end),
              side: (range.side ?? "additions") === "deletions" ? "old" : "new",
            });
          },
        }}
        renderAnnotation={(annotation) => annotation.metadata ? (
          <div className="mx-3 my-1 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-slate-800">
            {annotation.metadata.conventionalLabel === "question" && <span className="mr-1 font-semibold text-indigo-800">Question:</span>}
            {annotation.metadata.body}
          </div>
        ) : null}
      />
    </div>
  );
}
