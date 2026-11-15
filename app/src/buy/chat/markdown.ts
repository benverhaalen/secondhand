// The chat answer's own formatting, read into blocks the shop view draws with the kit's parts (Nate, words.md 2026-11-15:
// "add headers, tables, and such, like claude in chat"). Only what the answer uses: headings, lists, pipe tables and
// paragraphs. The brand has one text weight, so a line that is all bold reads as a heading and inline marks are dropped.
export type MdBlock =
  | { type: 'heading'; text: string }
  | { type: 'para'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'table'; head: string[]; rows: string[][] };

export const inline = (s: string) => s
  .replace(/\*\*(.+?)\*\*|__(.+?)__/g, '$1$2')
  .replace(/`([^`]+)`/g, '$1')
  .replace(/(^|[^\w*])\*(?!\s)([^*]+?)\*(?![\w*])/g, '$1$2')
  .trim();

const cells = (line: string) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(inline);
const SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

export function markdown(text: string): MdBlock[] {
  const out: MdBlock[] = [];
  let para: string[] = [];
  const flush = () => { if (para.length) out.push({ type: 'para', text: inline(para.join(' ')) }); para = []; };
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m: RegExpMatchArray | null;
    if (!line.trim()) { flush(); continue; }
    if ((m = line.match(/^\s*#{1,6}\s+(.*)$/)) || (m = line.match(/^\s*\*\*([^*]+)\*\*:?\s*$/))) { flush(); out.push({ type: 'heading', text: inline(m[1]) }); continue; }
    if (/^\s*\|/.test(line)) {
      flush();
      const rows: string[][] = [];
      for (; i < lines.length && /^\s*\|/.test(lines[i]); i++) if (!SEPARATOR.test(lines[i])) rows.push(cells(lines[i]));
      i--;
      if (rows.length) out.push({ type: 'table', head: rows[0], rows: rows.slice(1) });
      continue;
    }
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/), number = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet || number) {
      flush();
      const ordered = !!number, item = inline((bullet ?? number)![1]), last = out[out.length - 1];
      if (last?.type === 'list' && last.ordered === ordered) last.items.push(item);
      else out.push({ type: 'list', ordered, items: [item] });
      continue;
    }
    para.push(line.trim());
  }
  flush();
  return out;
}
