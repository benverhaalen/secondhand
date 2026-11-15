import { createCrashRecorder } from './crash.js';

export function createNativeRecorder({ Constants, File, Paths, AppState, Platform }) {
  let memory = '', sent = '';
  const file = (name) => new File(Paths.document, name);
  function read(name) { const f = file(name); return f.exists ? f.textSync() : ''; }
  function append(name, line) { const f = file(name); if (!f.exists) f.create(); f.writeSync(line, { append: true }); }
  const crashes = 'secondhand-crashes.jsonl', acknowledgements = 'secondhand-crashes-sent.jsonl';
  const recorder = createCrashRecorder({
    storage: {
      read: () => Platform.OS === 'web' ? memory : read(crashes),
      append: line => { if (Platform.OS === 'web') memory += line; else append(crashes, line); },
      sent: () => Platform.OS === 'web' ? sent : read(acknowledgements),
      acknowledge: line => { if (Platform.OS === 'web') sent += line; else append(acknowledgements, line); },
    },
    build: `${Constants.expoConfig?.version ?? 'unknown'}+${Constants.platform?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode ?? 'unknown'}`,
    print: line => console.log(line),
    origin: () => process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? null,
    fetch: (...args) => fetch(...args),
  });
  recorder.install(globalThis, callback => { AppState.addEventListener('change', callback); });

  return recorder;
}
