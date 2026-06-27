import DOMPurify from "isomorphic-dompurify";

export function SafeHtml({ html, className }: { html: string | null | undefined; className?: string }) {
  if (!html) return null;
  const clean = DOMPurify.sanitize(html, {
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
