// The window's size, never zero. On the web the static export renders on the server, where the window is 0 by 0, and when
// nothing holds the first client render back (no brand fonts to wait for, as on a checkout without them) react-native-web
// keeps that 0 by 0: the camera's circle drew 90 wide at -45, and the plan sheet lost its height limit and ran off the top
// (the website thread, 2026-11-15 10:41). Every part reads the window here; .agents/checks/standards.mjs N3 holds it.
import { Platform, useWindowDimensions, type ScaledSize } from 'react-native';

export function useWindow(): ScaledSize {
  const d = useWindowDimensions();
  if ((d.width && d.height) || Platform.OS !== 'web' || typeof window === 'undefined') return d;
  return { ...d, width: window.innerWidth, height: window.innerHeight };
}
