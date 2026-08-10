import { sha256, repositoryKey } from "../shared/fingerprints";
import { fingerprintFiles, projectGuide } from "../shared/projection";
import { formatFeedback } from "../shared/feedback";
import { LIMITS, assertByteLimit } from "../shared/limits";
import { FIXTURE_FILES, FIXTURE_GUIDE, FIXTURE_PATCH } from "../shared/fixtures";
import type { CodeAnnotation, CodeGuideOutput, PersonalReviewRound, PersonalReviewSnapshot, ReviewStatePayload } from "../shared/types";
import type { GuideGenerator } from "./claude";
import type { ProcessRunner } from "./process";
import { loadGitReview } from "./git";
import { SnapshotStore } from "./store";

function newRound(patch: string, fingerprint: string): PersonalReviewRound {
  return { id: crypto.randomUUID(), createdAt: Date.now(), diffFingerprint: fingerprint, patch, annotations: [], generalFeedback: "" };
}

export function beginUpdatedRound(snapshot: PersonalReviewSnapshot, patch: string, fingerprint: string): PersonalReviewSnapshot {
  const active = snapshot.rounds.at(-1);
  if (active?.diffFingerprint === fingerprint) return snapshot;
  return { ...snapshot, rounds: [...snapshot.rounds, newRound(patch, fingerprint)] };
}

function normalizeReviewed(value: boolean[], count: number): boolean[] {
  return Array.from({ length: count }, (_, index) => Boolean(value[index]));
}

function validateAnnotations(value: unknown, paths: Set<string>): CodeAnnotation[] {
  if (!Array.isArray(value) || value.length > 2_000) throw new Error("Annotations are malformed.");
  return value.map((item) => {
    if (!item || typeof item !== "object") throw new Error("Annotation is malformed.");
    const annotation = item as CodeAnnotation;
    if (typeof annotation.id !== "string" || typeof annotation.filePath !== "string" || !paths.has(annotation.filePath)) throw new Error("Annotation references an unavailable file.");
    if (typeof annotation.body !== "string" || annotation.body.length > 20_000) throw new Error("Annotation body is invalid.");
    if (annotation.conventionalLabel !== undefined && annotation.conventionalLabel !== "question") throw new Error("Annotation label is invalid.");
    if (annotation.lineStart !== undefined && (!Number.isInteger(annotation.lineStart) || annotation.lineStart < 1)) throw new Error("Annotation line is invalid.");
    if (annotation.lineEnd !== undefined && (!Number.isInteger(annotation.lineEnd) || annotation.lineEnd < (annotation.lineStart ?? 1))) throw new Error("Annotation line range is invalid.");
    return {
      id: annotation.id,
      filePath: annotation.filePath,
      body: annotation.body,
      lineStart: annotation.lineStart,
      lineEnd: annotation.lineEnd,
      side: annotation.side === "old" ? "old" : annotation.side === "new" ? "new" : undefined,
      conventionalLabel: annotation.conventionalLabel,
      createdAt: Number.isFinite(annotation.createdAt) ? annotation.createdAt : Date.now(),
    };
  });
}

export class FixtureGuideGenerator implements GuideGenerator {
  calls = 0;
  async generate(input: { signal?: AbortSignal }): Promise<CodeGuideOutput> {
    this.calls += 1;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, 700);
      input.signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new DOMException("Generation cancelled.", "AbortError"));
      }, { once: true });
    });
    return FIXTURE_GUIDE;
  }
}

export class ReviewService {
  private generation: AbortController | null = null;
  readonly repoKey: string;

  constructor(
    private readonly root: string,
    private readonly runner: ProcessRunner,
    private readonly generator: GuideGenerator,
    private readonly store: SnapshotStore,
    private readonly fixture = false,
  ) {
    this.repoKey = repositoryKey(root, fixture ? "fixture" : "");
  }

  async initializeFixture(): Promise<void> {
    if (!this.fixture || await this.store.load(this.repoKey)) return;
    const fingerprint = sha256(FIXTURE_PATCH);
    const snapshot: PersonalReviewSnapshot = {
      id: crypto.randomUUID(), createdAt: Date.now(), repoKey: this.repoKey, reviewTarget: "working-tree",
      diffFingerprint: fingerprint, fileFingerprints: fingerprintFiles(FIXTURE_FILES), patch: FIXTURE_PATCH,
      guide: FIXTURE_GUIDE, reviewedSections: [false, true, false], rounds: [newRound(FIXTURE_PATCH, fingerprint)],
    };
    await this.store.save(this.repoKey, snapshot);
  }

  private async currentReview() {
    if (this.fixture) return { root: this.root, headSha: "fixture-head", remote: "fixture", patch: FIXTURE_PATCH, files: FIXTURE_FILES };
    return loadGitReview(this.root, this.runner);
  }

  async load(scenario?: string): Promise<ReviewStatePayload> {
    const review = await this.currentReview();
    const diffFingerprint = sha256(review.patch);
    const fileFingerprints = fingerprintFiles(review.files);
    let snapshot = await this.store.load(this.repoKey);
    if (snapshot && snapshot.diffFingerprint !== diffFingerprint) {
      const updated = beginUpdatedRound(snapshot, review.patch, diffFingerprint);
      if (updated !== snapshot) { snapshot = updated; await this.store.save(this.repoKey, snapshot); }
    }
    const fixtureScenario = this.fixture && ["empty", "generating", "ready", "stale", "failed"].includes(scenario ?? "")
      ? scenario as ReviewStatePayload["fixtureScenario"] : this.fixture ? "ready" : undefined;
    if (fixtureScenario === "empty") snapshot = null;
    const projection = snapshot ? projectGuide(snapshot, review.files, fixtureScenario === "stale" ? `${diffFingerprint}-stale` : diffFingerprint) : null;
    if (projection && fixtureScenario === "stale" && !projection.stale) projection.stale = true;
    if (projection && fixtureScenario === "stale" && projection.changedCount === 0) {
      projection.changedCount = 1;
      const first = projection.sections[0]?.files[0];
      if (first) first.status = "changed";
      if (projection.sections[0]) projection.sections[0].reviewed = false;
    }
    return {
      repoRoot: review.root, reviewTarget: "working-tree", headSha: review.headSha, patch: review.patch,
      files: review.files, diffFingerprint, fileFingerprints, snapshot,
      projection, fixture: this.fixture, fixtureScenario,
    };
  }

  async generate(regenerate = false): Promise<ReviewStatePayload> {
    if (this.generation) throw new Error("Guide generation is already running.");
    const controller = new AbortController();
    this.generation = controller;
    try {
      const review = await this.currentReview();
      if (controller.signal.aborted) throw new DOMException("Generation cancelled.", "AbortError");
      if (!review.files.length) throw new Error("There are no local changes to organize.");
      const guide = await this.generator.generate({ root: review.root, patch: review.patch, files: review.files, signal: controller.signal });
      const diffFingerprint = sha256(review.patch);
      const previous = regenerate ? await this.store.load(this.repoKey) : null;
      const rounds = previous?.rounds ? [...previous.rounds, newRound(review.patch, diffFingerprint)] : [newRound(review.patch, diffFingerprint)];
      const snapshot: PersonalReviewSnapshot = {
        id: crypto.randomUUID(), createdAt: Date.now(), repoKey: this.repoKey, reviewTarget: "working-tree",
        headSha: review.headSha, diffFingerprint, fileFingerprints: fingerprintFiles(review.files), patch: review.patch,
        guide, reviewedSections: normalizeReviewed([], guide.sections.length), rounds,
      };
      await this.store.save(this.repoKey, snapshot);
      return this.load();
    } finally {
      this.generation = null;
    }
  }

  cancel(): boolean {
    if (!this.generation) return false;
    this.generation.abort();
    return true;
  }

  async update(value: unknown): Promise<ReviewStatePayload> {
    if (!value || typeof value !== "object") throw new Error("Review update is malformed.");
    const input = value as Record<string, unknown>;
    const state = await this.load();
    const snapshot = state.snapshot;
    if (!snapshot) throw new Error("No generated guide is available to update.");
    const allowed = new Set(["reviewedSections", "annotations", "generalFeedback"]);
    if (Object.keys(input).some((key) => !allowed.has(key))) throw new Error("Review update contains unsupported fields.");
    if (input.reviewedSections !== undefined) {
      if (!Array.isArray(input.reviewedSections) || input.reviewedSections.some((item) => typeof item !== "boolean")) throw new Error("Reviewed state is malformed.");
      snapshot.reviewedSections = normalizeReviewed(input.reviewedSections, snapshot.guide.sections.length);
    }
    const active = snapshot.rounds.at(-1);
    if (!active) throw new Error("The active feedback round is missing.");
    const validPaths = new Set([...state.files.map((file) => file.path), ...Object.keys(snapshot.fileFingerprints)]);
    if (input.annotations !== undefined) active.annotations = validateAnnotations(input.annotations, validPaths);
    if (input.generalFeedback !== undefined) {
      if (typeof input.generalFeedback !== "string" || input.generalFeedback.length > 50_000) throw new Error("Overall feedback is too long.");
      active.generalFeedback = input.generalFeedback;
    }
    assertByteLimit(JSON.stringify(snapshot), LIMITS.snapshotBytes, "snapshot");
    await this.store.save(this.repoKey, snapshot);
    return this.load();
  }

  async feedback(): Promise<{ markdown: string }> {
    const state = await this.load();
    const round = state.snapshot?.rounds.at(-1);
    if (!round) return { markdown: "# Guided review feedback\n" };
    return { markdown: formatFeedback(round) };
  }
}
