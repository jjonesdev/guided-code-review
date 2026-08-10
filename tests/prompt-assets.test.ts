import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { GUIDE_REVIEW_PROMPT, GUIDE_SCHEMA_JSON, PLANNOTATOR_SOURCE_PATH, PLANNOTATOR_SOURCE_REVISION, buildGuideUserMessage } from "../src/shared/prompt-assets";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

describe("verbatim Plannotator assets", () => {
  test("locks the copied prompt and schema to the recorded revision", () => {
    expect(PLANNOTATOR_SOURCE_PATH).toBe("packages/server/guide/guide-review.ts");
    expect(PLANNOTATOR_SOURCE_REVISION).toBe("d5ae439f7a06d0c461e89db05b30e674ea46bd65");
    expect(hash(GUIDE_REVIEW_PROMPT)).toBe("f2147d6e487ca50b4f9e6ee2c3106547c6be2bb7a86b3df636e9d2f333ba7270");
    expect(hash(GUIDE_SCHEMA_JSON)).toBe("122963324cd02e67defc048a248981eaddd77acb10d99caf16b82b36829ab2bc");
  });

  test("locks the supported inline-patch changeset message", () => {
    const message = buildGuideUserMessage("PATCH", [{ path: "a.ts", additions: 1, deletions: 2 }]);
    expect(hash(message)).toBe("4e3c1645872f6f4bbfcce1a9da5e2b0a58def743a1253973a6d28cae7589d3c1");
    expect(message).toContain("```diff\nPATCH\n```");
  });
});
