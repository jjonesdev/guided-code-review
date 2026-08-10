import type { DiffFile, PersonalReviewSnapshot, ProjectedSection, ReviewProjection } from "./types";
import { sha256 } from "./fingerprints";

export function fingerprintFiles(files: DiffFile[]): Record<string, string> {
  return Object.fromEntries(files.map((file) => [file.path, sha256(file.patch)]));
}

export function projectGuide(snapshot: PersonalReviewSnapshot, files: DiffFile[], currentFingerprint: string): ReviewProjection {
  const currentByPath = new Map(files.map((file) => [file.path, file]));
  const placed = new Set<string>();
  let changedCount = 0;
  let removedCount = 0;
  const changedPaths = new Set<string>();
  const removedPaths = new Set<string>();
  for (const path of Object.keys(snapshot.fileFingerprints)) {
    const file = currentByPath.get(path);
    if (!file) {
      removedCount += 1;
      removedPaths.add(path);
    } else if (sha256(file.patch) !== snapshot.fileFingerprints[path]) {
      changedCount += 1;
      changedPaths.add(path);
    }
  }
  const addedPaths = files.filter((file) => !(file.path in snapshot.fileFingerprints)).map((file) => file.path);
  const addedSet = new Set(addedPaths);

  const sections: ProjectedSection[] = snapshot.guide.sections.map((section, index) => {
    const projectedFiles = section.diffs.map((ref) => {
      placed.add(ref.file);
      return {
        path: ref.file,
        summary: ref.summary,
        file: currentByPath.get(ref.file),
        status: removedPaths.has(ref.file) ? "removed" as const : changedPaths.has(ref.file) ? "changed" as const : "unchanged" as const,
      };
    });
    const affected = projectedFiles.some((file) => file.status !== "unchanged");
    return {
      id: `guide-${index}`,
      title: section.title,
      overview: section.overview,
      files: projectedFiles,
      sourceIndex: index,
      reviewed: !affected && Boolean(snapshot.reviewedSections[index]),
      kind: "guide" as const,
    };
  });

  if (snapshot.guide.unplacedFiles.length) {
    sections.push({
      id: "everything-else",
      title: "Everything else",
      overview: "Changed files the generated walkthrough did not place into a chapter. They remain here so the complete diff is always inspectable.",
      files: snapshot.guide.unplacedFiles.map((path) => {
        placed.add(path);
        return {
          path,
          file: currentByPath.get(path),
          status: removedPaths.has(path) ? "removed" as const : changedPaths.has(path) ? "changed" as const : "unchanged" as const,
        };
      }),
      reviewed: false,
      kind: "unplaced",
    });
  }

  const updates = files.filter((file) => addedSet.has(file.path) || !placed.has(file.path));
  if (updates.length) {
    sections.push({
      id: "updates",
      title: "Updates since last review",
      overview: "Files added after this walkthrough was generated. They are appended locally and have no generated explanation yet.",
      files: updates.map((file) => ({ path: file.path, file, status: "added" as const })),
      reviewed: false,
      kind: "updates",
    });
  }

  return {
    sections,
    changedCount,
    addedCount: addedPaths.length,
    removedCount,
    stale: currentFingerprint !== snapshot.diffFingerprint,
  };
}
