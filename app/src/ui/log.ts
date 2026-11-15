// The app's one log (log/README.md): every tap goes through here, from Press, so a test can replay what the person did.
// On the web each tap is also pushed to globalThis.__events, which the Playwright tests read.
import { Platform } from 'react-native';
import { createLog } from '../../../log/index.js';

export type UiEvent = { type: 'tap'; id: string; screen: string };

// The last lines, kept in memory until a sink to the server is wired (log/README.md, "Wire a new program").
const lines: string[] = [];
const sink = (line: string) => { lines.push(line); if (lines.length > 2000) lines.shift(); };
export const log = createLog({ src: 'app', build: 'dev', sink, config: { platform: Platform.OS } });

declare global {
  // eslint-disable-next-line no-var
  var __events: UiEvent[] | undefined;
  // eslint-disable-next-line no-var
  var __log: string[] | undefined;
}
if (Platform.OS === 'web') globalThis.__log = lines;

export function tap(id: string, screen: string) {
  // user.input, the event spec/events.json names for a tap (log/README.md: "The person taps, picks or types").
  log.event('user.input', { screen, control: id, value: 'tap' });
  if (Platform.OS === 'web') (globalThis.__events ??= []).push({ type: 'tap', id, screen });
}
