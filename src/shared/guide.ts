import type { CodeGuideOutput, DiffFile, GuideDiffRef, GuideSection } from "./types";
import { LIMITS, assertByteLimit } from "./limits";

export class GuideValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GuideValidationError";
  }
}

function exactKeys(value: Record<string, unknown>, keys: string[], label: string): void {
  const actual = Object.keys(value).toSorted();
  const expected = keys.toSorted();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new GuideValidationError(`${label} has unsupported fields.`);
  }
}

function nonEmptyString(value: unknown, label: string, max = 20_000): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new GuideValidationError(`${label} must be a non-empty string.`);
  }
  return value;
}

function parseDiffRef(value: unknown, changedPaths: Set<string>, seen: Set<string>): GuideDiffRef {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new GuideValidationError("A guide diff reference is malformed.");
  }
  const record = value as Record<string, unknown>;
  exactKeys(record, ["file", "summary"], "Guide diff reference");
  const file = nonEmptyString(record.file, "Guide file", 4_096);
  if (!changedPaths.has(file)) throw new GuideValidationError(`Guide referenced an unchanged or unknown file: ${file}`);
  if (seen.has(file)) throw new GuideValidationError(`Guide referenced a file more than once: ${file}`);
  seen.add(file);
  return { file, summary: nonEmptyString(record.summary, `Summary for ${file}`) };
}

function parseSection(value: unknown, changedPaths: Set<string>, seen: Set<string>): GuideSection {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new GuideValidationError("A guide section is malformed.");
  }
  const record = value as Record<string, unknown>;
  exactKeys(record, ["title", "overview", "diffs"], "Guide section");
  if (!Array.isArray(record.diffs) || record.diffs.length === 0) {
    throw new GuideValidationError("Every guide section must contain at least one file.");
  }
  return {
    title: nonEmptyString(record.title, "Section title", 500),
    overview: nonEmptyString(record.overview, "Section overview"),
    diffs: record.diffs.map((item) => parseDiffRef(item, changedPaths, seen)),
  };
}

export function parseAndValidateGuide(raw: string, files: DiffFile[]): CodeGuideOutput {
  assertByteLimit(raw, LIMITS.guideOutputBytes, "guide_output");
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new GuideValidationError("Claude returned output that was not valid JSON.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new GuideValidationError("Claude returned a malformed guide.");
  }
  const record = value as Record<string, unknown>;
  exactKeys(record, ["title", "intent", "sections", "unplacedFiles"], "Guide");
  if (!Array.isArray(record.sections) || record.sections.length < 1 || record.sections.length > 10) {
    throw new GuideValidationError("The guide must contain between one and ten sections.");
  }
  if (!Array.isArray(record.unplacedFiles)) throw new GuideValidationError("unplacedFiles must be an array.");
  const changedPaths = new Set(files.map((file) => file.path));
  const seen = new Set<string>();
  const sections = record.sections.map((section) => parseSection(section, changedPaths, seen));
  const unplacedFiles = record.unplacedFiles.map((item) => {
    const file = nonEmptyString(item, "Unplaced file", 4_096);
    if (!changedPaths.has(file)) throw new GuideValidationError(`Guide listed an unknown unplaced file: ${file}`);
    if (seen.has(file)) throw new GuideValidationError(`Guide referenced a file more than once: ${file}`);
    seen.add(file);
    return file;
  });
  const missing = files.map((file) => file.path).filter((path) => !seen.has(path));
  if (missing.length) throw new GuideValidationError(`Guide omitted changed files: ${missing.join(", ")}`);
  return {
    title: nonEmptyString(record.title, "Guide title", 500),
    intent: nonEmptyString(record.intent, "Guide intent", 2_000),
    sections,
    unplacedFiles,
  };
}

export function extractClaudeStructuredOutput(stdout: string): string {
  const trimmed = stdout.trim();
  if (!trimmed) throw new GuideValidationError("Claude returned no guide output.");
  try {
    const envelope = JSON.parse(trimmed) as Record<string, unknown>;
    const structured = envelope.structured_output ?? envelope.structuredOutput;
    if (structured && typeof structured === "object") return JSON.stringify(structured);
    if (typeof envelope.result === "string") return envelope.result;
  } catch {
    // The parser below reports a stable validation error for non-JSON output.
  }
  return trimmed;
}
