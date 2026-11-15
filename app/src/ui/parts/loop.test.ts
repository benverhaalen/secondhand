import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

type Props = {
  [key: string]: unknown;
  children?: Element;
  onPress?: () => void;
  onChangeText?: (value: string) => void;
  onBlur?: () => void;
  onSubmitEditing?: () => void;
};
type Element = { type: string | Component; props: Props };
type Component = (props: Props) => Element;

// Run the real component handlers with native views as leaves; Node cannot load React Native.
function field(kind: 'Blank' | 'Guess', props: Props = {}) {
  const states = new Map<Component, unknown[]>();
  let current: unknown[] = [], cursor = 0;
  const jsx = (type: Element['type'], props: Props): Element => ({ type, props });
  const modules: Record<string, unknown> = {
    react: { useState(initial: unknown) {
      const slot = cursor++, state = current;
      if (!(slot in state)) state[slot] = initial;
      return [state[slot], (value: unknown) => { state[slot] = value; }];
    } },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { TextInput: 'TextInput', View: 'View' },
    '../fonts': { FACE: { text: 'text' } },
    '../icon': { Icon: 'Icon' },
    '../press': { Press: 'Press' },
    '../text': { Txt: 'Txt' },
    '../theme': { useColors: () => ({}), useGround: () => 'field' },
    '../tokens.generated': { size: {}, space: {}, type: { t18: { fontSize: 18 }, t15: { fontSize: 15 }, t50: { fontSize: 50 } }, weight: {} },
    './buttons': { FootButton: 'FootButton' },
    './mark': { mark: () => ({}) },
  };
  const output = ts.transpileModule(readFileSync(new URL('./loop.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports: { Blank?: Component; Guess?: Component } = {};
  runInNewContext(output, { exports, require: (name: string) => {
    assert.ok(name in modules, `unexpected component dependency: ${name}`);
    return modules[name];
  } });
  const component = exports[kind];
  assert.ok(component);
  const changes: string[] = [];
  let value = typeof props.value === 'string' ? props.value : '';
  function render(): Element {
    let element: Element = { type: component!, props: {
      id: 'field', name: 'Price', ...props, value,
      onChange: (next: string) => { changes.push(next); value = next; },
    } };
    for (;;) {
      if (typeof element.type === 'function') {
        current = states.get(element.type) ?? [];
        states.set(element.type, current);
        cursor = 0;
        element = element.type(element.props);
      } else if (element.type === 'View') {
        assert.ok(element.props.children);
        element = element.props.children;
      } else return element;
    }
  }
  return {
    changes, render,
    open() { const element = render(); assert.equal(element.type, 'Press'); assert.ok(element.props.onPress); element.props.onPress(); },
    type(next: string) { const element = render(); assert.equal(element.type, 'TextInput'); assert.ok(element.props.onChangeText); element.props.onChangeText(next); },
    commit(event: 'onBlur' | 'onSubmitEditing') { const handler = render().props[event]; assert.ok(handler); handler(); },
    value: () => value,
  };
}

test('Blank without live hands nothing up before blur, preserving callers that replace it on change', () => {
  const blank = field('Blank');
  blank.open();
  blank.type('4');
  blank.type('45');
  assert.deepEqual(blank.changes, []);
  assert.equal(blank.render().props.value, '45');
  blank.commit('onBlur');
  assert.deepEqual(blank.changes, ['45']);
});

test('Blank with live false remains commit-only on Return', () => {
  const blank = field('Blank', { live: false });
  blank.open();
  blank.type('45');
  assert.deepEqual(blank.changes, []);
  blank.commit('onSubmitEditing');
  assert.deepEqual(blank.changes, ['45']);
});

test('Blank with live hands every character up before a separate button reads the amount', () => {
  const blank = field('Blank', { live: true, numeric: true });
  blank.open();
  assert.equal(blank.render().props.keyboardType, 'decimal-pad');
  blank.type('4');
  blank.type('45');
  assert.deepEqual(blank.changes, ['4', '45']);
  assert.equal(blank.value(), '45');
  assert.equal(blank.render().props.value, '45');
  blank.commit('onBlur');
  assert.deepEqual(blank.changes, ['4', '45'], 'blur must not repeat a live value already handed up');
});

test('Blank with live hands a cleared answer up before Use this reads it', () => {
  const blank = field('Blank', { live: true, value: 'Brand' });
  blank.open();
  blank.type('');
  assert.equal(blank.value(), '');
  assert.deepEqual(blank.changes, ['']);
});

test('an unchanged Blank does not emit a change when blurred', () => {
  const blank = field('Blank', { value: '45' });
  blank.open();
  blank.commit('onBlur');
  assert.deepEqual(blank.changes, []);
});

for (const event of ['onBlur', 'onSubmitEditing'] as const) {
  test(`Guess stays commit-only and confirms an unchanged guess on ${event}`, () => {
    const guess = field('Guess', { value: '45' });
    guess.open();
    guess.commit(event);
    assert.deepEqual(guess.changes, ['45']);
  });
}

test('Guess does not hand an edited draft up until blur', () => {
  const guess = field('Guess', { value: '45' });
  guess.open();
  guess.type('50');
  assert.deepEqual(guess.changes, []);
  guess.commit('onBlur');
  assert.deepEqual(guess.changes, ['50']);
});
