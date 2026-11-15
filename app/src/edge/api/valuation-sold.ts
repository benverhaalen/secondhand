import { searchSource, type SearchOpts } from '../intel/public/search.ts';
import { SOURCES } from '../intel/public/sources.ts';
import type { Search } from '../../engines/valuation/sold.ts';

export function soldSearch(opts: SearchOpts & { live_sites: readonly string[] }): Search {
  return async (site, query, signal) => {
    if (!opts.live_sites.includes(site)) return { rows: [], outcome: 'blocked', reason: 'live reads are disabled' };
    signal.throwIfAborted();
    const source = SOURCES.find(source => source.site === site)!;
    const result = await searchSource(source, query, 'sold', { ...opts, caller: 'person' });
    return { rows: result.rows.map(row => ({ ...row, external_id: row.id, state: row.sold ? 'sold' : 'live', sold_at: row.sold_date })),
      outcome: result.searched.outcome, reason: result.searched.reason };
  };
}
