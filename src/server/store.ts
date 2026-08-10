import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { LIMITS, assertByteLimit } from "../shared/limits";
import type { PersonalReviewSnapshot } from "../shared/types";

export function defaultDataDirectory(): string {
  return join(process.env.XDG_STATE_HOME || join(homedir(), ".local", "state"), "guided-code-review");
}

export class SnapshotStore {
  constructor(private readonly directory = defaultDataDirectory()) {}

  private path(key: string): string {
    if (!/^[a-f0-9]{32}$/.test(key)) throw new Error("Invalid repository key.");
    return join(this.directory, `${key}.json`);
  }

  async load(key: string): Promise<PersonalReviewSnapshot | null> {
    try {
      const raw = await readFile(this.path(key), "utf8");
      assertByteLimit(raw, LIMITS.snapshotBytes, "snapshot");
      const value = JSON.parse(raw) as PersonalReviewSnapshot;
      if (!value || typeof value !== "object" || !Array.isArray(value.rounds) || !value.guide) return null;
      return value;
    } catch {
      return null;
    }
  }

  async save(key: string, value: PersonalReviewSnapshot): Promise<void> {
    const raw = JSON.stringify(value, null, 2);
    assertByteLimit(raw, LIMITS.snapshotBytes, "snapshot");
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const target = this.path(key);
    const temporary = `${target}.${crypto.randomUUID()}.tmp`;
    await writeFile(temporary, raw, { mode: 0o600 });
    await rename(temporary, target);
    await chmod(target, 0o600);
  }
}
