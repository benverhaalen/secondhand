// The one store every /v1 route reads and writes, the events stream's Store port (jobs, decisions, events).
// shortcut: in memory per edge process; swap memoryStore() for the Lakebase store when db-1 lands, in this one line.
import { memoryStore } from '../events/ports.ts';

export const store = memoryStore();
