import type { Href } from 'expo-router';
import { useScreen } from '../demo/screen';
import type { World } from '../demo/index.ts';

export const usePage = () => useScreen();
export const useWorld = (): World => useScreen().w;

export const href = (w: World, path: string) => (w.name === 'live' || w.name === 'clearing' ? path : `${path}${path.includes('?') ? '&' : '?'}world=${w.name}`) as Href;
