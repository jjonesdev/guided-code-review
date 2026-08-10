import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FIXTURE_FILES, FIXTURE_GUIDE, FIXTURE_PATCH } from "../src/shared/fixtures";
import { parseAndValidateGuide } from "../src/shared/guide";
import { LIMITS } from "../src/shared/limits";
import { startServer, type RunningServer } from "../src/server/app";
import type { ProcessRunner } from "../src/server/process";
import { FixtureGuideGenerator, ReviewService } from "../src/server/review-service";
import { SnapshotStore } from "../src/server/store";

describe("bounded inputs and persistence", () => {
  test("rejects generated output beyond the configured limit", () => {
    const oversized = `${JSON.stringify(FIXTURE_GUIDE)}${" ".repeat(LIMITS.guideOutputBytes)}`;
    expect(() => parseAndValidateGuide(oversized, FIXTURE_FILES)).toThrow("guide output exceeds");
  });

  test("rejects snapshots beyond the configured limit", async () => {
    const directory = await mkdtemp(join(tmpdir(), "guided-limit-store-"));
    const snapshot = {
      id: "snapshot",
      createdAt: 1,
      repoKey: "a".repeat(32),
      reviewTarget: "working-tree",
      diffFingerprint: "fingerprint",
      fileFingerprints: {},
      patch: FIXTURE_PATCH,
      guide: FIXTURE_GUIDE,
      reviewedSections: [false, false, false],
      rounds: [{
        id: "round",
        createdAt: 1,
        diffFingerprint: "fingerprint",
        patch: FIXTURE_PATCH,
        annotations: [],
        generalFeedback: "",
      }],
    };
    snapshot.rounds[0]!.generalFeedback = "x".repeat(LIMITS.snapshotBytes);
    await expect(new SnapshotStore(directory).save("a".repeat(32), snapshot)).rejects.toThrow("snapshot exceeds");
  });

  test("rejects oversized API request bodies", async () => {
    const base = await mkdtemp(join(tmpdir(), "guided-limit-server-"));
    await Bun.write(join(base, "dist", "index.html"), "<h1>Guided Review</h1>");
    const runner: ProcessRunner = { async run() { throw new Error("Fixture mode must not launch processes."); } };
    const service = new ReviewService(base, runner, new FixtureGuideGenerator(), new SnapshotStore(join(base, "state")), true);
    await service.initializeFixture();
    const server: RunningServer = await startServer({ service, dist: join(base, "dist"), token: "test-capability" });
    try {
      const response = await fetch(`${server.origin}/api/review`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Origin: server.origin,
          "X-Guided-Review-Token": "test-capability",
        },
        body: JSON.stringify({ generalFeedback: "x".repeat(LIMITS.requestBytes) }),
      });
      expect(response.status).toBe(422);
      expect(await response.json()).toEqual({ error: "Request body is too large." });
    } finally {
      await server.stop();
    }
  });
});
