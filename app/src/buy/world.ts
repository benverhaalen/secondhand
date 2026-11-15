// Which demo world a buy page renders and which state it is in, from the address (?world=buyer, ?state=loading; see
// app/src/demo/screen.ts), and links that keep the world, so the next page shows the same person. clearing, the person we
// build for, is the default (app/src/demo/README.md).
import type { Href } from 'expo-router';
import { useScreen } from '../demo/screen';
import type { World } from '../demo/index.ts';

export const usePage = () => useScreen();
export const useWorld = (): World => useScreen().w;

export const href = (w: World, path: string) => (w.name === 'clearing' ? path : `${path}${path.includes('?') ? '&' : '?'}world=${w.name}`) as Href;
