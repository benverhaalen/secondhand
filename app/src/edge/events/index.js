// `node --test app/src/edge/events/` resolves the folder to this file; it loads every test here in one run.
const { readdirSync } = require('node:fs');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');
for (const f of readdirSync(__dirname).filter(f => f.endsWith('.test.ts')).sort()) import(pathToFileURL(join(__dirname, f)).href);
