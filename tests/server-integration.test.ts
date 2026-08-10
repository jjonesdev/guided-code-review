import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServer, type RunningServer } from "../src/server/app";
import { FixtureGuideGenerator, ReviewService } from "../src/server/review-service";
import { SnapshotStore } from "../src/server/store";
import type { ProcessRunner } from "../src/server/process";

const running: RunningServer[] = [];
afterEach(async () => { await Promise.all(running.splice(0).map((server) => server.stop())); });

async function setup() {
  const base = await mkdtemp(join(tmpdir(), "guided-server-test-"));
  const dist = join(base, "dist");
  await Bun.write(join(dist, "index.html"), "<h1>Guided Review</h1>");
  const runner: ProcessRunner = { async run() { throw new Error("Fixture mode must not launch processes."); } };
  const generator = new FixtureGuideGenerator();
  const service = new ReviewService(base, runner, generator, new SnapshotStore(join(base, "state")), true);
  await service.initializeFixture();
  const server = await startServer({ service, dist, token: "test-capability" });
  running.push(server);
  return { server, service, generator };
}

describe("loopback API", () => {
  test("advertises loopback and requires capability, host, origin, route, and method checks", async () => {
    const { server } = await setup();
    expect(server.origin).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(server.url).toBe(`${server.origin}/#test-capability`);
    expect((await fetch(`${server.origin}/api/review`)).status).toBe(401);
    expect((await fetch(`${server.origin}/api/review`, { headers: { "X-Guided-Review-Token": "wrong" } })).status).toBe(401);
    expect((await fetch(`${server.origin}/api/review`, { headers: { "X-Guided-Review-Token": "test-capability", Host: "evil.test" } })).status).toBe(403);
    const goodHeaders = { "X-Guided-Review-Token": "test-capability" };
    expect((await fetch(`${server.origin}/api/review`, { headers: goodHeaders })).status).toBe(200);
    expect((await fetch(`${server.origin}/api/unknown`, { headers: goodHeaders })).status).toBe(404);
    expect((await fetch(`${server.origin}/api/review`, { method: "POST", headers: { ...goodHeaders, Origin: server.origin, "Content-Type": "application/json" }, body: "{}" })).status).toBe(405);
    expect((await fetch(`${server.origin}/api/cancel`, { method: "POST", headers: { ...goodHeaders, Origin: "http://evil.test", "Content-Type": "application/json" }, body: "{}" })).status).toBe(403);
  });

  test("resumes, updates, copies, and regenerates only on explicit request", async () => {
    const { server, generator } = await setup();
    const headers = { "X-Guided-Review-Token": "test-capability" };
    const original = await (await fetch(`${server.origin}/api/review`, { headers })).json();
    expect(original.snapshot.guide.title).toBe("Secure local review sessions");
    expect(generator.calls).toBe(0);
    const annotation = { id: "a", filePath: "src/server/http.ts", body: "Why?", lineStart: 26, conventionalLabel: "question", createdAt: 1 };
    const updated = await fetch(`${server.origin}/api/review`, { method: "PATCH", headers: { ...headers, Origin: server.origin, "Content-Type": "application/json" }, body: JSON.stringify({ annotations: [annotation], generalFeedback: "Overall" }) });
    expect(updated.status).toBe(200);
    expect(generator.calls).toBe(0);
    const feedback = await (await fetch(`${server.origin}/api/feedback`, { headers })).json();
    expect(feedback.markdown).toContain("Question: Why?");
    const generated = await fetch(`${server.origin}/api/generate`, { method: "POST", headers: { ...headers, Origin: server.origin, "Content-Type": "application/json" }, body: JSON.stringify({ regenerate: true }) });
    expect(generated.status).toBe(200);
    expect(generator.calls).toBe(1);
  });
});
