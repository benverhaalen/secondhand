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
  shelfFold: { why: 'state', ms: motion.select },     // a Sell shelf folds or opens from its header; the chevron turns (Ben, 06:19)
  fieldsFill: { why: 'progress', ms: motion.feedback },
  sold: { why: 'recognition', ms: 'spring' },
  drift: { why: 'recognition', ms: 'spring' },
  // New and the camera (spec/pages.md §6.4, §6.5; frontend-standard §3 "Open New", "The camera reads the item").
  newOpen: { why: 'origin', ms: motion.panel },       // the ＋ grows into the circle that covers the screen
  newChoice: { why: 'origin', ms: motion.select },    // each choice rises out of the button, 30 ms after the one before
  cameraOpen: { why: 'origin', ms: motion.panel },    // the camera opens out of the choice that was touched
  stageDone: { why: 'state', ms: motion.select },     // a stage bubble fills to a check
  foundDrop: { why: 'progress', ms: 250 },            // what the camera read drops in from above the feed (Ben's 03:17 ask, the brief's 250)
  foundFly: { why: 'origin', ms: motion.panel },      // and flies to the bubble of the stage it settles
  cloudPoint: { why: 'progress', ms: motion.select }, // a point lands where a feature was found
  shutter: { why: 'feedback', ms: motion.feedback },  // the feed blinks when a still is taken
  // The shop takeover (Nate, words.md 2026-11-15: "animate the source in, with its listings, like a logo of it").
  sourceIn: { why: 'progress', ms: motion.select },   // a source's logo comes in when its job asks it
  listingIn: { why: 'progress', ms: motion.feedback }, // each listing it found slides in beside its logo as its frame lands
  barDrop: { why: 'state', ms: motion.panel },         // after the first answer the bar moves to the bottom: now it is a chat
  float: { why: 'recognition', ms: 1600 },            // a source's logo drifts a few points, so it reads as live and pressable
  burst: { why: 'origin', ms: 420 },                   // a pressed logo's colour grows from it to fill the page, and its site opens
};
