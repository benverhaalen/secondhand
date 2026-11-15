import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function nativeFiles(document) {
  const files = document?.result?.files;
  if (!Array.isArray(files)) throw new Error('Device response has no result.files array');
  return files.filter(file => basename(file.path ?? file.name ?? '').startsWith('secondhand'));
}
export function crashSummary(text) {
  return text.split('\n').flatMap(line => {
    try {
      const entry = JSON.parse(line.includes('SH_CRASH ') ? line.slice(line.indexOf('SH_CRASH ') + 9) : line);
      return entry?.error ? [entry] : [];
    } catch { return []; }
  }).sort((a, b) => String(b.ts ?? b.time).localeCompare(String(a.ts ?? a.time)));
}
export function collect(device, run = args => execFileSync('xcrun', ['devicectl', ...args], { encoding: 'utf8' })) {
  if (!device || !/^[a-zA-Z0-9-]+$/.test(device)) throw new Error('Usage: node scripts/phone-crashes.mjs <device-id>');
  const directory = resolve('logs/phone', device, new Date().toISOString().replaceAll(':', '-'));
  mkdirSync(directory, { recursive: true });
  let failures = 0, jsText = '';
  const consoleText = process.argv[3] ? readFileSync(process.argv[3], 'utf8') : '';
  const copy = (domain, source, destination, identifier) => {
    const args = ['device', 'copy', 'from', '--device', device, '--domain-type', domain];
    if (identifier) args.push('--domain-identifier', identifier);
    run([...args, '--source', source, '--destination', destination]);
  };
  try {
    const destination = resolve(directory, 'secondhand-crashes.jsonl');
    copy('appDataContainer', 'Documents/secondhand-crashes.jsonl', destination, 'dev.ben.secondhand');
    jsText = readFileSync(destination, 'utf8');
    const entries = crashSummary(jsText);
    console.log(`${entries.length} JS crash/error entries (newest first)`);
    for (const entry of entries) console.log(`${entry.ts ?? entry.time} ${entry.route}: ${entry.error.stack?.split('\n')[0] || entry.error.msg || entry.error.message}`);
  } catch (error) {
    failures++;
    console.error(`JS crash file unavailable (it may not exist yet): ${error.message}`);
  }
  try {
    const listing = resolve(directory, 'native-files.json');
    run(['device', 'info', 'files', '--device', device, '--domain-type', 'systemCrashLogs', '--json-output', listing]);
    const files = nativeFiles(JSON.parse(readFileSync(listing, 'utf8')))
      .sort((a, b) => String(b.modificationDate ?? b.name ?? b.path).localeCompare(String(a.modificationDate ?? a.name ?? a.path)));
    console.log(`${files.length} native crash reports (newest first)`);
    for (const file of files) {
      const source = file.path ?? file.name;
      try {
        const destination = resolve(directory, basename(source));
        copy('systemCrashLogs', source, destination);
        const text = readFileSync(destination, 'utf8');
        const summary = nativeSummary(text, jsText + '\n' + consoleText);
        console.log(`${basename(source)}: ${summary.time} ${summary.exception} ${summary.reason || nativeStackLine(text)}`);
      } catch (error) { failures++; console.error(`${source}: ${error.message}`); }
    }
  } catch (error) { failures++; console.error(`Native crash listing failed: ${error.message}`); }
  console.log(`Saved to ${directory}`);
  return failures ? 1 : 0;
}
function ips(text) {
  const newline = text.indexOf('\n');
  try { return { header: JSON.parse(text.slice(0, newline)), body: JSON.parse(text.slice(newline + 1)) }; }
  catch { try { return { header: {}, body: JSON.parse(text) }; } catch { return { header: {}, body: {} }; } }
}
function exceptionReason(value) {
  if (typeof value === 'string') return value.match(/Unhandled JS Exception: [^\r\n]+/)?.[0] ?? '';
  if (value && typeof value === 'object') return Object.values(value).map(exceptionReason).find(Boolean) ?? '';
  return '';
}
export function nativeSummary(text, consoleText = '') {
  const { header, body } = ips(text);
  const time = body.captureTime ?? header.timestamp ?? 'unknown time';
  const exception = body.exception?.type ?? 'unknown exception';
  let reason = exceptionReason(body);
  const second = value => { const ms = Date.parse(value); return Number.isFinite(ms) ? Math.floor(ms / 1000) : null; };
  if (!reason) {
    const entry = crashSummary(consoleText).find(e => second(time) !== null && second(e.ts ?? e.time) === second(time));
    if (entry) reason = `Unhandled JS Exception: ${entry.error.msg ?? entry.error.message ?? entry.error.stack}`;
  }
  if (!reason) {
    const line = consoleText.split('\n').find(line => {
      const stamp = line.match(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/);
      return stamp && second(time) !== null && second(stamp[0]) === second(time) && line.includes('Unhandled JS Exception:');
    });
    reason = exceptionReason(line);
  }
  return { time, exception, reason };
}
export function nativeStackLine(text) {
  const body = ips(text).body;
  const triggered = body.threads?.find(t => t.triggered) ?? body.threads?.[body.faultingThread];
  if (triggered?.frames?.length) return JSON.stringify(triggered.frames[0]);
  const lines = text.split('\n');
  for (const line of lines) {
    try {
      const report = JSON.parse(line.includes('SH_CRASH ') ? line.slice(line.indexOf('SH_CRASH ') + 9) : line);
      const thread = report.threads?.find(thread => thread.triggered) ?? report.threads?.[report.faultingThread];
      if (thread?.frames?.length) return JSON.stringify(thread.frames[0]);
    } catch {}
  }
  const crashed = lines.findIndex(line => /^Thread \d+ Crashed:/.test(line));
  return crashed >= 0 ? lines[crashed + 1] ?? '' : lines[0] ?? '';
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try { process.exitCode = collect(process.argv[2]); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
