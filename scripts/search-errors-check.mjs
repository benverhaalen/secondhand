#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { code } from '../.agents/checks/code.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
const findings = code(root, { files }).filter(f => /edge\/(?:harness|browser)\//.test(f.where));
process.stdout.write(`${JSON.stringify(findings, null, 2)}\n`);
if (findings.length) process.exitCode = 1;
