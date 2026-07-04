import DOMPurify from "isomorphic-dompurify";

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function textToHtml(text: string) {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

export function SafeHtml({ html, className }: { html: string | null | undefined; className?: string }) {
  if (!html) return null;
  const source = /<\/?[a-z][\s\S]*>/i.test(html) ? html : textToHtml(html);
  const clean = DOMPurify.sanitize(source, {
    ALLOWED_TAGS: ["p", "br", "strong", "em", "u", "a", "ul", "ol", "li", "h1", "h2", "h3", "blockquote", "code"],
    ALLOWED_ATTR: ["href", "target", "rel"],
  });
  return (
    <div
      className={className}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
