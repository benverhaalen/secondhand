// The one Store every /v1 route and the events pipeline reads and writes.
// shortcut: file-backed until the async Lakebase port lands.
import { join } from 'node:path';
import { memoryStore } from '../events/ports.ts';
import { fileStore } from '../events/file-store.ts';

export const store = process.env.SECONDHAND_DATA_DIR ? fileStore(join(process.env.SECONDHAND_DATA_DIR, 'store.json')) : memoryStore();
