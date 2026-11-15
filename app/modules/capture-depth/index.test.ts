import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import type { NativeSyntheticEvent } from 'react-native';
import type { CaptureDepthError, Extent } from './index.ts';
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
    if (specifier === 'expo') return { url: 'data:text/javascript,' + encodeURIComponent(source), shortCircuit: true };
    if (specifier === 'react-native') return { url: 'data:text/javascript,export const Platform = { OS: "web" };', shortCircuit: true };
    return nextResolve(specifier, context);
  } });
  try {
    const path = './index.ts?present';
    const { capabilities, CaptureDepthView }: typeof import('./index.ts') = await import(path);
    assert.deepEqual(await capabilities(), { has_lidar: true, object_capture: false });
    let received: Extent | undefined, failure: CaptureDepthError | undefined;
    const view = CaptureDepthView({ onExtent: event => { received = event.nativeEvent; }, onError: event => { failure = event.nativeEvent; } });
    assert.ok(view);
    const extent: Extent = { extent_cm: { width: 30, depth: 20, height: 10 }, extent_conf: 0, rigid: true, frames: 12 };
    view.props.onExtent?.({ nativeEvent: extent } as NativeSyntheticEvent<Extent>);
    view.props.onError?.({ nativeEvent: { code: 'camera_permission_denied' } } as NativeSyntheticEvent<CaptureDepthError>);
    view.props.onStatus({ nativeEvent: { state: 'running' } } as NativeSyntheticEvent<{ state: string }>);
    assert.equal(received, extent);
    assert.deepEqual(failure, { code: 'camera_permission_denied' });
    assert.ok(globalThis.__log?.some(line => line.includes('capture depth frame measured')));
    assert.ok(globalThis.__log?.some(line => line.includes('camera_permission_denied')));
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
