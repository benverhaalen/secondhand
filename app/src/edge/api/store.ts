// The one Store every /v1 route and the events pipeline reads and writes.
import { db } from '../store/db.ts';
import { sqliteStore } from '../events/sqlite-store.ts';
import type { Store, StoreState } from '../events/ports.ts';

const sqlite = sqliteStore(db());
export const store: Store & { dump(): StoreState } = sqlite;
// Only the server entry calls this, once at boot: running jobs go back to queued and claims are dropped.
export const recoverStore = (skip?: Parameters<typeof sqlite.recover>[0]): number => sqlite.recover(skip);
