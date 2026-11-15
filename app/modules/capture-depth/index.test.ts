import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import type { NativeSyntheticEvent } from 'react-native';
import type { CaptureDepthError, CaptureDepthStatus, Extent } from './index.ts';
import { checkLog } from '../../../spec/log.mjs';

test('absent native module resolves false capabilities and renders nothing without loading a native view', async () => {
  const source = `
    export function requireOptionalNativeModule(name) {
      if (name !== 'CaptureDepth') throw new Error('wrong module name');
      return null;
    }
    export function requireNativeView() { throw new Error('absent native view requested'); }
  `;
  const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
    if (specifier === 'react-native') {
      return { url: 'data:text/javascript,export const Platform = { OS: "web" };', shortCircuit: true };
    }
    if (specifier === 'expo' && context.parentURL === new URL('./index.ts', import.meta.url).href) {
      return { url: 'data:text/javascript,' + encodeURIComponent(source), shortCircuit: true };
    }
    return nextResolve(specifier, context);
  } });
  try {
    const { capabilities, CaptureDepthView } = await import('./index.ts');
    assert.deepEqual(await capabilities(), { has_lidar: false, object_capture: false });
    assert.equal(CaptureDepthView({}), null);
  } finally {
    hooks.deregister();
  }
});

test('present module preserves capabilities, forwards extent and error events, and logs through the app logger', async () => {
  const source = `
    export function requireOptionalNativeModule() {
      return { capabilities: async () => ({ has_lidar: true, object_capture: false }) };
    }
    export function requireNativeView(name) {
      if (name !== 'CaptureDepth') throw new Error('wrong native view');
      return function NativeView() { return null; };
    }
  `;
  const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
    if (specifier === 'react' && context.parentURL?.includes('index.ts?present')) {
      const react = new URL('../../node_modules/react/index.js', import.meta.url).href;
      const source = `export { createElement } from '${react}'; const ref = { current: undefined }; export function useRef() { return ref; }`;
      return { url: 'data:text/javascript,' + encodeURIComponent(source), shortCircuit: true };
    }
    if (specifier === 'expo') return { url: 'data:text/javascript,' + encodeURIComponent(source), shortCircuit: true };
    if (specifier === 'react-native') return { url: 'data:text/javascript,export const Platform = { OS: "web" };', shortCircuit: true };
    return nextResolve(specifier, context);
  } });
  try {
    const path = './index.ts?present';
    const { capabilities, CaptureDepthView }: typeof import('./index.ts') = await import(path);
    assert.deepEqual(await capabilities(), { has_lidar: true, object_capture: false });
    let forwarded = 0;
    let received: Extent | undefined, failure: CaptureDepthError | undefined;
    const statuses: string[] = [];
    const distances: (number | null)[] = [];
    const view = CaptureDepthView({
      onExtent: event => { forwarded++; received = event.nativeEvent; },
      onError: event => { failure = event.nativeEvent; },
      onStatus: event => {
        statuses.push(event.nativeEvent.state);
        if (event.nativeEvent.state === 'distance') distances.push(event.nativeEvent.distance_m);
      },
    });
    assert.ok(view);
    const extent: Extent = { extent_cm: { width: 30, depth: 20, height: 10 }, extent_conf: 0, rigid: true, frames: 12, distance_m: 0.6 };
    view.props.onExtent?.({ nativeEvent: extent } as NativeSyntheticEvent<Extent>);
    view.props.onError?.({ nativeEvent: { code: 'camera_permission_denied' } } as NativeSyntheticEvent<CaptureDepthError>);
    view.props.onStatus({ nativeEvent: { state: 'running' } } as NativeSyntheticEvent<CaptureDepthStatus>);
    assert.equal(received, extent);
    assert.deepEqual(failure, { code: 'camera_permission_denied' });
    assert.ok(globalThis.__log?.some(line => line.includes('capture depth frame measured')));
    assert.ok(globalThis.__log?.some(line => line.includes('camera_permission_denied')));
    view.props.onStatus({ nativeEvent: { state: 'item_clipped' } } as NativeSyntheticEvent<CaptureDepthStatus>);
    assert.deepEqual(statuses, ['running', 'item_clipped']);
    assert.ok(globalThis.__log?.some(line => line.includes('item_clipped')));
    const loggedExtents = () => (globalThis.__log ?? []).filter(line => line.includes('capture depth frame measured')).length;
    const first = loggedExtents();
    const send = (width: number, depth: number, height: number) => {
      view.props.onExtent?.({ nativeEvent: { ...extent, extent_cm: { width, depth, height } } } as NativeSyntheticEvent<Extent>);
    };
    send(30, 20, 10);
    send(30.3, 20.3, 10.3);
    assert.equal(loggedExtents(), first, 'identical and sub-0.5 cm changes must not log');
    send(30.5, 20, 10);
    send(30.5, 19.5, 10);
    send(30.5, 19.5, 10.5);
    assert.equal(loggedExtents(), first + 3, 'each dimension logs at an absolute 0.5 cm change from the last log');
    assert.equal(forwarded, 6, 'all extent events reach the caller');
    const rerender = CaptureDepthView(view.props);
    assert.ok(rerender);
    rerender.props.onExtent?.({ nativeEvent: { ...extent, extent_cm: { width: 30.5, depth: 19.5, height: 10.5 } } } as NativeSyntheticEvent<Extent>);
    assert.equal(loggedExtents(), first + 3, 'rerender must preserve the last logged extent');
    const beforeDistance = (globalThis.__log ?? []).length;
    for (const distance_m of [0.6, 0.7, null]) {
      view.props.onStatus({ nativeEvent: { state: 'distance', distance_m } } as NativeSyntheticEvent<CaptureDepthStatus>);
    }
    assert.deepEqual(statuses.slice(-3), ['distance', 'distance', 'distance']);
    assert.deepEqual(distances, [0.6, 0.7, null], 'distance values and null survive forwarding');
    assert.equal((globalThis.__log ?? []).length, beforeDistance, 'distance telemetry must not flood status logs');
  } finally {
    hooks.deregister();
  }
});

test('native capability failures reject instead of being disguised as unsupported hardware', async () => {
  const source = `
    export function requireOptionalNativeModule() { return { capabilities: async () => { throw new Error('native failure'); } }; }
    export function requireNativeView() { return function NativeView() { return null; }; }
  `;
  const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
    if (specifier === 'expo') return { url: 'data:text/javascript,' + encodeURIComponent(source), shortCircuit: true };
    if (specifier === 'react-native') return { url: 'data:text/javascript,export const Platform = { OS: "web" };', shortCircuit: true };
    return nextResolve(specifier, context);
  } });
  try {
    const path = './index.ts?failure';
    const { capabilities }: typeof import('./index.ts') = await import(path);
    await assert.rejects(capabilities(), /native failure/);
    assert.deepEqual(checkLog((globalThis.__log ?? []).join('\n')).problems, []);
  } finally {
    hooks.deregister();
  }
});
