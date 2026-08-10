import { createHash } from "node:crypto";

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function repositoryKey(root: string, remote = ""): string {
  return sha256(`${root}\0${remote}`).slice(0, 32);
}
