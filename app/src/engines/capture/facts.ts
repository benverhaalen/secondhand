// Packet 47 item 6b: one `fact.found` frame per attribute while the camera is open.
export type Source = 'seen' | 'label' | 'measured' | 'asked';
const LADDER: Record<Source, number> = { seen: 0, label: 1, measured: 2, asked: 3 };

export type Attribute = { name: string; value: string | number | null; source: Source; photo_id?: string; box?: [number, number, number, number] };
export type Ctx = { job_id: string; capture_id: string };
export type FactFrame = {
  event: 'fact.found'; job_id: string; capture_id: string;
  attribute: Attribute | { name: string; value: null; unknown_reason: 'not_visible' };
};

/** prev is what was last sent for this attribute (undefined if nothing); the caller keeps it. */
export function factFound(prev: Pick<Attribute, 'value' | 'source'> | undefined, attr: Attribute, ctx: Ctx): FactFrame | null {
  if (attr.value === null) return null;
  // a lower source never overrides a higher one; a disagreement there is a mark, not a frame
  if (prev !== undefined && (LADDER[attr.source] < LADDER[prev.source] || (prev.value === attr.value && attr.source === prev.source))) return null;
  return { event: 'fact.found', job_id: ctx.job_id, capture_id: ctx.capture_id, attribute: attr };
}

/** At stop, a blank for each name never found. */
export function blanksAtStop(names: string[], have: Iterable<string>, ctx: Ctx): FactFrame[] {
  const found = new Set(have);
  return names.filter((n) => !found.has(n)).map((name) => ({
    event: 'fact.found', job_id: ctx.job_id, capture_id: ctx.capture_id, attribute: { name, value: null, unknown_reason: 'not_visible' },
  }));
}
