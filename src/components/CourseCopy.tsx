/**
 * Renders practitioner-written course copy as readable paragraphs and bullet
 * lists. Course descriptions are plain text typed in the dashboard, so we
 * preserve paragraph breaks and turn "*", "-" or "•" prefixed lines into a
 * proper list instead of one long blob of text.
 */
type Props = { text: string; className?: string };

type Block =
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] };

function parse(text: string): Block[] {
  // Some copy is pasted with bullets inline (e.g. "… planning * Treatment areas");
  // put those on their own line first so they parse as list items.
  const normalised = text
    .replace(/\r\n/g, "\n")
    .replace(/\s+([*•])\s+/g, "\n$1 ");

  const blocks: Block[] = [];
  let bullets: string[] = [];
  let para: string[] = [];

  const flushBullets = () => {
    if (bullets.length) {
      blocks.push({ kind: "ul", items: bullets });
      bullets = [];
    }
  };
  const flushPara = () => {
    if (para.length) {
      blocks.push({ kind: "p", text: para.join(" ").trim() });
      para = [];
    }
  };

  for (const raw of normalised.split("\n")) {
    const line = raw.trim();
    if (!line) {
      flushBullets();
      flushPara();
      continue;
    }
    const bullet = line.match(/^[*•]\s+(.*)$/) || line.match(/^-\s+(.*)$/);
    if (bullet) {
      flushPara();
      bullets.push(bullet[1].trim());
    } else {
      flushBullets();
      para.push(line);
    }
  }
  flushBullets();
  flushPara();
  return blocks;
}

export function CourseCopy({ text, className }: Props) {
  const blocks = parse(text);
  if (!blocks.length) return null;
  return (
    <div className={className ?? "space-y-3 text-sm leading-relaxed text-muted-foreground"}>
      {blocks.map((b, i) =>
        b.kind === "p" ? (
          <p key={i}>{b.text}</p>
        ) : (
          <ul key={i} className="list-disc space-y-1 pl-5">
            {b.items.map((it, j) => (
              <li key={j}>{it}</li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}

export default CourseCopy;
