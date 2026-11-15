// Rests-on: spec/features/item-card.md; spec/product.md §3, capture-to-item-card.
import type { Log } from '../../../../log/index.js';
import type { AttributeEvidence } from '../../engines/proof/proof.ts';

export interface Attribute {
  name: string; value: unknown; unit?: string; source: 'measured' | 'label' | 'inferred' | 'spec' | 'you_said' | 'marketplace';
  confidence: number; confirmed: boolean; evidence: AttributeEvidence[]; method: string; at: string;
  unknown_reason?: 'not_visible' | 'not_read' | 'conflict' | 'not_asked';
}
export interface CardRecord {
  item: { id: string; user_id: string; state: string; title: string; quantity: number; group_id?: string; product_id?: string };
  product?: { id: string; brand: string; model: string; variant: string };
  attributes: Attribute[];
  photos: { id: string; role: string; file_ref: string; use: 'real' | 'improved'; ai_marked: boolean }[];
  listings: { id: string; site: string; state: string; required_fields: string[] }[];
  part_ids?: string[];
}
export interface CardPort { read(user_id: string, item_id: string): Promise<CardRecord | undefined> }
export type Card = Omit<CardRecord, 'part_ids' | 'listings'> & {
  parts: Card[]; listings: (CardRecord['listings'][number] & { missing_fields: string[] })[];
  asked: { kind: 'missing_shot'; item_id: string; role: 'front' }[];
};

function checkAttribute(a: Attribute): void {
  if (!a.name || !a.source || !Number.isFinite(a.confidence) || a.confidence < 0 || a.confidence > 1) throw new Error('invalid attribute');
  if (a.value == null) {
    if (!a.unknown_reason || a.confidence !== 0) throw new Error(`${a.name}: unknown_reason required`);
    return;
  }
  if (!a.evidence.length || a.evidence.some(e => !e.ref || !e.extractor_version || !Number.isFinite(Date.parse(e.captured_at)))) throw new Error(`${a.name}: evidence required`);
  if (a.source === 'you_said' && !a.evidence.some(e => e.kind === 'owner')) throw new Error(`${a.name}: owner evidence required`);
}

export function mergeAttribute(current: Attribute, next: Attribute, actor: 'user' | 'auto'): Attribute {
  checkAttribute(next);
  if (current.name !== next.name) throw new Error('attribute name mismatch');
  if (actor === 'auto' && (current.confirmed || current.source === 'you_said')) return structuredClone(current);
  if (actor === 'user' && next.source !== 'you_said') throw new Error('user edits require you_said');
  return structuredClone(next);
}

export async function assembleCard(user_id: string, item_id: string, port: CardPort, log: Log): Promise<Card> {
  const seen = new Set<string>();
  async function read(id: string): Promise<Card> {
    if (seen.has(id)) throw new Error('duplicate or cyclic part');
    seen.add(id);
    const row = await log.call('db', 'card.read', { user_id, item_id: id }, () => port.read(user_id, id), r => ({ found: Boolean(r) }));
    if (!row || row.item.user_id !== user_id || row.item.id !== id) throw new Error('not_found');
    if (!Number.isSafeInteger(row.item.quantity) || row.item.quantity < 0) throw new Error('invalid quantity');
    row.attributes.forEach(checkAttribute);
    if (new Set(row.attributes.map(a => a.name)).size !== row.attributes.length) throw new Error('duplicate attribute');
    const parts: Card[] = [];
    for (const part_id of row.part_ids ?? []) {
      const part = await read(part_id);
      if (part.item.group_id !== id) throw new Error('part group mismatch');
      parts.push(part);
    }
    const realPhoto = row.photos.some(p => p.use === 'real' && p.file_ref);
    const filled = new Set(row.attributes.filter(a => a.value != null).map(a => a.name));
    if (realPhoto) filled.add('photo');
    const { part_ids: _ids, ...rest } = structuredClone(row);
    const card: Card = { ...rest, photos: [...rest.photos].sort((a, b) => Number(a.use === 'improved') - Number(b.use === 'improved')),
      listings: rest.listings.map(l => ({ ...l, missing_fields: l.required_fields.filter(f => !filled.has(f)) })), parts,
      asked: realPhoto ? [] : [{ kind: 'missing_shot', item_id: id, role: 'front' }] };
    log.event('state.change', { entity: 'item', id, to: row.item.state, parts_count: parts.length, missing_count: card.asked.length });
    return card;
  }
  try { return await read(item_id); } catch (e) { log.error('card.assemble', e); throw e; }
}
