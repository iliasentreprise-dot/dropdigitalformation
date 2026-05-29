import React from "react";

/**
 * Lightweight inline formatter:
 *  - **text** → <strong>text</strong>
 *  - Double newlines → paragraph breaks (handled by caller splitting on /\n\s*\n/)
 *  - Single newlines preserved as <br />
 */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    nodes.push(<strong key={`${keyPrefix}-b-${i++}`}>{match[1]}</strong>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));

  // handle single newlines as <br />
  const withBreaks: React.ReactNode[] = [];
  nodes.forEach((node, idx) => {
    if (typeof node === "string") {
      const parts = node.split("\n");
      parts.forEach((p, j) => {
        if (j > 0) withBreaks.push(<br key={`${keyPrefix}-br-${idx}-${j}`} />);
        if (p) withBreaks.push(p);
      });
    } else {
      withBreaks.push(node);
    }
  });
  return withBreaks;
}

type Props = {
  text: string | null | undefined;
  className?: string;
  style?: React.CSSProperties;
};

export function RichText({ text, className, style }: Props) {
  if (!text) return null;
  const paragraphs = text.split(/\n\s*\n/);
  return (
    <div className={className} style={style}>
      {paragraphs.map((p, i) => (
        <p key={`rt-p-${i}`} style={{ margin: i === 0 ? "0 0 0.85em" : "0.85em 0" }}>
          {renderInline(p, `rt-${i}`)}
        </p>
      ))}
    </div>
  );
}
