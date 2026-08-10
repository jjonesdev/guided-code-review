import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { BunProcessRunner } from "./process";
import { canonicalRepositoryRoot } from "./git";
import { ClaudeGuideGenerator } from "./claude";
import { FixtureGuideGenerator, ReviewService } from "./review-service";
import { SnapshotStore } from "./store";
import { startServer } from "./app";

const fixture = process.argv.includes("--fixture");
const argument = process.argv.slice(2).find((value) => !value.startsWith("--"));
const runner = new BunProcessRunner();
const root = fixture ? resolve(process.cwd()) : await canonicalRepositoryRoot(argument ?? process.cwd(), runner);
const fixtureDirectory = fixture ? await mkdtemp(join(tmpdir(), "guided-review-fixture-")) : undefined;
const store = new SnapshotStore(fixtureDirectory);
const generator = fixture ? new FixtureGuideGenerator() : new ClaudeGuideGenerator(runner);
const service = new ReviewService(root, runner, generator, store, fixture);
await service.initializeFixture();
const running = await startServer({ service, dist: resolve(import.meta.dir, "../../dist") });

console.log(`Guided Review is ready for ${root}`);
console.log(`Open ${running.url}`);
console.log("Press Ctrl+C to stop.");

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  service.cancel();
  await running.stop();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
