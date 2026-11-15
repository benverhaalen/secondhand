import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FAMILIES, processFor } from '../engines/capture/process.ts';
import process from '../../../jobs/capture/process.json' with { type: 'json' };
import { SHOT, TYPES } from './shots.ts';

test('every capture family has one button on the pick page, and nothing else does', () => {
  assert.deepEqual(TYPES.map(t => t.type).sort(), [...FAMILIES].sort());
});

test('every step any family, kind or device can ask for has a coach', () => {
  const steps = new Set<string>();
  for (const rows of Object.values((process as { types: Record<string, { step: string }[]> }).types)) for (const r of rows) steps.add(r.step);
  for (const family of FAMILIES) for (const lidar of [true, false]) for (const rigid of [true, false]) for (const s of processFor(family, lidar, { rigid })) steps.add(s.step);
  const missing = [...steps].filter(s => !SHOT[s]);
  assert.deepEqual(missing, []);
});
