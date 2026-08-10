import type { DiffFile, DiffLine, FileChangeKind } from "./types";

const FILE_START = /^diff --git a\/(.+) b\/(.+)$/;
const HUNK = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

function unquoteGitPath(path: string): string {
  if (!path.startsWith('"')) return path;
  try {
    return JSON.parse(path) as string;
  } catch {
    return path.slice(1, -1);
  }
}

function parseLines(patch: string): DiffLine[] {
  const result: DiffLine[] = [];
  let oldLine = 0;
  let newLine = 0;
  let inHunk = false;
  for (const text of patch.split("\n")) {
    const header = text.match(HUNK);
    if (header) {
      oldLine = Number(header[1]);
      newLine = Number(header[2]);
      inHunk = true;
      result.push({ kind: "meta", text });
      continue;
    }
    if (!inHunk) continue;
    if (text.startsWith("+") && !text.startsWith("+++")) {
      result.push({ kind: "addition", text: text.slice(1), newLine });
      newLine += 1;
    } else if (text.startsWith("-") && !text.startsWith("---")) {
      result.push({ kind: "deletion", text: text.slice(1), oldLine });
      oldLine += 1;
    } else if (text.startsWith(" ")) {
      result.push({ kind: "context", text: text.slice(1), oldLine, newLine });
      oldLine += 1;
      newLine += 1;
    } else if (text.startsWith("\\ No newline")) {
      result.push({ kind: "meta", text });
    }
  }
  return result;
}

function parseFile(block: string): DiffFile | null {
  const firstLine = block.slice(0, block.indexOf("\n"));
  const match = firstLine.match(FILE_START);
  if (!match) return null;
  let oldPath = unquoteGitPath(match[1]);
  let path = unquoteGitPath(match[2]);
  let changeKind: FileChangeKind = "modified";
  if (/^new file mode /m.test(block)) changeKind = "added";
  if (/^deleted file mode /m.test(block)) changeKind = "deleted";
  const renameFrom = block.match(/^rename from (.+)$/m)?.[1];
  const renameTo = block.match(/^rename to (.+)$/m)?.[1];
  if (renameFrom && renameTo) {
    changeKind = "renamed";
    oldPath = unquoteGitPath(renameFrom);
    path = unquoteGitPath(renameTo);
  }
  if (changeKind === "deleted") path = oldPath;
  const lines = parseLines(block);
  return {
    path,
    oldPath: oldPath === path ? undefined : oldPath,
    patch: block.endsWith("\n") ? block : `${block}\n`,
    additions: lines.filter((line) => line.kind === "addition").length,
    deletions: lines.filter((line) => line.kind === "deletion").length,
    changeKind,
    lines,
  };
}

export function parseUnifiedDiff(patch: string): DiffFile[] {
  if (!patch.trim()) return [];
  const starts: number[] = [];
  const pattern = /^diff --git /gm;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(patch))) starts.push(match.index);
  return starts.flatMap((start, index) => {
    const file = parseFile(patch.slice(start, starts[index + 1] ?? patch.length));
    return file ? [file] : [];
  });
}
