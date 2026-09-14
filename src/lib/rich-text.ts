/**
 * Helpers for form text that may be stored either as plain text (legacy)
 * or as sanitised rich-text HTML (bold, line breaks, lists).
 */

/** True when the stored value looks like HTML rather than plain text. */
export function isHtml(value: string | null | undefined): boolean {
  if (!value) return false;
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

/** Convert rich-text HTML into plain text with line breaks (for PDFs, emails). */
export function richTextToPlain(value: string | null | undefined): string {
  if (!value) return "";
  if (!isHtml(value)) return value;
  return value
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|h[1-6]|blockquote)\s*>/gi, "\n\n")
    .replace(/<\s*li[^>]*>/gi, "• ")
    .replace(/<\s*\/\s*li\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** True when there is any visible text once tags are stripped. */
export function hasRichText(value: string | null | undefined): boolean {
  return richTextToPlain(value).trim().length > 0;
}
