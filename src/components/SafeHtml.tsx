function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const ALLOWED_TAGS = new Set([
  "a",
  "p",
  "br",
  "strong",
  "em",
  "u",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "blockquote",
  "code",
]);

/**
 * Keep the small formatting subset used by the form editor without relying on
 * a browser DOM implementation during server rendering.
 */
function sanitizeHtml(source: string) {
  let clean = "";
  let cursor = 0;

  for (const match of source.matchAll(/<[^>]*>/g)) {
    const index = match.index ?? cursor;
    clean += escapeHtml(source.slice(cursor, index));

    const tag = match[0].match(/^<\s*(\/?)\s*([a-z0-9]+)(?:\s[^>]*)?\s*(\/?)>$/i);
    if (tag) {
      const name = tag[2]?.toLowerCase();
      if (name && ALLOWED_TAGS.has(name)) {
        const closing = tag[1] === "/";
        clean += name === "br" ? "<br />" : closing ? `</${name}>` : `<${name}>`;
      }
    }

    cursor = index + match[0].length;
  }

  clean += escapeHtml(source.slice(cursor));
  return clean.replace(/&amp;(amp|lt|gt|quot|#39|nbsp);/gi, "&$1;");
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
  const clean = sanitizeHtml(source);
  return (
    <div
      className={className}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
