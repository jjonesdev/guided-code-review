import type { CodeAnnotation, ReviewStatePayload } from "../shared/types";

let token = "";

export function initializeCapability(): string {
  const fragment = window.location.hash.slice(1);
  if (fragment) {
    token = fragment;
    history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }
  return token;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "X-Guided-Review-Token": token,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const body = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status}).`);
  return body as T;
}

export const api = {
  review(scenario?: string) {
    return request<ReviewStatePayload>(`/api/review${scenario ? `?fixtureState=${encodeURIComponent(scenario)}` : ""}`);
  },
  generate(regenerate: boolean) {
    return request<ReviewStatePayload>("/api/generate", { method: "POST", body: JSON.stringify({ regenerate }) });
  },
  cancel() {
    return request<{ cancelled: boolean }>("/api/cancel", { method: "POST", body: "{}" });
  },
  update(value: { reviewedSections?: boolean[]; annotations?: CodeAnnotation[]; generalFeedback?: string }) {
    return request<ReviewStatePayload>("/api/review", { method: "PATCH", body: JSON.stringify(value) });
  },
  feedback() {
    return request<{ markdown: string }>("/api/feedback");
  },
};
