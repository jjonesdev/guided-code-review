import { beforeAll, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";

let sanitizeGuideMarkdown: (value: string) => string;

beforeAll(async () => {
  const window = new Window();
  Object.assign(globalThis, { window, document: window.document, Node: window.Node, Element: window.Element, HTMLElement: window.HTMLElement });
  ({ sanitizeGuideMarkdown } = await import("../src/ui/components/Markdown"));
});

describe("untrusted rendering", () => {
  test("removes scripts, handlers, remote embeds, and dangerous URLs", () => {
    const html = sanitizeGuideMarkdown('<script>alert(1)</script><img src="https://evil.test/x" onerror="alert(2)"><a href="javascript:alert(3)" style="color:red">link</a><iframe src="https://evil.test"></iframe>\n\n**safe**');
    expect(html).not.toContain("script");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("evil.test");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("style=");
    expect(html).toContain("<strong>safe</strong>");
  });
});
