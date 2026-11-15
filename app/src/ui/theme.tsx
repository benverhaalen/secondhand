// Light and dark, and what a part is sitting on. Dark changes color and nothing else (constitution Art. 5, Dark mode; L22),
// so a screen never asks which mode it is in: every part reads its colors from here.
import { createContext, useContext, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { color, colorDark } from './tokens.generated';

export type Palette = { readonly [K in keyof typeof color]: string };
export type Scheme = 'light' | 'dark';
// What a part lies on. It decides the second button's fill, the ring of a badge, and whether a tag goes white (C2).
export type Ground = 'page' | 'card' | 'field';

const LIGHT: Palette = color;
// The black pill has no glow in dark (Art. 5, Dark mode line 6).
const DARK: Palette = { ...color, ...colorDark, glow1: 'transparent', glow2: 'transparent' };

const SchemeCtx = createContext<Scheme | null>(null);
const GroundCtx = createContext<Ground>('page');

// Forces a mode for what is inside: the parts sheet shows both, and a card on a state gradient stays light (Art. 5, State gradients line 3).
export function Theme({ scheme, children }: { scheme: Scheme; children: ReactNode }) {
  return <SchemeCtx.Provider value={scheme}>{children}</SchemeCtx.Provider>;
}

export function useScheme(): Scheme {
  const forced = useContext(SchemeCtx);
  const system = useColorScheme();
  return forced ?? (system === 'dark' ? 'dark' : 'light');
}

export function useColors(): Palette {
  return useScheme() === 'dark' ? DARK : LIGHT;
}

export function OnGround({ ground, children }: { ground: Ground; children: ReactNode }) {
  return <GroundCtx.Provider value={ground}>{children}</GroundCtx.Provider>;
}

export function useGround(): Ground {
  return useContext(GroundCtx);
}
