import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildClaudeArgv } from "../src/server/claude";
import { gitDiffArgv, gitUntrackedDiffArgv, loadGitReview, resolveReviewPath } from "../src/server/git";
import { createCapabilityToken, verifyCapabilityToken } from "../src/server/security";
import type { ProcessRunner } from "../src/server/process";

describe("fixed commands and boundaries", () => {
  test("constructs fixed argv without a shell or browser-controlled executable", () => {
    expect(gitDiffArgv()).toEqual(["git", "diff", "HEAD", "--no-ext-diff", "--no-textconv", "--unified=80", "--"]);
    expect(gitUntrackedDiffArgv("$(touch pwned)")).toEqual(["git", "diff", "--no-index", "--no-ext-diff", "--unified=80", "--", "/dev/null", "$(touch pwned)"]);
    const claude = buildClaudeArgv("malicious; rm -rf x");
    expect(claude[0]).toBe("claude");
    expect(claude).not.toContain("sh");
    expect(claude.at(-1)).toBe("malicious; rm -rf x");
  });

  test("loads tracked and untracked diffs with a mocked process adapter", async () => {
    const calls: readonly string[][] = [];
    const runner: ProcessRunner = { async run(argv) {
      (calls as string[][]).push([...argv]);
      const op = argv.slice(0, 3).join(" ");
      if (op === "git diff HEAD") return { stdout: "diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -1 +1 @@\n-a\n+b\n", stderr: "", exitCode: 0 };
      if (op === "git ls-files --others") return { stdout: "new.ts\0", stderr: "", exitCode: 0 };
      if (op === "git rev-parse HEAD") return { stdout: "abc\n", stderr: "", exitCode: 0 };
      if (op === "git config --get") return { stdout: "origin\n", stderr: "", exitCode: 0 };
      return { stdout: "diff --git a/new.ts b/new.ts\nnew file mode 100644\n--- /dev/null\n+++ b/new.ts\n@@ -0,0 +1 @@\n+new\n", stderr: "", exitCode: 1 };
    }};
    const review = await loadGitReview("/repo", runner);
    expect(review.files.map((file) => file.path)).toEqual(["a.ts", "new.ts"]);
    expect(calls.some((argv) => argv.includes("new.ts"))).toBe(true);
  });

  test("rejects traversal, absolute paths, and symlink escape", async () => {
    const root = await mkdtemp(join(tmpdir(), "guided-path-root-"));
    const outside = await mkdtemp(join(tmpdir(), "guided-path-outside-"));
    await writeFile(join(root, "ok.ts"), "ok");
    await writeFile(join(outside, "secret.ts"), "secret");
    await symlink(join(outside, "secret.ts"), join(root, "link.ts"));
    expect(await resolveReviewPath(root, "ok.ts")).toEndWith("/ok.ts");
    await expect(resolveReviewPath(root, "../secret.ts")).rejects.toThrow("escapes");
    await expect(resolveReviewPath(root, join(outside, "secret.ts"))).rejects.toThrow("Invalid");
    await expect(resolveReviewPath(root, "link.ts")).rejects.toThrow("symlink");
    await mkdir(join(root, "nested"));
  });

  test("uses unpredictable capabilities and constant-time value checks", () => {
    const first = createCapabilityToken();
    const second = createCapabilityToken();
    expect(first).not.toBe(second);
    expect(verifyCapabilityToken(first, first)).toBe(true);
    expect(verifyCapabilityToken(first, second)).toBe(false);
    expect(verifyCapabilityToken(first, null)).toBe(false);
  });
});
