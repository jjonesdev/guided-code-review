import type { CodeGuideOutput, DiffFile } from "./types";
import { parseUnifiedDiff } from "./diff";

export const FIXTURE_PATCH = `diff --git a/src/server/http.ts b/src/server/http.ts
index 3c21a11..7b9c220 100644
--- a/src/server/http.ts
+++ b/src/server/http.ts
@@ -23,7 +23,9 @@ import { parse } from "url";
-const host = process.env.HOST ?? "0.0.0.0";
-const port = Number(process.env.PORT ?? 45454);
+// Bind only to loopback to enforce a local trust boundary.
+const host = "127.0.0.1";
+const port = 0;
 const server = Bun.serve({ host, port, fetch: handleRequest });
diff --git a/src/server/session.ts b/src/server/session.ts
new file mode 100644
index 0000000..f461abc
--- /dev/null
+++ b/src/server/session.ts
@@ -0,0 +1,8 @@
+import { randomBytes, timingSafeEqual } from "node:crypto";
+
+export function createSessionToken(): string {
+  return randomBytes(24).toString("base64url");
+}
+
+export function verifySessionToken(expected: string, actual: string): boolean {
+  return timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
+}
diff --git a/src/shared/store.ts b/src/shared/store.ts
index 5400aaa..8282bbb 100644
--- a/src/shared/store.ts
+++ b/src/shared/store.ts
@@ -14,6 +14,10 @@ export async function saveReview(path: string, value: Review): Promise<void> {
-  await writeFile(path, JSON.stringify(value));
+  const temporaryPath = \`${"${path}"}.tmp\`;
+  await writeFile(temporaryPath, JSON.stringify(value), { mode: 0o600 });
+  await rename(temporaryPath, path);
+  await chmod(path, 0o600);
 }
diff --git a/src/shared/feedback.ts b/src/shared/feedback.ts
new file mode 100644
index 0000000..55fe123
--- /dev/null
+++ b/src/shared/feedback.ts
@@ -0,0 +1,5 @@
+export function formatFeedback(items: string[]): string {
+  return ["# Guided review feedback", ...items]
+    .filter(Boolean)
+    .join("\\n\\n");
+}
diff --git a/README.md b/README.md
index 1fc0111..fca8222 100644
--- a/README.md
+++ b/README.md
@@ -4,3 +4,5 @@ Run the local review tool from a Git repository.
+The server prints a loopback URL containing a short-lived capability in the fragment.
+Only explicit guide generation invokes Claude Code.
`;

export const FIXTURE_FILES: DiffFile[] = parseUnifiedDiff(FIXTURE_PATCH);

export const FIXTURE_GUIDE: CodeGuideOutput = {
  title: "Secure local review sessions",
  intent: "Adds a capability-protected loopback server and a focused review workspace so local diffs can be reviewed without exposing repository access.",
  sections: [
    {
      title: "The local trust boundary",
      overview: "The local HTTP entry point is now limited to loopback and each run owns an in-memory capability. **This is the part worth slowing down for:** every browser operation depends on this boundary failing closed.",
      diffs: [
        { file: "src/server/http.ts", summary: "Pins the listener to IPv4 loopback and lets the operating system choose an available port." },
        { file: "src/server/session.ts", summary: "Creates and verifies the per-run capability used by authenticated browser requests." },
      ],
    },
    {
      title: "Review state and persistence",
      overview: "Review snapshots move from direct writes to an atomic replacement. A crash can no longer leave the only saved copy partially serialized.",
      diffs: [
        { file: "src/shared/store.ts", summary: "Writes a private temporary snapshot and atomically renames it into place." },
      ],
    },
    {
      title: "Feedback handoff",
      overview: "Feedback formatting is deterministic and the README makes the model-use boundary visible. Together these changes keep handoff manual and predictable.",
      diffs: [
        { file: "src/shared/feedback.ts", summary: "Builds the clipboard-ready Markdown payload in a stable order." },
        { file: "README.md", summary: "Documents capability URLs and explicit-only guide generation." },
      ],
    },
  ],
  unplacedFiles: [],
};
