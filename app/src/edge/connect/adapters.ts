import type { Store } from '../events/ports.ts';
import { isWrite, type Adapter } from '../harness/protocol.ts';
import { depopAdapters } from '../harness/sites/depop/adapter.ts';
import { poshmarkAdapters } from '../harness/sites/poshmark/adapter.ts';
import { mercariAdapters } from '../harness/sites/mercari/adapter.ts';
import { ebayPageAdapters } from '../harness/sites/ebay/adapter.ts';

export function withProfileRead(adapter: Adapter, store: Store): Adapter {
  if (isWrite(adapter.manifest.verb)) return adapter;
  return { ...adapter, async run(args, signal) {
    const user_id = typeof args.person_id === 'string' ? args.person_id : undefined;
    const account_id = typeof args.account_id === 'string' ? args.account_id : undefined;
    const row = user_id && account_id ? store.get('account', user_id, account_id) : undefined;
    if (!row?.profile_id || row.state !== 'linked' || row.deleted) return adapter.run(args, signal);
    const { hostedConnections } = await import('./hosted.ts');
    const client = hostedConnections(), owner = { user_id: user_id!, account_id: account_id! };
    const site = adapter.manifest.site;
    const candidates = site === 'depop' ? depopAdapters(await client.clientFor(site, owner))
      : site === 'poshmark' ? poshmarkAdapters(await client.clientFor(site, owner))
      : site === 'mercari' ? mercariAdapters(await client.clientFor(site, owner))
      : site === 'ebay' ? ebayPageAdapters(await client.clientFor(site, owner)) : [];
    const linked = candidates.find(candidate => candidate.route_id === adapter.route_id);
    return (linked ?? adapter).run(args, signal);
  } };
}
