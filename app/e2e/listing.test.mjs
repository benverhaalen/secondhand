// The listing page's behavior (app/behavior/listing/[id].json), on the web build: every state and every control in the table.
import { test } from 'node:test';
import { tableTests } from './table-tests.mjs';

tableTests(test, 'listing/[id]', 'listing');
