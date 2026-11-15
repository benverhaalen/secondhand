// The two faces (Art. 6): PP Neue Montreal Medium for every word, Clofie SemiBold for the wordmark and the screen title.
// The files are licensed and never committed (.gitignore). `npm run fonts` in app/ (scripts/fonts.mjs, run before start,
// ios and android) copies them into app/assets/fonts/ from fonts/ at the repo root or $SECONDHAND_FONTS. When they are
// missing the app still builds, because the folder is read with require.context, and falls back to the platform's face.
import { Asset } from 'expo-asset';
import { useFonts } from 'expo-font';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { font, weight } from './tokens.generated';

const files = require.context('../../assets/fonts', false, /\.(otf|ttf)$/);
// Case is ignored: a Mac's disk does not care, and Metro's file map does, so ./Ppneuemontreal-Medium.otf would load on one and not the other.
const find = (f: string): number | undefined => { const k = files.keys().find((n: string) => n.toLowerCase().endsWith(f.toLowerCase())); return k ? files(k) : undefined; };

// On the web the names are the ones tokens.css uses, so the brand check knows them; on a phone, the key passed to useFonts.
const FACES = [
  { name: font.text, key: 'PPNeueMontreal-Medium', file: find('ppneuemontreal-medium.otf'), weight: weight.text },
  { name: font.display, key: 'Clofie-SemiBold', file: find('Clofie-SemiBold.ttf'), weight: weight.display },
] as const;
const [TEXT, DISPLAY] = FACES;

// Never system-ui on the web: it can resolve to an Inter-derived face (tokens.css, --font-text). Inter is banned (Art. 6).
const WEB_TAIL = '"Noto Sans", -apple-system, "Helvetica Neue", sans-serif';
const web = Platform.OS === 'web';
const on = (f: (typeof FACES)[number]) => f.file != null;
export const FACE = {
  // On the web the brand names always lead, even with no files (CI): the brand check reads the declared face, and a
  // browser with the face installed uses it.
  text: web ? `"${TEXT.name}", ${WEB_TAIL}` : on(TEXT) ? TEXT.key : undefined,
  display: web
    ? `"${DISPLAY.name}", "${TEXT.name}", ${WEB_TAIL}`
    : on(DISPLAY) ? DISPLAY.key : on(TEXT) ? TEXT.key : undefined,
} as { text: string | undefined; display: string | undefined };
// True when a phone build has no brand faces: the screen draws in the platform's face, and the dev build says so once.
export const MISSING_FACES = !web && !FACES.every(on);
if (MISSING_FACES && typeof __DEV__ !== 'undefined' && __DEV__) console.warn('secondhand: brand fonts missing from app/assets/fonts; run `npm run fonts` in app/');

const nativeMap: Record<string, number> = web ? {} : Object.fromEntries(FACES.filter(on).map(f => [f.key, f.file as number]));

// On the web each face is declared at its one weight, so the browser never fakes a bold (Art. 6: no faux bold).
// It is never ready on the first render, even with no faces to load: the static export renders on the server at 0 by 0,
// and a first client render that hydrates that markup keeps its sizes (the camera drew 0 wide and the plan sheet ran off
// the top on a checkout with no fonts, the website thread, 2026-11-15 10:41). Drawing after mount draws fresh, as it
// always did when there were faces to wait for.
function useWebFaces(): boolean {
  const [ready, setReady] = useState(!web);
  useEffect(() => {
    if (ready || typeof document === 'undefined') return;
    if (!FACES.some(on)) { setReady(true); return; }
    const css = FACES.filter(on).map(f => `@font-face{font-family:"${f.name}";src:url("${Asset.fromModule(f.file as number).uri}");font-weight:${f.weight};font-style:normal;font-display:block}`).join('\n');
    const el = document.createElement('style');
    el.textContent = css;
    document.head.appendChild(el);
    const done = () => setReady(true);
    Promise.all(FACES.filter(on).map(f => document.fonts.load(`${f.weight} 16px "${f.name}"`))).then(done, done);
  }, [ready]);
  return ready;
}

// True once the faces are ready, or right away when there are none to load.
export function useBrandFonts(): boolean {
  const [loaded, error] = useFonts(nativeMap);
  const webReady = useWebFaces();
  return web ? webReady : loaded || error != null || Object.keys(nativeMap).length === 0;
}
