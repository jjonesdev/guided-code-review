# Remaining external validation

The optional one-call Claude Code smoke check was not run on 2026-08-09 because
`claude auth status` reported `loggedIn: false` and `authMethod: none` for Claude
Code 2.1.226.

Everything that does not require model usage is verified by `bun run verify`, the
mocked process adapter, fixed-argv tests, and the in-app Browser workflow. After
signing Claude Code in, the remaining check is intentionally explicit and limited
to one synthetic diff:

```sh
GUIDED_REVIEW_REAL_CLAUDE_SMOKE=1 bun run smoke:claude
```

Do not add this command to setup, startup, watch mode, `bun run verify`, or CI.
