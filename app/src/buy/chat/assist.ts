// A follow-up answer in the shop chat, folded from its assist job's frames (features/assist/README.md, "The route"):
// assist.tool as each tool starts and ends, assist.text as words are written, assist.settled with the answer's blocks,
// then job.state. Pure, like reach(): a frame it cannot read is skipped and counted, never guessed at.
import type { Answer, Block, ToolCallInfo, ToolResult } from '../../edge/assist/types.ts';

export interface Reply {
  state: 'running' | 'done' | 'failed';
  text: string;                                  // the words so far, then the settled text blocks joined
  tools: (Pick<ToolCallInfo, 'id' | 'tool' | 'ok' | 'counts' | 'ms'> & { phase: 'start' | 'end' })[];
  blocks: Block[] | null;                        // the settled answer, text and widget tags in order
  results: Record<string, ToolResult>;
  error: string | null;
  skipped: number;
}

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const block = (b: unknown): b is Block => object(b) && (b.type === 'text' && typeof b.text === 'string'
  || b.type === 'widget' && typeof b.widget === 'string' && typeof b.result_id === 'string'
  || b.type === 'ask' && object(b.ask) && typeof b.ask.id === 'string' && typeof b.ask.field === 'string' && typeof b.ask.words === 'string' && Array.isArray(b.ask.options));

export function reply(frames: unknown[]): Reply {
  const out: Reply = { state: 'running', text: '', tools: [], blocks: null, results: {}, error: null, skipped: 0 };
  for (const raw of frames) {
    const f = object(raw) && typeof raw.event === 'string' && object(raw.data) ? { event: raw.event, data: raw.data } : null;
    if (!f) { out.skipped++; continue; }
    const d = f.data;
    if (f.event === 'assist.text' && typeof d.delta === 'string') { out.text += d.delta; continue; }
    if (f.event === 'assist.tool' && typeof d.id === 'string' && typeof d.tool === 'string' && (d.phase === 'start' || d.phase === 'end')) {
      const t: Reply['tools'][number] = { id: d.id, tool: d.tool as ToolCallInfo['tool'], ok: d.ok === true, counts: object(d.counts) ? d.counts as Record<string, number> : {}, ms: typeof d.ms === 'number' ? d.ms : 0, phase: d.phase === 'start' ? 'start' : 'end' };
      const at = out.tools.findIndex(x => x.id === t.id);
      if (at < 0) out.tools.push(t); else out.tools[at] = t;
      continue;
    }
    if (f.event === 'assist.settled' && Array.isArray(d.blocks) && d.blocks.every(block)) {
      const blocks: Block[] = d.blocks.filter(block);
      out.blocks = blocks;
      out.results = object(d.results) ? d.results as Answer['results'] : {};
      out.text = blocks.flatMap(b => b.type === 'text' ? [b.text] : []).join('');
      if (d.state !== 'answered') out.error = typeof d.reason === 'string' ? d.reason : typeof d.state === 'string' ? d.state : 'failed';
      continue;
    }
    if (f.event === 'job.state' && (d.state === 'done' || d.state === 'failed' || d.state === 'running')) {
      out.state = d.state;
      if (d.state === 'failed') out.error = object(d.error) && typeof d.error.message === 'string' ? d.error.message : 'failed';
      continue;
    }
    out.skipped++;
  }
  return out;
}
