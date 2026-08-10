import { GUIDE_REVIEW_PROMPT, GUIDE_SCHEMA_JSON, buildGuideUserMessage } from "../shared/prompt-assets";
import { extractClaudeStructuredOutput, parseAndValidateGuide } from "../shared/guide";
import { LIMITS } from "../shared/limits";
import type { CodeGuideOutput, DiffFile } from "../shared/types";
import type { ProcessRunner } from "./process";

export interface GuideGenerator {
  generate(input: { root: string; patch: string; files: DiffFile[]; signal?: AbortSignal }): Promise<CodeGuideOutput>;
}

export function buildClaudeArgv(userMessage: string): readonly string[] {
  return [
    "claude",
    "-p",
    "--output-format", "json",
    "--json-schema", GUIDE_SCHEMA_JSON,
    "--system-prompt", GUIDE_REVIEW_PROMPT,
    "--tools", "",
    "--permission-mode", "dontAsk",
    userMessage,
  ];
}

export class ClaudeGuideGenerator implements GuideGenerator {
  constructor(private readonly runner: ProcessRunner) {}

  async generate(input: { root: string; patch: string; files: DiffFile[]; signal?: AbortSignal }): Promise<CodeGuideOutput> {
    const message = buildGuideUserMessage(input.patch, input.files.map(({ path, additions, deletions }) => ({ path, additions, deletions })));
    const result = await this.runner.run(buildClaudeArgv(message), {
      cwd: input.root,
      signal: input.signal,
      timeoutMs: LIMITS.processTimeoutMs,
    });
    if (result.exitCode !== 0) throw new Error(`Claude Code could not generate the walkthrough (exit ${result.exitCode}).`);
    return parseAndValidateGuide(extractClaudeStructuredOutput(result.stdout), input.files);
  }
}
