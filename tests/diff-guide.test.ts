import { describe, expect, test } from "bun:test";
import { FIXTURE_FILES, FIXTURE_GUIDE, FIXTURE_PATCH } from "../src/shared/fixtures";
import { parseUnifiedDiff } from "../src/shared/diff";
import { parseAndValidateGuide } from "../src/shared/guide";
import { fingerprintFiles, projectGuide } from "../src/shared/projection";
import { sha256 } from "../src/shared/fingerprints";
import type { PersonalReviewSnapshot } from "../src/shared/types";

describe("canonical diff loading and guide validation", () => {
  test("parses all file patches and line positions", () => {
    expect(FIXTURE_FILES.map((file) => file.path)).toEqual(["src/server/http.ts", "src/server/session.ts", "src/shared/store.ts", "src/shared/feedback.ts", "README.md"]);
    expect(FIXTURE_FILES[0]?.lines.find((line) => line.kind === "addition")?.newLine).toBe(23);
    expect(FIXTURE_FILES[1]?.changeKind).toBe("added");
    expect(parseUnifiedDiff("")).toEqual([]);
  });

  test("accepts exact coverage and rejects omissions, duplicates, unknown files, and extra fields", () => {
    expect(parseAndValidateGuide(JSON.stringify(FIXTURE_GUIDE), FIXTURE_FILES)).toEqual(FIXTURE_GUIDE);
    const missing = structuredClone(FIXTURE_GUIDE);
    missing.sections[2]!.diffs.pop();
    expect(() => parseAndValidateGuide(JSON.stringify(missing), FIXTURE_FILES)).toThrow("omitted");
    const duplicate = structuredClone(FIXTURE_GUIDE);
    duplicate.sections[1]!.diffs.push({ ...duplicate.sections[0]!.diffs[0]! });
    expect(() => parseAndValidateGuide(JSON.stringify(duplicate), FIXTURE_FILES)).toThrow("more than once");
    const unknown = structuredClone(FIXTURE_GUIDE);
    unknown.sections[0]!.diffs[0]!.file = "secrets.txt";
    expect(() => parseAndValidateGuide(JSON.stringify(unknown), FIXTURE_FILES)).toThrow("unknown");
    expect(() => parseAndValidateGuide(JSON.stringify({ ...FIXTURE_GUIDE, extra: true }), FIXTURE_FILES)).toThrow("unsupported fields");
  });

  test("projects changed, added, and removed files without a model call", () => {
    const fingerprint = sha256(FIXTURE_PATCH);
    const snapshot: PersonalReviewSnapshot = {
      id: "s", createdAt: 1, repoKey: "r", reviewTarget: "working-tree", diffFingerprint: fingerprint,
      fileFingerprints: fingerprintFiles(FIXTURE_FILES), patch: FIXTURE_PATCH, guide: FIXTURE_GUIDE,
      reviewedSections: [true, true, true], rounds: [],
    };
    const current = FIXTURE_FILES.filter((file) => file.path !== "README.md").map((file) => file.path === "src/server/http.ts" ? { ...file, patch: `${file.patch}\n+changed` } : file);
    current.push({ ...FIXTURE_FILES[0]!, path: "src/new.ts", patch: FIXTURE_FILES[0]!.patch.replaceAll("src/server/http.ts", "src/new.ts") });
    const projected = projectGuide(snapshot, current, "different");
    expect(projected).toMatchObject({ stale: true, changedCount: 1, addedCount: 1, removedCount: 1 });
    expect(projected.sections[0]?.reviewed).toBe(false);
    expect(projected.sections.find((section) => section.id === "updates")?.files[0]?.path).toBe("src/new.ts");
    expect(projected.sections.flatMap((section) => section.files).find((file) => file.path === "README.md")?.status).toBe("removed");
  });
});
