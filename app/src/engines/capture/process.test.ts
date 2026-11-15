import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { FAMILIES, processFor } from './process.ts';

// parity: python's process_for is the reference; every family, with and without LiDAR, rigid or not
const script = [
  'import json, sys',
  "sys.path.insert(0, 'jobs')",
  'from capture.process import FAMILIES, process_for',
  "print(json.dumps({f'{f}|{l}|{r}': process_for(f, l, r) for f in FAMILIES for l in (True, False) for r in (True, False)}))",
].join('\n');
const root=new URL('../../../../',import.meta.url);
const venv=[fileURLToPath(new URL('.venv/bin/python',root)),fileURLToPath(new URL('.venv/Scripts/python.exe',root))].find(existsSync);
const python=venv ?? (process.platform === 'win32' ? 'python' : 'python3');
const py = JSON.parse(execFileSync(python, ['-c', script], { encoding: 'utf8', cwd: root }));

test('14 families, never 15', () => {
  assert.equal(FAMILIES.length, 14);
  assert.ok(FAMILIES.includes('other'));
});

test('the same steps as process.py for every family, LiDAR or not, rigid or not', () => {
  for (const f of FAMILIES) for (const l of [true, false]) for (const r of [true, false])
    assert.deepEqual(processFor(f, l, { rigid: r }), py[`${f}|${l ? 'True' : 'False'}|${r ? 'True' : 'False'}`], `${f} lidar=${l} rigid=${r}`);
});

test('literal expectations', () => {
  assert.deepEqual(processFor('apparel', true).map((s) => s.role), ['front', 'back', 'tag']);
  assert.deepEqual(processFor('nonsense', true), processFor('other', true));
  assert.deepEqual(processFor('shoes', false)[0], { step: 'ring', kind: 'series', role: 'side', needs_lidar: false, seconds: 30, frames: 8, measured_to: 'lookup' });
  assert.equal(processFor('shoes', true)[0].role, 'spin');
  assert.deepEqual(processFor('electronics', true, { kind: 'phones' }).map(s=>s.step),['about_screenshot','front_screen_on','back']);
});

test('phone and laptop kinds and desktop fallback match the Python process',()=>{
  const script=[
    'import json, sys',"sys.path.insert(0, 'jobs')",'from capture.process import process_for',
    "print(json.dumps({f'{k}|{l}': process_for('electronics', l, kind=k) for k in ('phones', 'laptops', 'desktops') for l in (True, False)}))",
  ].join('\n');
  const expected=JSON.parse(execFileSync(python,['-c',script],{encoding:'utf8',cwd:root}));
  for(const kind of ['phones','laptops','desktops'])for(const hasLidar of [true,false])
    assert.deepEqual(processFor('electronics',hasLidar,{kind}),expected[`${kind}|${hasLidar?'True':'False'}`]);
});
