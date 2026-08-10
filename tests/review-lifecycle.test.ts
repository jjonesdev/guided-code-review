import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FIXTURE_GUIDE, FIXTURE_PATCH } from "../src/shared/fixtures";
import { beginUpdatedRound, FixtureGuideGenerator, ReviewService } from "../src/server/review-service";
import { SnapshotStore } from "../src/server/store";
import type { PersonalReviewSnapshot } from "../src/shared/types";
import type { ProcessRunner } from "../src/server/process";

const noProcess: ProcessRunner = { async run() { throw new Error("No process is allowed in fixture lifecycle tests."); } };

describe("review lifecycle", () => {
  test("reopens unchanged reviews without calling the generator", async () => {
    const dir = await mkdtemp(join(tmpdir(), "guided-lifecycle-"));
    const generator = new FixtureGuideGenerator();
    const service = new ReviewService(dir, noProcess, generator, new SnapshotStore(join(dir, "state")), true);
    await service.initializeFixture();
    const first = await service.load();
    const second = await service.load();
    expect(second.snapshot?.id).toBe(first.snapshot?.id);
    expect(generator.calls).toBe(0);
  });

  test("changed rereview preserves previous feedback and starts a clean round", () => {
    const snapshot: PersonalReviewSnapshot = {
      id: "s", createdAt: 1, repoKey: "r", reviewTarget: "working-tree", diffFingerprint: "old",
      fileFingerprints: {}, patch: FIXTURE_PATCH, guide: FIXTURE_GUIDE, reviewedSections: [true],
      rounds: [{ id: "old", createdAt: 1, diffFingerprint: "old", patch: "old patch", annotations: [{ id: "a", filePath: "a.ts", body: "Fix", createdAt: 1 }], generalFeedback: "Previous" }],
    };
    const updated = beginUpdatedRound(snapshot, "new patch", "new");
    expect(updated.rounds).toHaveLength(2);
    expect(updated.rounds[0]?.annotations[0]?.body).toBe("Fix");
    expect(updated.rounds[1]).toMatchObject({ diffFingerprint: "new", patch: "new patch", annotations: [], generalFeedback: "" });
    expect(beginUpdatedRound(updated, "new patch", "new")).toBe(updated);
  });

  test("cancellation aborts the mocked generation and leaves the prior snapshot intact", async () => {
    const dir = await mkdtemp(join(tmpdir(), "guided-cancel-"));
    const generator = new FixtureGuideGenerator();
    const service = new ReviewService(dir, noProcess, generator, new SnapshotStore(join(dir, "state")), true);
    await service.initializeFixture();
    const original = (await service.load()).snapshot?.id;
    const pending = service.generate(true);
    expect(service.cancel()).toBe(true);
    await expect(pending).rejects.toThrow("cancelled");
    expect((await service.load()).snapshot?.id).toBe(original);
    expect(generator.calls).toBe(0);
  });
});
