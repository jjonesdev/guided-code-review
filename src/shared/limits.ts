export const LIMITS = {
  requestBytes: 64 * 1024,
  patchBytes: 5 * 1024 * 1024,
  guideOutputBytes: 1 * 1024 * 1024,
  snapshotBytes: 12 * 1024 * 1024,
  processTimeoutMs: 120_000,
} as const;

export class LimitError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "LimitError";
  }
}

export function assertByteLimit(value: string, limit: number, code: string): void {
  if (new TextEncoder().encode(value).byteLength > limit) {
    throw new LimitError(code, `${code.replaceAll("_", " ")} exceeds the supported size.`);
  }
}
