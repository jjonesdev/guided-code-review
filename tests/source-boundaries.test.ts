import { describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

async function files(root: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) result.push(...await files(path)); else result.push(path);
  }
  return result;
}

describe("standalone source boundaries", () => {
  test("only the DiffViewer adapter imports Pierre and no source depends on Plannotator", async () => {
    const sourceFiles = (await files(join(process.cwd(), "src"))).filter((path) => /\.(ts|tsx)$/.test(path));
    const pierreImports: string[] = [];
    for (const path of sourceFiles) {
      const source = await readFile(path, "utf8");
      if (source.includes("@pierre/diffs")) pierreImports.push(path);
      expect(source).not.toContain("../plannotator");
      expect(source).not.toContain("@plannotator/");
    }
    expect(pierreImports.map((path) => path.slice(process.cwd().length + 1))).toEqual(["src/ui/components/DiffViewer.tsx"]);
  });
});
