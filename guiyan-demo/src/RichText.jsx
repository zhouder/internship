import { Fragment } from "react";

function inline(text) {
  return text.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\n]+\*|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\))/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`")) return <code key={i}>{part.slice(1, -1)}</code>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={i}>{part.slice(1, -1)}</em>;
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    return link ? <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer">{link[1]}</a> : <Fragment key={i}>{part}</Fragment>;
  });
}

// Render a small Markdown subset as React nodes. Model output never becomes HTML.
export function RichText({ text = "" }) {
  const lines = String(text).replace(/\r\n?/g, "\n").split("\n"), blocks = [];
  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (/^```/.test(line)) {
      const code = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      if (i < lines.length) i++;
      blocks.push(<pre key={i}><code>{code.join("\n")}</code></pre>); continue;
    }
    if (/^#{1,6}\s+/.test(line)) {
      blocks.push(<h4 key={i}>{inline(line.replace(/^#{1,6}\s+/, ""))}</h4>); i++; continue;
    }
    const list = line.match(/^\s*(?:([-*+])\s+|(\d+)[.、)]\s+)(.*)$/);
    if (list) {
      const ordered = Boolean(list[2]), items = [], start = Number(list[2] || 1);
      while (i < lines.length) {
        const item = lines[i].match(/^\s*(?:([-*+])\s+|(\d+)[.、)]\s+)(.*)$/);
        if (!item || Boolean(item[2]) !== ordered) break;
        items.push(<li key={i}>{inline(item[3])}</li>); i++;
      }
      blocks.push(ordered ? <ol key={i} start={start}>{items}</ol> : <ul key={i}>{items}</ul>); continue;
    }
    blocks.push(<p key={i}>{inline(line)}</p>); i++;
  }
  return <div className="rich-text">{blocks}</div>;
}
