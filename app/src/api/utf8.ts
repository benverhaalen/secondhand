// UTF-8 bytes to text, one chunk at a time, for the job stream: Hermes on iOS has no TextDecoder (.agents/checks/hermes.mjs).
// A character split across two chunks waits for the rest; a malformed byte becomes U+FFFD, as TextDecoder would make it.
export function utf8Decoder() {
  let held: number[] = [];
  return {
    decode(bytes?: Uint8Array): string {
      const b = bytes ? [...held, ...bytes] : held;
      let out = '', i = 0;
      while (i < b.length) {
        const x = b[i];
        const n = x < 0x80 ? 1 : x >= 0xc2 && x < 0xe0 ? 2 : x >= 0xe0 && x < 0xf0 ? 3 : x >= 0xf0 && x < 0xf5 ? 4 : 0;
        if (n === 0) { out += '�'; i++; continue; }
        if (i + n > b.length) { if (bytes) break; out += '�'; i = b.length; break; }
        let cp = n === 1 ? x : x & (0xff >> (n + 1)), ok = true;
        for (let k = 1; k < n; k++) { const y = b[i + k]; if ((y & 0xc0) !== 0x80) { ok = false; break; } cp = (cp << 6) | (y & 0x3f); }
        if (!ok) { out += '�'; i++; continue; }
        out += String.fromCodePoint(cp); i += n;
      }
      held = bytes ? b.slice(i) : [];
      return out;
    },
  };
}
