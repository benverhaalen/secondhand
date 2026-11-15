// The two faces (Art. 6): PP Neue Montreal Medium for every word, Clofie SemiBold for the wordmark and the screen title.
// The files are licensed and never committed (.gitignore). Copy them into app/assets/fonts/; when they are missing the
// app falls back to the platform's own face and still builds, because the folder is read with require.context.
import { Asset } from 'expo-asset';
import { useFonts } from 'expo-font';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { font, weight } from './tokens.generated';

const files = require.context('../../assets/fonts', false, /\.(otf|ttf)$/);
const find = (f: string): number | undefined => (files.keys().some((k: string) => k.endsWith(f)) ? files('./' + f) : undefined);

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
  text: web ? [on(TEXT) && `"${TEXT.name}"`, WEB_TAIL].filter(Boolean).join(', ') : on(TEXT) ? TEXT.key : undefined,
  display: web
    ? [on(DISPLAY) && `"${DISPLAY.name}"`, on(TEXT) && `"${TEXT.name}"`, WEB_TAIL].filter(Boolean).join(', ')
    : on(DISPLAY) ? DISPLAY.key : on(TEXT) ? TEXT.key : undefined,
};

const nativeMap: Record<string, number> = web ? {} : Object.fromEntries(FACES.filter(on).map(f => [f.key, f.file as number]));

// On the web each face is declared at its one weight, so the browser never fakes a bold (Art. 6: no faux bold).
function useWebFaces(): boolean {
  const [ready, setReady] = useState(!web || !FACES.some(on));
  useEffect(() => {
    if (ready || typeof document === 'undefined') return;
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
