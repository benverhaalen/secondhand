import assert from 'node:assert/strict';
import { test } from 'node:test';
import { utf8Decoder } from './utf8.ts';

const text = 'Levi’s 501 · 48 read · 🦊 Ólafur';
const bytes = new TextEncoder().encode(text);

test('every split of a mixed text into two chunks decodes to the same text', () => {
  for (let cut = 0; cut <= bytes.length; cut++) {
    const d = utf8Decoder();
    assert.equal(d.decode(bytes.slice(0, cut)) + d.decode(bytes.slice(cut)) + d.decode(), text, `cut at ${cut}`);
  }
});

test('one byte at a time decodes the same, and a malformed byte becomes U+FFFD as TextDecoder makes it', () => {
  const d = utf8Decoder();
  assert.equal([...bytes].map(b => d.decode(Uint8Array.of(b))).join('') + d.decode(), text);
  const bad = Uint8Array.of(0x61, 0xff, 0x62);
  assert.equal(utf8Decoder().decode(bad), new TextDecoder().decode(bad));
});

test('a character cut off at the end of the stream is flushed as U+FFFD', () => {
  const d = utf8Decoder();
  assert.equal(d.decode(Uint8Array.of(0xe2, 0x80)), '');
  assert.equal(d.decode(), '�');
});
