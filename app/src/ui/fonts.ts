// The two faces (Art. 6): PP Neue Montreal Medium for every word, Clofie SemiBold for the wordmark.
// The files are licensed and never committed (.gitignore). `npm run fonts` in app/ (scripts/fonts.mjs, run before start,
// ios and android) copies them into app/assets/fonts/ from fonts/ at the repo root or $SECONDHAND_FONTS. When they are
// missing the app still builds, because the folder is read with require.context, and draws the open pair below.
import { Asset } from 'expo-asset';
import { useFonts } from 'expo-font';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { log } from './log';
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

// The open pair (agent proposal, Nate 2026-11-15; brand/explore/open-fallback/): committed in assets/fonts-open/ under
// the OFL, so these are always present. They draw where a brand file is missing. On the web size-adjust matches the
// brand x-height (.510 and .500) and the overrides are the brand's ascent, descent and gap divided by it; a phone has
// no such CSS, so there the face draws at its own size and metrics.
const OPEN = {
  text: { name: 'Hanken Grotesk', key: 'HankenGrotesk-Medium', file: require('../../assets/fonts-open/hanken-grotesk/HankenGrotesk-Medium.ttf') as number, weight: weight.text,
    css: 'size-adjust:103.45%;ascent-override:92.6%;descent-override:23.4%;line-gap-override:0%' },
  display: { name: 'Outfit', key: 'Outfit-SemiBold', file: require('../../assets/fonts-open/outfit/Outfit-SemiBold.ttf') as number, weight: weight.display,
    css: 'size-adjust:103.5%;ascent-override:72.5%;descent-override:24.2%;line-gap-override:9.7%' },
} as const;
const OPENS = [OPEN.text, OPEN.display];

// Never system-ui on the web: it can resolve to an Inter-derived face (tokens.css, --font-text). Inter is banned (Art. 6).
const WEB_TAIL = '"Noto Sans", -apple-system, "Helvetica Neue", sans-serif';
const web = Platform.OS === 'web';
const on = (f: (typeof FACES)[number]) => f.file != null;
export const FACE = {
  // On the web the brand names always lead, even with no files (CI): the brand check reads the declared face, and a
  // browser with the face installed uses it. The open names follow, as in tokens.css.
  text: web ? `"${TEXT.name}", "${OPEN.text.name}", ${WEB_TAIL}` : on(TEXT) ? TEXT.key : OPEN.text.key,
  display: web
    ? `"${DISPLAY.name}", "${OPEN.display.name}", "${TEXT.name}", "${OPEN.text.name}", ${WEB_TAIL}`
    : on(DISPLAY) ? DISPLAY.key : OPEN.display.key,
} as { text: string; display: string };
// True when a phone build has no brand faces: the screen draws in the open pair, and the dev build says so once.
export const MISSING_FACES = !web && !FACES.every(on);
if (MISSING_FACES && typeof __DEV__ !== 'undefined' && __DEV__) log.note('brand fonts missing from app/assets/fonts, drawing in the open pair; run npm run fonts in app/');

// Both open faces always load on a phone (56 and 68 KB), so a brand file that appears later needs no code change.
const nativeMap: Record<string, number> = web ? {} : Object.fromEntries([...FACES.filter(on).map(f => [f.key, f.file as number]), ...OPENS.map(f => [f.key, f.file])]);

// On the web each face is declared at its one weight, so the browser never fakes a bold (Art. 6: no faux bold).
// It is never ready on the first render, even with no faces to load: the static export renders on the server at 0 by 0,
// and a first client render that hydrates that markup keeps its sizes (the camera drew 0 wide and the plan sheet ran off
// the top on a checkout with no fonts, the website thread, 2026-11-15 10:41). Drawing after mount draws fresh, as it
// always did when there were faces to wait for.
function useWebFaces(): boolean {
  const [ready, setReady] = useState(!web);
  useEffect(() => {
    if (ready || typeof document === 'undefined') return;
    const rule = (f: { name: string; file: unknown; weight: string | number }, extra = '') => `@font-face{font-family:"${f.name}";src:url("${Asset.fromModule(f.file as number).uri}");font-weight:${f.weight};font-style:normal;font-display:block${extra}}`;
    const brand = FACES.filter(on);
    const el = document.createElement('style');
    el.textContent = [...brand.map(f => rule(f)), ...OPENS.map(f => rule(f, `;${f.css}`))].join('\n');
    document.head.appendChild(el);
    const done = () => setReady(true);
    Promise.all([...brand, ...OPENS].map(f => document.fonts.load(`${f.weight} 16px "${f.name}"`))).then(done, done);
  }, [ready]);
  return ready;
}

// True once the faces are ready, or right away when there are none to load.
export function useBrandFonts(): boolean {
  const [loaded, error] = useFonts(nativeMap);
  const webReady = useWebFaces();
  return web ? webReady : loaded || error != null || Object.keys(nativeMap).length === 0;
}
