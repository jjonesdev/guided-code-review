import { useMemo } from "react";
import DOMPurify from "dompurify";
import { marked } from "marked";

export function sanitizeGuideMarkdown(value: string): string {
  const sanitized = DOMPurify.sanitize(String(marked.parse(value, { async: false })), {
    ALLOWED_TAGS: ["p", "br", "strong", "em", "code", "pre", "blockquote", "ul", "ol", "li", "a", "h1", "h2", "h3", "h4", "hr"],
    ALLOWED_ATTR: ["href", "title"],
    ALLOW_DATA_ATTR: false,
  });
  // A second small allowlist keeps the boundary deterministic in lightweight
  // DOM implementations as well as browsers; DOMPurify remains the primary
  // sanitizer and this pass intentionally supports only guide prose markup.
  const template = document.createElement("template");
  template.innerHTML = sanitized;
  const allowedTags = new Set(["P", "BR", "STRONG", "EM", "CODE", "PRE", "BLOCKQUOTE", "UL", "OL", "LI", "A", "H1", "H2", "H3", "H4", "HR"]);
  for (const element of Array.from(template.content.querySelectorAll("*"))) {
    if (!allowedTags.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes));
      continue;
    }
    for (const attribute of Array.from(element.attributes)) {
      if (!(["href", "title"].includes(attribute.name) && element.tagName === "A")) element.removeAttribute(attribute.name);
    }
    const href = element.getAttribute("href");
    if (href && !/^(https?:|mailto:|#|\/)/i.test(href)) element.removeAttribute("href");
  }
  return template.innerHTML;
}

export function Markdown({ value, className = "" }: { value: string; className?: string }) {
  const html = useMemo(() => sanitizeGuideMarkdown(value), [value]);
  return <div className={`prose-guide ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
