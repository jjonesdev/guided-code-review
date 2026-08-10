import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BunProcessRunner } from "./process";
import { ClaudeGuideGenerator } from "./claude";
import { parseUnifiedDiff } from "../shared/diff";

if (process.env.GUIDED_REVIEW_REAL_CLAUDE_SMOKE !== "1") {
  throw new Error("Set GUIDED_REVIEW_REAL_CLAUDE_SMOKE=1 to permit the single opt-in Claude smoke call.");
}
const root = await mkdtemp(join(tmpdir(), "guided-review-claude-smoke-"));
await mkdir(join(root, "src"));
await writeFile(join(root, "src", "value.ts"), "export const value = 2;\n");
const patch = `diff --git a/src/value.ts b/src/value.ts\nindex 1..2 100644\n--- a/src/value.ts\n+++ b/src/value.ts\n@@ -1 +1 @@\n-export const value = 1;\n+export const value = 2;\n`;
const guide = await new ClaudeGuideGenerator(new BunProcessRunner()).generate({ root, patch, files: parseUnifiedDiff(patch) });
console.log(JSON.stringify({ title: guide.title, sections: guide.sections.length }));
