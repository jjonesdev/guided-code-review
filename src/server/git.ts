import { realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { LIMITS, assertByteLimit } from "../shared/limits";
import { parseUnifiedDiff } from "../shared/diff";
import type { DiffFile } from "../shared/types";
import type { ProcessRunner } from "./process";

const GIT_TIMEOUT = 30_000;

export interface GitReview {
  root: string;
  headSha?: string;
  remote: string;
  patch: string;
  files: DiffFile[];
}

export function gitDiffArgv(): readonly string[] {
  return ["git", "diff", "HEAD", "--no-ext-diff", "--no-textconv", "--unified=80", "--"];
}

export function gitUntrackedArgv(): readonly string[] {
  return ["git", "ls-files", "--others", "--exclude-standard", "-z"];
}

export function gitUntrackedDiffArgv(path: string): readonly string[] {
  return ["git", "diff", "--no-index", "--no-ext-diff", "--unified=80", "--", "/dev/null", path];
}

async function runChecked(runner: ProcessRunner, argv: readonly string[], cwd: string, allowed = [0]): Promise<string> {
  const result = await runner.run(argv, { cwd, timeoutMs: GIT_TIMEOUT });
  if (!allowed.includes(result.exitCode)) throw new Error(`Git could not load this review (${argv[1]} exited ${result.exitCode}).`);
  return result.stdout;
}

export async function canonicalRepositoryRoot(input: string, runner: ProcessRunner): Promise<string> {
  const candidate = await realpath(resolve(input));
  const result = await runner.run(["git", "rev-parse", "--show-toplevel"], { cwd: candidate, timeoutMs: GIT_TIMEOUT });
  if (result.exitCode !== 0) throw new Error("Run Guided Review from inside a Git repository.");
  return realpath(result.stdout.trim());
}

export async function resolveReviewPath(root: string, requestedPath: string): Promise<string> {
  if (!requestedPath || isAbsolute(requestedPath) || requestedPath.includes("\0")) throw new Error("Invalid review file path.");
  const canonicalRoot = await realpath(root);
  const candidate = resolve(canonicalRoot, requestedPath);
  const rel = relative(canonicalRoot, candidate);
  if (rel.startsWith("..") || isAbsolute(rel)) throw new Error("Review file path escapes the repository.");
  const resolved = await realpath(candidate);
  const resolvedRel = relative(canonicalRoot, resolved);
  if (resolvedRel.startsWith("..") || isAbsolute(resolvedRel)) throw new Error("Review file path escapes through a symlink.");
  return resolved;
}

export async function loadGitReview(root: string, runner: ProcessRunner): Promise<GitReview> {
  const [patch, untrackedRaw, headRaw, remoteRaw] = await Promise.all([
    runChecked(runner, gitDiffArgv(), root),
    runChecked(runner, gitUntrackedArgv(), root),
    runChecked(runner, ["git", "rev-parse", "HEAD"], root).catch(() => ""),
    runChecked(runner, ["git", "config", "--get", "remote.origin.url"], root).catch(() => ""),
  ]);
  const untracked = untrackedRaw.split("\0").filter(Boolean).toSorted();
  const additions: string[] = [];
  for (const path of untracked) {
    const output = await runChecked(runner, gitUntrackedDiffArgv(path), root, [0, 1]);
    additions.push(output.replaceAll(`b/${path}`, `b/${path}`).replace(`diff --git a/${path} b/${path}`, `diff --git a/${path} b/${path}`));
  }
  const canonicalPatch = [patch.trimEnd(), ...additions.map((value) => value.trimEnd())].filter(Boolean).join("\n") + (patch || additions.length ? "\n" : "");
  assertByteLimit(canonicalPatch, LIMITS.patchBytes, "patch");
  return { root, headSha: headRaw.trim() || undefined, remote: remoteRaw.trim(), patch: canonicalPatch, files: parseUnifiedDiff(canonicalPatch) };
}
