export interface GuideDiffRef {
  file: string;
  summary: string;
}

export interface GuideSection {
  title: string;
  overview: string;
  diffs: GuideDiffRef[];
}

export interface CodeGuideOutput {
  title: string;
  intent: string;
  sections: GuideSection[];
  unplacedFiles: string[];
}

export type FileChangeKind = "added" | "modified" | "deleted" | "renamed";
export type ReviewFileStatus = "unchanged" | "changed" | "added" | "removed";
export type AnnotationSide = "old" | "new";

export interface DiffLine {
  kind: "context" | "addition" | "deletion" | "meta";
  text: string;
  oldLine?: number;
  newLine?: number;
}

export interface DiffFile {
  path: string;
  oldPath?: string;
  patch: string;
  additions: number;
  deletions: number;
  changeKind: FileChangeKind;
  lines: DiffLine[];
}

export interface CodeAnnotation {
  id: string;
  filePath: string;
  body: string;
  lineStart?: number;
  lineEnd?: number;
  side?: AnnotationSide;
  conventionalLabel?: "question";
  createdAt: number;
}

export interface PersonalReviewRound {
  id: string;
  createdAt: number;
  diffFingerprint: string;
  patch: string;
  annotations: CodeAnnotation[];
  generalFeedback: string;
}

export interface PersonalReviewSnapshot {
  id: string;
  createdAt: number;
  repoKey: string;
  reviewTarget: string;
  headSha?: string;
  diffFingerprint: string;
  fileFingerprints: Record<string, string>;
  patch: string;
  guide: CodeGuideOutput;
  reviewedSections: boolean[];
  rounds: PersonalReviewRound[];
}

export interface ProjectedFile {
  path: string;
  summary?: string;
  file?: DiffFile;
  status: ReviewFileStatus;
}

export interface ProjectedSection {
  id: string;
  title: string;
  overview: string;
  files: ProjectedFile[];
  sourceIndex?: number;
  reviewed: boolean;
  kind: "guide" | "unplaced" | "updates";
}

export interface ReviewProjection {
  sections: ProjectedSection[];
  changedCount: number;
  addedCount: number;
  removedCount: number;
  stale: boolean;
}

export interface ReviewStatePayload {
  repoRoot: string;
  reviewTarget: string;
  headSha?: string;
  patch: string;
  files: DiffFile[];
  diffFingerprint: string;
  fileFingerprints: Record<string, string>;
  snapshot: PersonalReviewSnapshot | null;
  projection: ReviewProjection | null;
  fixture: boolean;
  fixtureScenario?: "empty" | "generating" | "ready" | "stale" | "failed";
}

export type GuideJobState =
  | { status: "idle" }
  | { status: "generating"; startedAt: number }
  | { status: "ready" }
  | { status: "failed"; message: string }
  | { status: "cancelled" };
