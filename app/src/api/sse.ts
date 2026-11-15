import type { SseFrame } from '../edge/api/jobs.ts';

export function createSseParser() {
  let pending = '', skipped = 0;
  return {
    get skipped() { return skipped; },
    push(chunk: string): SseFrame[] {
      pending += chunk;
      const frames: SseFrame[] = [];
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r?\n\r?\n/.exec(pending))) {
        const block = pending.slice(0, boundary.index);
        pending = pending.slice(boundary.index + boundary[0].length);
        let id = '', event = 'message';
        const data: string[] = [];
        for (const line of block.split(/\r?\n/)) {
          if (line.startsWith(':')) continue;
          const colon = line.indexOf(':');
          const field = colon < 0 ? line : line.slice(0, colon);
          const value = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '');
          if (field === 'id') id = value;
          if (field === 'event') event = value;
          if (field === 'data') data.push(value);
        }
        if (!data.length) continue;
        let parsed: unknown;
        try { parsed = JSON.parse(data.join('\n')); }
        catch { skipped++; continue; }
        if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || !parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          skipped++; continue;
        }
        frames.push({ id: Number(id), event, data: parsed as Record<string, unknown> });
      }
      return frames;
    },
  };
}
