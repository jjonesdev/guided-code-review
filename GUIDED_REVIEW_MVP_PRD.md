# PRD: Personal Guided Code Review MVP

Date: 2026-08-09
Status: Draft
Audience: Single-user, local development

## Summary

Build a minimal guided code-review experience for one user working with Claude Code.
The product organizes the current code diff into a chaptered walkthrough, renders the
real diff beside concise explanatory prose, lets the user annotate lines and files,
and copies the current review round's feedback as Markdown for manual pasting into the
author's agent session.

The MVP intentionally has no account system, API keys, hooks, automatic feedback
delivery, live AI chat, collaboration, or hosted service. Claude Code is the only guide
generation engine. The repository copies Plannotator's Guided Review organizer prompt
and dynamic changeset prompt exactly as written, then uses them inside its own standalone
Claude Code integration. The UI is a new, simplified implementation inspired by
Plannotator's high-level Guided Review layout. Rereviews reuse the existing guide locally
and cost no model tokens unless the user explicitly regenerates it.

## Problem

Large agent-authored diffs are difficult to review in repository or filename order.
The reviewer needs a coherent reading sequence that starts with the implementation
heart, explains why the change exists, and keeps low-signal wiring from interrupting
the main story.

The reviewer also needs to retain ordinary code-review behavior:

- inspect the complete diff;
- add line, file, and general comments;
- ask questions as annotations;
- revisit the change after the author responds;
- copy feedback into the author's agent session.

Existing tools often add provider configuration, live chat, hooks, synchronization,
and review-thread state before proving the core walkthrough is useful. This personal
MVP should validate the reading experience first.

## Product principle

The guide controls reading order and explanation. The product's local diff viewer controls
the code, selection, annotations, and navigation.

Generated prose must never replace, summarize away, or become the source of truth for
the diff. Every guide file reference resolves back to the canonical current diff.

## User

The only intended user is the product owner:

- works locally;
- uses Claude Code;
- does not have or want to configure API keys;
- does not have Claude Code hooks;
- is comfortable copying Markdown and pasting it into an agent session;
- prefers low token use over automatic guide regeneration;
- accepts a minimal, functional interface.

## Goals

1. Make a large changeset understandable in one ordered walkthrough.
2. Show the complete, real diff inside that walkthrough.
3. Support line comments, file comments, general feedback, and question annotations.
4. Produce one clean Markdown payload through a `Copy feedback` button.
5. Preserve review state locally across reopening the tool.
6. Make rereview useful without automatically spending more Claude tokens.
7. Copy Plannotator's proven prompts verbatim and use its UI only as layout inspiration,
   without depending on Plannotator at runtime.

## Non-goals

The MVP will not include:

- live Ask AI inside the browser;
- automatic answers to question annotations;
- API keys or direct Anthropic API calls;
- automatic delivery into Claude Code or another agent session;
- Claude Code hooks;
- multiple AI providers or model pickers;
- hosted accounts, teams, sharing, or permissions;
- pull-request comment publishing;
- automatic comment resolution or old-line re-anchoring;
- automatic guide regeneration;
- incremental AI guide editing;
- staging, committing, or mutating repository files;
- elaborate animations, branding, or responsive polish beyond basic usability;
- hunk-level placement of one file into multiple guide chapters;
- a database, cloud persistence, or background synchronization;
- Electron or another desktop application wrapper;
- server-side rendering or a full-stack web framework such as Next.js;
- Redux or another external global state-management library;
- client-side routing beyond the review workspace's local view state;
- WebSockets or streaming infrastructure beyond what guide-generation progress
  demonstrably requires.

## Plannotator reference boundary

The sibling checkout at `../plannotator` is read-only reference material during
implementation. It is not a library, runtime service, command, plugin, or installation
dependency of this product.

### Copy exactly

Copy these prompt assets from
`../plannotator/packages/server/guide/guide-review.ts` into this repository:

- `GUIDE_REVIEW_PROMPT`, the static Guided Review organizer prompt;
- the human-readable dynamic changeset prompt produced by `buildGuideUserMessage` for
  the diff contexts supported by this MVP; and
- `GUIDE_SCHEMA_JSON`, unchanged, so Claude's structured response matches the prompt's
  expected output shape.

The organizer prompt and supported dynamic prompt text must remain verbatim. Do not
paraphrase, shorten, improve, or independently recreate them. Record the Plannotator
source path and Git revision alongside the copied assets. Keep one checked-in copy as
the product source of truth and test its exact text so application code cannot mutate
or reconstruct it accidentally.

Preserve `THIRD_PARTY_NOTICES.md` with the copied prompt assets. It contains
Plannotator's copyright notice and full MIT license text and clearly limits that notice
to the copied Plannotator material; it does not license this repository's original
code.

### Reference only

Everything else is inspiration or comparison material only:

- do not import from `../plannotator` at runtime or in the normal build/test path;
- do not execute the `plannotator` binary, start a Plannotator server, or call a
  Plannotator endpoint;
- do not copy or use `buildGuideClaudeCommand`; implement a small standalone Claude
  Code launcher owned by this repository;
- do not copy or use Plannotator's validator or shared runtime types; define local
  types from the copied schema and implement the minimum fail-closed validation the
  MVP requires;
- do not copy or install the `plannotator-review` skill; the MVP is opened through its
  own local command; and
- do not copy Plannotator React components. Inspect its Guided Review screens to
  understand the layout, then implement a smaller local UI.

After the prompt assets have been copied, the product must build, test, start, and run
with no Plannotator checkout present.

## Chosen technology stack

This is a small local TypeScript web application, not a desktop wrapper or hosted
service.

| Concern | Choice | MVP boundary |
| --- | --- | --- |
| Language | TypeScript | Shared types across the server, persistence, guide logic, and UI. |
| Runtime and package manager | Bun | Runs the local HTTP server, launches `git` and `claude`, installs packages, and runs tests. |
| UI | React | Functional components, hooks, and small context providers only. |
| Build and development | Vite | Builds the browser application and provides the development workflow. |
| Styling | Tailwind CSS | Implements a minimal layout inspired by Plannotator using local classes and tokens. |
| Diff rendering | `@pierre/diffs` | Displays canonical unified patches; all usage is isolated behind one local `DiffViewer` adapter. |
| Generated prose | `marked` plus DOMPurify | Renders guide Markdown while treating all model output as untrusted. |
| Persistence | Local JSON files | Atomic snapshot writes; no database or migration framework for the MVP. |
| Processes | Bun subprocess APIs | Invokes fixed, server-owned `git` and `claude` argument arrays without a shell. |
| Tests | `bun:test` plus a DOM test environment | Unit, component, security-boundary, and integration coverage. |

Use one package and one lockfile. A suggested source layout is:

```text
src/
  server/   # local HTTP boundary, git/Claude processes, snapshot I/O
  shared/   # guide types, validation, fingerprints, feedback formatting
  ui/       # React review workspace and adapters
tests/
```

At bootstrap, Plannotator's dependency choices may inform the initial versions, but
record this repository's exact resolved versions in its own Bun lockfile. Pin
`@pierre/diffs` to the exact version chosen at bootstrap rather than accepting an
unbounded compatible upgrade.
No UI outside the local `DiffViewer` adapter may import `@pierre/diffs`; this keeps a
specialized renderer and its shadow-DOM styling from leaking into product state and
review behavior.

The browser uses native `fetch` for the small local API. React state and narrow context
providers are sufficient for view and annotation state. Do not introduce a router,
external state store, ORM, database, Electron, Next.js, or WebSocket layer unless a
later requirement demonstrates a need.

## Local trust boundary and security requirements

The local server can read repository data and launch the authenticated Claude Code
CLI, so `localhost` is not itself an authentication mechanism. The browser is an
untrusted client. The server owns all file access, executable selection, command
construction, validation, and persistence.

### Session access

- Bind only to the IPv4 loopback address `127.0.0.1`, never `0.0.0.0`, and do not
  provide a remote-access mode in the MVP.
- Let the operating system assign an available high port for each run.
- Generate a cryptographically random, short-lived capability token for each server
  run. Put it in the opened URL fragment so it is not sent in the initial HTTP request.
- The React application reads the fragment, removes it from the visible URL, keeps the
  token in memory, and sends it as `X-Guided-Review-Token` on every API request.
- Reject every API request with a missing or invalid token. Do not place the token in
  query strings, cookies, persisted state, analytics, or logs.
- Serve no CORS permissions. Validate `Origin` on state-changing requests, accept only
  the server's own origin, and reject unexpected `Host` values.
- Use an allowlist of API routes and HTTP methods. Return `Cache-Control: no-store` for
  review data and API responses.

### Commands and repository access

- The browser sends intent-shaped requests such as `generateGuide` or
  `loadCurrentDiff`; it never supplies an executable, shell text, arbitrary arguments,
  working directory, or output path.
- Build fixed `git` and `claude` argument arrays on the server and launch them directly
  without a shell. The repository owns a minimal read-only Claude tool policy that
  permits only the repository inspection needed to organize the supplied diff.
- Canonicalize the repository root once at startup. Resolve and validate every
  requested file path against it before reading; reject traversal, absolute paths,
  symlink escape, and access outside the review repository.
- Expose only files represented by the current review diff or an explicitly stored
  review snapshot. Do not implement a general filesystem-read endpoint.
- Apply conservative request-body, patch, generated-output, and persisted-snapshot
  size limits. Reject excess input with an actionable error.
- Bound child-process execution time, support cancellation, and clean up the child on
  server shutdown or browser cancellation.
- Give child processes only the environment needed for the user's existing Git and
  Claude Code configuration. Never return environment values, credentials, auth
  state, or raw process configuration to the browser.

### Rendering, storage, and logging

- Treat guide titles, intent, overviews, file descriptions, errors, patches, and saved
  feedback as untrusted text. React escaping remains the default; any rendered
  Markdown is sanitized with DOMPurify before insertion into the document.
- Set a restrictive Content Security Policy compatible with the built application;
  disallow remote scripts, frames, plugins, and unexpected network destinations.
- Write snapshots atomically with user-local permissions. Persist review content only;
  never persist the session token, Claude authentication, environment variables, or
  other secrets.
- Do not log the capability token, environment, credentials, or full diff by default.
  Logs may include timestamps, operation names, durations, exit status, and redacted
  failure summaries.
- Authentication failure, invalid paths, invalid generated output, and process failure
  must fail closed without exposing stack traces or sensitive process output in the UI.

## Primary user flow

1. From the repository to review, the user runs this product's standalone local review
   command.
2. The review UI loads the canonical current diff.
3. The user opens Guided Review.
4. If no guide exists for this review snapshot, the UI offers `Generate guide`.
5. The server launches the locally authenticated Claude Code CLI using the copied
   verbatim prompt assets and this product's own fixed, read-only launch command.
6. The validated guide appears as an ordered vertical walkthrough.
7. The user reads chapter explanations beside the real diffs.
8. The user adds line comments, file comments, question annotations, and optional
   general feedback.
9. The user marks completed chapters as reviewed; reviewed chapters collapse.
10. The user clicks `Copy feedback`.
11. The UI copies the current round's feedback as Markdown and confirms success.
12. The user pastes that Markdown into the author's agent session.

## Rereview flow

The guide belongs to the diff snapshot on which it was generated. The product stores
a fingerprint for that snapshot and per-file patch fingerprints.

### Unchanged diff

When the current diff fingerprint matches the saved snapshot:

- restore the existing guide;
- restore reviewed chapter state;
- restore the current round's draft annotations and general feedback;
- make no Claude call.

### Changed diff

When the author has changed the code and the current fingerprint differs:

1. Preserve the previous round and its original patch as a read-only snapshot.
2. Reuse the existing guide structure against the current canonical diff.
3. Compare per-file patch fingerprints locally.
4. Reopen chapters that contain changed files.
5. Leave unchanged, previously reviewed chapters collapsed.
6. Mark affected files `Changed since review`.
7. Place newly added files in a deterministic trailing section titled
   `Updates since last review`.
8. Mark removed guide references `No longer present` and do not render a current diff
   for them.
9. Start a fresh annotation/general-feedback round for the updated diff.
10. Show a staleness banner because the existing chapter prose may no longer fully
    describe the implementation.
11. Make no Claude call.

Banner copy:

> Code has changed since this walkthrough was generated. The existing guide has been
> reused, and its explanations may be outdated.

The banner shows the number of changed, added, and removed files and offers:

- `Review updates` as the primary, zero-token action;
- `Regenerate guide` as an explicit secondary action.

`Regenerate guide` is never automatic. It runs the same copied verbatim guide prompts
against the current changeset and creates a new guide snapshot with fresh reviewed
state. The UI should make clear that this action invokes Claude Code again.

Previous-round annotations are not automatically moved onto the updated diff. They
remain available under a small read-only `Previous feedback` disclosure so the user
can verify what was originally requested. This avoids false confidence from incorrect
line re-anchoring.

## Functional requirements

### FR1: Guide generation

- Support Claude Code only.
- Use the user's existing local Claude Code authentication; require no API key.
- Launch generation only from an explicit `Generate guide` or `Regenerate guide`
  action.
- Show generating, success, failure, and cancellation states.
- Use this repository's own structured-output parser and fail-closed semantic
  validation against the current changed-file set.
- Never render an invented or non-changed file path.

### FR2: Guide coverage

- Render every validated guide section in generated order.
- Resolve each guide file reference against the canonical diff file map.
- Render all valid referenced files with their complete current patch.
- Render validated `unplacedFiles` in a trailing `Everything else` section.
- Never silently omit a changed file from the walkthrough.
- Newly added rereview files that were not in the original guide appear under
  `Updates since last review` without an AI call.

### FR3: Walkthrough layout

Implement a new UI inspired by Plannotator's current high-level Guided Review layout,
simplified for the MVP:

- a primary Guided Review reading mode rather than a modal;
- a compact header with `Back to diff`, guide title, and reviewed progress;
- guide intent under the title;
- a vertical list of chapter cards;
- on desktop, a two-column chapter card:
  - sticky left column for chapter title, position, overview, reviewed control, and
    file outline;
  - flexible right column for stacked live file diffs;
- on narrow screens, stack the overview above the diffs;
- a file chip jumps to that file within the chapter;
- marking a chapter reviewed collapses it to one row;
- manually expanding a reviewed chapter does not clear reviewed state;
- navigation to a comment or file reopens a collapsed target chapter;
- missing/stale references render an honest status rather than failing.

Visual styling should be minimal: local theme tokens, borders, spacing, readable
typography, and standard controls. No bespoke visual design work is required.

Reference-only layout sources in `../plannotator`:

- `packages/review-editor/components/guide/GuideView.tsx`
- `packages/review-editor/components/guide/GuideSectionCard.tsx`
- `packages/review-editor/components/guide/GuideFileCard.tsx`
- `packages/review-editor/App.tsx` guide takeover branch

### FR4: Diff and annotations

- Use the local `@pierre/diffs` adapter for both the normal diff and Guided Review; do
  not create a guide-specific diff parser or renderer.
- Render the actual canonical file patch, not model-generated excerpts.
- Implement one small local set of line-selection and annotation primitives shared by
  both review modes.
- Support:
  - line comments;
  - file comments;
  - question annotations represented with the `question` conventional-comment label;
  - general feedback.
- A question remains an ordinary comment with `conventionalLabel: "question"`; it does
  not require a separate annotation data type.
- Store annotations against the active review-round snapshot.
- Do not send annotations anywhere automatically.

### FR5: Copy feedback

- Provide one primary `Copy feedback` action.
- Copy only the active review round, not archived previous feedback.
- Group annotations by file and then source order.
- Include line ranges when present.
- Include annotation type when it adds meaning, especially `Question`.
- Include general feedback first when non-empty.
- Omit empty sections from the copied Markdown.
- Show a visible success confirmation.
- Show an actionable error if clipboard access fails; keep the generated Markdown
  available for manual selection.

Required output shape:

```md
# Guided review feedback

## Overall

The main approach looks good, but error recovery needs clarification.

## `src/service.ts`

- Lines 84–91 — Question: Why is retry handled here instead of by the caller?
- Line 117: This error loses the original context.

## `src/cache.ts`

- File comment: Please add coverage for rejected promises.
```

### FR6: Local persistence

- Persist review snapshots locally on disk; no cloud or account storage.
- Key review history by repository identity and review target.
- Store enough of the original snapshot to render previous feedback against the code
  that was actually reviewed.
- Writes must be atomic.
- Corrupt or unreadable saved state must not prevent opening a fresh review.
- The MVP UI only needs the active round plus one `Previous feedback` disclosure;
  storage may retain older rounds for forward compatibility without exposing a full
  history browser.

### FR7: Token behavior

- Opening or resuming an existing guide makes no model call.
- Detecting changes makes no model call.
- Computing changed/added/removed file status makes no model call.
- Reviewing updates with the reused guide makes no model call.
- Copying feedback makes no model call.
- Only explicit `Generate guide` and `Regenerate guide` actions invoke Claude Code.
- The UI must never regenerate merely because the diff fingerprint changed.

## Screen states

### Empty

- Heading: `Start a guided review?`
- One short explanation.
- Primary action: `Generate guide`.
- Secondary action: `Back to diff`.
- No model or provider settings.

### Generating

- Status text and elapsed time.
- Simple chapter skeletons.
- `Cancel` action.
- Detailed live activity logs are not required.

### Ready

- Header, intent, progress, and chapter cards.
- Annotation controls and general-feedback field.
- `Copy feedback` action.
- `Back to diff` action.

### Stale/review updates

- Staleness banner and local file-change counts.
- Existing guide reused against current diffs.
- Changed chapters reopened.
- `Review updates` and explicit `Regenerate guide` actions.
- Read-only `Previous feedback` disclosure.

### Failed

- Plain-language failure reason when available.
- `Retry` action.
- `Back to diff` action.
- No automatic repair, agent repair, or raw JSON editor.

## Data model

Define local `CodeGuideOutput`, `GuideSection`, and `GuideDiffRef` types that implement
the unchanged copied guide schema. No type is imported from Plannotator.

Add a local wrapper for review lifecycle state:

```ts
interface PersonalReviewSnapshot {
  id: string;
  createdAt: number;
  repoKey: string;
  reviewTarget: string;
  headSha?: string;
  diffFingerprint: string;
  fileFingerprints: Record<string, string>;
  patch: string;
  guide: CodeGuideOutput;
  reviewedSections: boolean[];
  rounds: PersonalReviewRound[];
}

interface PersonalReviewRound {
  id: string;
  createdAt: number;
  diffFingerprint: string;
  annotations: CodeAnnotation[];
  generalFeedback: string;
}
```

The active round is the last round. A changed diff creates a new round but does not
create a new guide unless the user explicitly regenerates.

## Architecture boundaries

### Local server

Owns the loopback listener, per-run capability token, origin/host checks, route and
method allowlists, request limits, process lifecycle, and safe error translation. It
exposes intent-shaped review operations to the browser and never exposes raw command
execution or arbitrary file access.

### Guide generation

Owns the standalone Claude invocation, composition of the copied verbatim prompts,
structured-output parsing, and local semantic validation. Exposes one intent-shaped
operation:

```ts
generateGuide(reviewContext): Promise<CodeGuideOutput>
```

The UI does not know Claude CLI flags or prompt composition details.

### Snapshot store

Owns repository keys, fingerprints, atomic serialization, round creation, and recovery
from corrupt files. Exposes operations such as:

```ts
loadCurrentReview(reviewTarget)
saveReview(snapshot)
beginUpdatedRound(snapshot, currentPatch)
```

### Guide projection

Purely joins a saved guide to the current canonical `DiffFile[]`, producing chapter
files plus changed/added/removed statuses. It makes no model call and performs no I/O.

### Feedback formatter

Purely converts the active round into deterministic Markdown. Clipboard access is a
separate browser adapter so formatting can be tested without browser APIs.

### UI

Owns presentation and transient interaction state. It consumes the boundaries above
and implements the simplified layout locally. The local `DiffViewer` adapter is the
only module coupled to `@pierre/diffs`; model prose passes through the sanitized
Markdown adapter before rendering.

## Acceptance criteria

The MVP is complete when all of the following are true:

1. A user with a working local Claude Code installation can explicitly generate a
   guide without entering an API key.
2. Generation uses a verbatim copy of Plannotator's `GUIDE_REVIEW_PROMPT`, supported
   dynamic changeset prompt text, and structured-output schema with recorded source
   provenance.
3. Every changed file appears in one generated chapter, `Everything else`, or the
   local rereview `Updates since last review` section.
4. The user can inspect every current diff hunk from Guided Review.
5. The user can add line, file, question, and general feedback.
6. `Copy feedback` produces deterministic Markdown for only the active round.
7. Clipboard success and failure are both visible.
8. Closing and reopening an unchanged review restores its guide, progress, and draft
   feedback without invoking Claude.
9. Opening a changed review reuses the guide, reopens affected chapters, identifies
   changed/added/removed files, and invokes no model.
10. Previous feedback remains available read-only against its saved snapshot.
11. Guide regeneration occurs only after an explicit user action.
12. The normal diff workspace remains intact when entering and leaving Guided Review.
13. The application builds and runs as one Bun-managed TypeScript package with a
    React/Vite/Tailwind browser UI and local JSON persistence.
14. The production server binds only to `127.0.0.1` on an ephemeral port and requires
    a new in-memory capability token for every API request on every run.
15. Missing-token, invalid-token, cross-origin, unexpected-host, unsupported-method,
    and unknown-route requests fail closed without performing work.
16. Browser input cannot select an executable, alter the fixed `git` or `claude`
    command shape, read outside the canonical repository root, or write repository
    files.
17. Malicious guide Markdown, saved feedback, filenames, patches, and process errors
    render as inert content and cannot execute script or load remote resources.
18. `@pierre/diffs` is pinned and imported only through the local `DiffViewer` adapter.
19. Snapshot files are written atomically and contain no session token, Claude
    credentials, or captured environment data.
20. The application builds, tests, starts, and completes a review when
    `../plannotator` is absent; it never imports, executes, or contacts Plannotator.
21. `THIRD_PARTY_NOTICES.md` remains present and identifies the copied prompt assets,
    source revision, Plannotator copyright, and applicable MIT license without
    licensing this repository's original code.

## Verification plan

### Unit tests

- Copied organizer prompt, supported dynamic prompt text, and schema remain
  byte-for-byte equal to the recorded Plannotator source revision.
- Local validation rejects malformed sections, unknown or duplicate files, and silent
  changed-file omissions.
- Guide projection preserves generated order and handles duplicate, missing, added,
  changed, and removed paths deterministically.
- Fingerprints are stable for identical patches and change when relevant patch content
  changes.
- Updated-round creation preserves previous feedback and starts clean current feedback.
- Feedback Markdown ordering, line ranges, annotation labels, empty fields, and escaping.
- Reviewed-state normalization when guide section counts differ.
- Capability-token generation and constant-time validation behavior.
- Canonical path validation rejects traversal, absolute paths, and symlink escape.
- Command construction ignores injection-shaped input and always produces fixed argv
  arrays without a shell.
- Request, patch, output, and snapshot size limits fail with stable errors.
- Markdown sanitization removes scripts, event handlers, dangerous URLs, and remote
  embeds while preserving expected guide formatting.

### Component tests

- Complete chapter/file rendering using the local shared diff adapter.
- Reviewed chapters collapse and navigation reopens them.
- Changed-file badges and `Updates since last review` rendering.
- Read-only previous feedback.
- Copy success and clipboard-failure fallback.
- Stale/missing guide references degrade visibly.
- The `DiffViewer` adapter renders the canonical patch without leaking renderer-specific
  state into review state.
- Untrusted guide prose, filenames, patches, feedback, and errors render inertly.

### Integration tests

- Claude Code guide generation through this repository's standalone launch contract.
- Valid output becomes a rendered guide; invalid output fails closed.
- Guide generation and the normal test suite succeed with no sibling Plannotator
  checkout available.
- Generate, annotate, copy, close, and resume unchanged review.
- Generate, annotate, change repository diff, reopen, and review updates without a
  second Claude invocation.
- Explicit regeneration creates a new guide snapshot.
- The production server advertises a `127.0.0.1` URL with an ephemeral port and a
  fragment capability; authorized same-origin API calls succeed.
- Requests without the capability, with the wrong capability, from a mismatched
  origin/host, or using an unsupported route/method are rejected before repository or
  process work occurs.
- Cancellation and server shutdown terminate an active Claude child process and leave
  no partial snapshot.

### Manual smoke test

1. Open a medium local changeset.
2. Generate a guide.
3. Confirm core-first ordering and complete file coverage.
4. Add a line question, a file comment, and general feedback.
5. Copy and paste the Markdown into Claude Code.
6. Modify two existing files, add one file, and remove one file.
7. Reopen the review.
8. Confirm zero-token guide reuse, affected chapter reopening, and honest file states.
9. Confirm previous feedback remains readable and current feedback begins empty.

## Implementation sequence

1. Copy the exact Plannotator organizer prompt, supported dynamic changeset prompt,
   and schema into this repository with source-revision provenance and text-locking
   tests. Preserve `THIRD_PARTY_NOTICES.md`. Copy no launcher, validator, skill,
   server, or UI code.
2. Scaffold the standalone Bun/TypeScript/React/Vite/Tailwind application and build a
   simplified local UI inspired by Plannotator's chaptered two-column Guided Review
   layout. Pin dependencies and add local `@pierre/diffs` and sanitized-Markdown
   adapters; do not import Plannotator components.
3. Build the secure loopback server boundary: per-run capability, origin/host checks,
   route allowlist, canonical repository root, fixed subprocess construction, limits,
   cancellation, and safe errors.
4. Implement the repository-owned Claude launcher, structured-output parser, and
   minimal fail-closed guide validation.
5. Add local snapshot/round persistence and deterministic fingerprints.
6. Complete the Guided Review empty, generating, ready, stale, and failed states.
7. Wire line, file, question, and general feedback into one active round.
8. Implement deterministic Markdown formatting and clipboard behavior.
9. Implement local zero-token rereview projection and previous-feedback disclosure.
10. Add explicit regeneration as the only rereview model call.
11. Run focused unit, component, security, integration, and manual smoke verification.

## Deferred opportunities

Only consider these after using the MVP:

- automatic feedback delivery to the invoking agent session;
- live question answering inside the walkthrough;
- incremental guide refresh using only the previous guide plus the delta;
- automatic old-comment matching and resolution suggestions;
- a full review-round history browser;
- hunk-level chapter placement;
- virtualization tuned for extremely large reviews;
- additional providers;
- PR comment publishing.

## Decision summary

- Personal and local only.
- TypeScript throughout, using Bun, React, Vite, Tailwind CSS, `@pierre/diffs`, and
  local JSON persistence in one package.
- The Bun server is loopback-only and guarded by an ephemeral per-run capability;
  browser requests cannot invoke arbitrary commands or access arbitrary files.
- Claude Code only, using existing CLI authentication.
- Plannotator's organizer prompt, supported dynamic prompt text, and schema are copied
  verbatim into this repository; no other Plannotator runtime contract is used.
- A new simplified UI is inspired by Plannotator's chaptered two-column layout but
  implemented entirely within this repository.
- Plannotator is never imported, executed, contacted, or required at runtime.
- `THIRD_PARTY_NOTICES.md` attributes the copied Plannotator material without
  licensing this repository's original work.
- Local diff and annotation components remain authoritative.
- Feedback handoff is clipboard-only.
- Rereviews reuse the guide locally and cost zero tokens by default.
- Regeneration is explicit, optional, and visibly invokes Claude Code.
