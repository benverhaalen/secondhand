// Rests-on: spec/engines/capture.md "The paid visual rung" (Nate: "yes", and "Yes, wire Lens", 2026-11-15).
// Lens is on only when the server holds TREG_TOKEN and knows its public address (SECONDHAND_PUBLIC_ORIGIN): Google
// fetches the crop from our own single-use address, so a server nobody can reach must not pay for a call. The token
// is read by presence here and handed to the port; it is never logged.
import { randomBytes } from 'node:crypto';
import type { Log } from '../../../../log/index.js';
import type { IdentifyPorts } from '../../engines/capture/identify/identify.ts';
import type { ParamStore } from '../../engines/param/param.ts';
import { ports as lensRoute } from '../api/lens.ts';
import { lensPort, type LensKV } from './lens.ts';
import { createSpend } from './spend.ts';

type Env = Record<string, string | undefined>;
type Deps = {kv: LensKV & {take(namespace: string, key: string): unknown}; log: Log; now: () => number; params: ParamStore; env?: Env};

// The phone's photo reaches identify as a data: address of its stored bytes (captures.ts startIdentify).
export function bytesOf(file_ref: string): Uint8Array {
  const match = /^data:[^;,]+;base64,(.*)$/s.exec(file_ref);
  if (!match) throw new TypeError('Lens photo is not a stored image');
  return new Uint8Array(Buffer.from(match[1], 'base64'));
}

let spend: ReturnType<typeof createSpend> | undefined;

// The ports for one capture's identify run: a visual port when Lens is on, none otherwise.
export function lensPortsFor(capture_id: string, {kv, log, now, params, env = process.env}: Deps): IdentifyPorts {
  const token = env.TREG_TOKEN, origin = env.SECONDHAND_PUBLIC_ORIGIN?.replace(/\/+$/, '');
  if (!token || !origin) return {};
  lensRoute.kv = kv;
  spend ??= createSpend({kv, params, log, now});
  return {visual: lensPort({read: async file_ref => bytesOf(file_ref), kv, spend, capture_id, origin, token,
    fetch: (url, init) => fetch(url, init), params, log, now, random: size => randomBytes(size)})};
}

export function lensOn(env: Env = process.env): boolean {
  return !!env.TREG_TOKEN && !!env.SECONDHAND_PUBLIC_ORIGIN;
}
