# Guided Code Review Agent Instructions

## Product boundary

- `GUIDED_REVIEW_MVP_PRD.md` is the product specification. Build the smallest
  standalone personal tool that satisfies it; do not add deferred features.
- Plannotator is read-only reference material. Copy only its exact Guided Review
  organizer prompt, supported dynamic prompt text, and structured-output schema.
- Do not modify, execute, import, or contact Plannotator. Do not copy its launcher,
  validator, skill, server, runtime types, or React components.
- Implement a new minimal UI inspired by Plannotator's high-level chaptered layout.
- Preserve `THIRD_PARTY_NOTICES.md` with the copied prompt assets.

## Claude Code usage budget

- Treat real Claude Code guide-generation calls as scarce. The user has limited plan
  usage and does not want development or tests to consume it unnecessarily.
- Normal development, `bun test`, and `bun run verify` must never launch Claude. Use
  deterministic guide fixtures and a mocked process adapter.
- Keep any real integration smoke test behind a separate explicit opt-in command or
  environment flag. It must not run as part of setup, startup, watch mode, or CI.
- During the initial build, make at most one real guide-generation call, only after all
  fixture-based tests and the Browser workflow pass. Use the smallest useful synthetic
  diff. Never retry it automatically; report a failure and continue with other work.
- Version and authentication-status checks that do not invoke a model are fine.
- In the product, only an explicit `Generate guide` or `Regenerate guide` user action
  may launch Claude. Opening, resuming, rereviewing, testing, and copying feedback must
  remain model-free.

## Working expectations

- Build a functioning end-to-end vertical slice before polishing secondary states.
- Use the in-app Browser to test the real localhost UI and its primary interaction
  flow. Automated checks alone are not enough for the rendered interface.
- Keep one deterministic verification command, `bun run verify`, once project scripts
  exist.
- Make recoverable Git commits at working milestones. Do not commit broken states.
- If an external approval or authentication issue blocks one check, continue all
  independent work and record the exact remaining blocker.
