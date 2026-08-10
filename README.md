# Guided Code Review

A standalone personal tool for reviewing the current diff in a local Git
repository. It keeps the canonical diff in charge, optionally asks the locally
authenticated Claude Code CLI to organize that diff into chapters, saves review
rounds on disk, and copies feedback as deterministic Markdown.

There are no accounts, API keys, hooks, hosted services, or automatic feedback
delivery. Plannotator supplied the verbatim organizer prompt assets only; it is
not a runtime, build, or test dependency.

## Setup

Requirements:

- Bun 1.3 or newer
- Git
- Claude Code on `PATH`, already authenticated, for real guide generation

Install once from this repository:

```sh
bun install
```

## Review a repository

From this project, pass the repository to review:

```sh
bun run review -- /absolute/path/to/repository
```

To launch while your shell is already inside the repository being reviewed:

```sh
bun --cwd /absolute/path/to/guided-code-review run review -- "$PWD"
```

The command builds the browser app, loads tracked changes against `HEAD` plus
untracked files, binds an ephemeral port on `127.0.0.1`, and prints a URL. Open
the complete printed URL, including its fragment. That fragment contains the
short-lived capability for this server run; the app removes it from the visible
URL and never persists it.

The normal diff workspace opens first. Choose **Guided Review**, then:

1. Select **Generate guide** if this diff has no saved walkthrough.
2. Read chapters in order and use file chips to jump within a chapter.
3. Select line numbers in a diff to add a comment or question. Use **Comment on
   file** for a file-level note.
4. Mark finished chapters reviewed; they collapse without losing state.
5. Add optional overall feedback and select **Copy feedback**.
6. Paste the Markdown into the author's agent session yourself.

Clipboard failure leaves the exact Markdown in a selectable fallback field.
Only the active round is copied; prior rounds stay read-only under **Previous
feedback**.

## Rereview and token use

Opening, resuming, detecting changes, reviewing updates, saving annotations,
and copying feedback make no model calls. If the diff changed, the existing
guide is projected onto the new canonical diff locally:

- changed chapters reopen;
- added files appear in **Updates since last review**;
- removed references show **No longer present**;
- previous feedback remains attached to its saved patch;
- the current round starts empty.

Only the explicit **Generate guide** and **Regenerate guide** actions launch
Claude Code. Regeneration is never automatic.

Review snapshots are private JSON files under
`$XDG_STATE_HOME/guided-code-review` or, by default,
`~/.local/state/guided-code-review`. Writes use a private temporary file and an
atomic rename. Corrupt state is ignored so a fresh review can still open.

## Development and verification

Run the deterministic fixture application, which never invokes Claude:

```sh
bun run dev
```

Fixture-only state URLs are available for UI verification:

```text
?fixtureState=empty
?fixtureState=generating
?fixtureState=ready
?fixtureState=stale
?fixtureState=failed
?fixtureState=ready&clipboard=fail
```

Run every normal automated check with one command:

```sh
bun run verify
```

`bun test` and `bun run verify` use deterministic guides and a mocked process
adapter. They cannot launch Claude. The one real integration smoke command is
separately gated and is never part of setup, startup, watch mode, tests, or CI:

```sh
GUIDED_REVIEW_REAL_CLAUDE_SMOKE=1 bun run smoke:claude
```

That command spends real Claude plan usage. Run it intentionally and at most
once when validating a new installation.

## Troubleshooting

- **“Run Guided Review from inside a Git repository.”** Pass a valid repository
  path or launch with `"$PWD"` from one.
- **No local changes.** The review target is the working tree relative to
  `HEAD`, including untracked files. Create or retain a diff before generating.
- **Capability missing or invalid.** Reopen the complete URL printed by the
  currently running command. A capability is new for every server run and a
  plain reload cannot reconstruct a removed fragment.
- **Claude generation failed.** Confirm `claude --version` works and that Claude
  Code is authenticated. Nothing retries automatically; use **Retry** when
  ready.
- **Clipboard blocked.** Use the displayed manual-copy field; the Markdown is
  identical to the requested clipboard payload.
- **Saved state is unreadable.** The app opens a fresh review instead of using
  corrupt JSON. The problematic file can be inspected under the state directory
  without touching repository files.

## Security boundary

The server listens only on IPv4 loopback and accepts a fixed route/method
allowlist. Every API request requires the in-memory capability. State-changing
requests also require the server's exact origin; unexpected hosts fail closed.
The browser cannot choose executables, arguments, working directories, or file
paths. Git and Claude use fixed argument arrays without a shell. Guide Markdown
and persisted text are treated as untrusted and sanitized before rendering.

The copied Plannotator asset provenance and MIT notice are in
[`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md).
