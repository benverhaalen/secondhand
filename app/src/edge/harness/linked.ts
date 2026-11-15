import type { Accounts } from '../browser/auth.ts';
import type { Site } from './protocol.ts';

// The watcher scheduler reads its accounts synchronously each tick; this keeps that list equal to the linked rows,
// refreshed before each tick, so a site the person did not link is never swept or scheduled.
// sites: the sites the caller serves (the scheduler's own site list), so its rows are typed to them.
export function linkedList<S extends Site>(accounts: Accounts, sites: readonly S[], person_id?: string) {
  let rows: { account_id: string; site: S; user_id: string }[] = [];
  const serves = (s: Site): s is S => (sites as readonly Site[]).includes(s);
  return {
    async refresh() {
      rows = (await accounts.linked(person_id)).flatMap(a => serves(a.site) ? [{ account_id: a.account_id, site: a.site, user_id: a.person_id }] : []);
    },
    list: () => rows,
  };
}
