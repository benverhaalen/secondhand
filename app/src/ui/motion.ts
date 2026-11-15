import { motion } from './tokens.generated';

// Every motion in the app, named once, with what it is for (frontend-standard §3, "Purpose or nothing").
// A screen takes its duration from here. The check in .agents/checks/picks.mjs (M2, M4) fails a raw duration in a screen
// and a row here with no reason. A spring has no duration; it settles on its own and can be interrupted.
export type Why = 'feedback' | 'origin' | 'state' | 'progress' | 'story' | 'recognition';

export const MOTIONS: Record<string, { why: Why; ms: number | 'spring' }> = {
  press: { why: 'feedback', ms: 'spring' },
  openItem: { why: 'origin', ms: 'spring' },
  sheet: { why: 'origin', ms: motion.panel },
  select: { why: 'state', ms: motion.select },
  tileMoves: { why: 'state', ms: motion.select },
  fieldsFill: { why: 'progress', ms: motion.feedback },
  sold: { why: 'recognition', ms: 'spring' },
  drift: { why: 'recognition', ms: 'spring' },
};
