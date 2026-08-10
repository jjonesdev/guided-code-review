import { describe, expect, test } from "bun:test";
import { chmod, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { formatFeedback } from "../src/shared/feedback";
import { FIXTURE_GUIDE, FIXTURE_PATCH } from "../src/shared/fixtures";
import { SnapshotStore } from "../src/server/store";
import type { PersonalReviewRound, PersonalReviewSnapshot } from "../src/shared/types";

const round: PersonalReviewRound = {
  id: "r", createdAt: 1, diffFingerprint: "f", patch: FIXTURE_PATCH, generalFeedback: "Overall note.",
  annotations: [
    { id: "b", filePath: "z.ts", body: "Later", lineStart: 20, createdAt: 2 },
    { id: "a", filePath: "a.ts", body: "Why?", lineStart: 4, lineEnd: 8, conventionalLabel: "question", createdAt: 1 },
    { id: "c", filePath: "a.ts", body: "Cover this", createdAt: 3 },
  ],
};

describe("feedback and persistence", () => {
  test("formats only non-empty active feedback deterministically", () => {
    expect(formatFeedback(round)).toBe("# Guided review feedback\n\n## Overall\n\nOverall note.\n\n## `a.ts`\n\n- File comment: Cover this\n- Lines 4–8 — Question: Why?\n\n## `z.ts`\n\n- Line 20: Later\n");
    expect(formatFeedback({ ...round, annotations: [], generalFeedback: "" })).toBe("# Guided review feedback\n");
  });

  test("writes private atomic snapshots and recovers from corrupt state", async () => {
    const dir = await mkdtemp(join(tmpdir(), "guided-store-test-"));
    const store = new SnapshotStore(dir);
    const key = "a".repeat(32);
    const snapshot: PersonalReviewSnapshot = { id: "s", createdAt: 1, repoKey: key, reviewTarget: "working-tree", diffFingerprint: "f", fileFingerprints: {}, patch: "", guide: FIXTURE_GUIDE, reviewedSections: [], rounds: [round] };
    await store.save(key, snapshot);
    expect(await store.load(key)).toEqual(snapshot);
    expect((await stat(join(dir, `${key}.json`))).mode & 0o777).toBe(0o600);
    await writeFile(join(dir, `${key}.json`), "{bad", { mode: 0o600 });
    expect(await store.load(key)).toBeNull();
    await chmod(dir, 0o700);
  });
});
