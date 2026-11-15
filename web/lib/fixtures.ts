import words from '../fixtures/words-fixture-prices-counts.json' with { type: 'json' };
import photo from '../fixtures/photo-fixture-prices-counts.json' with { type: 'json' };
import trends from '../fixtures/trends-fixture-prices-counts.json' with { type: 'json' };
import { parseEvent } from './contract.ts';
import { newTurn, reduceEvent, type Turn } from './events.ts';
import type { AssistEvent } from './types.ts';

interface Replay { text: string; photo?: string; events: AssistEvent[] }
function events(sequence: { event: string; data: unknown }[]): AssistEvent[] { return sequence.map(e => parseEvent(e.event, e.data)); }
export const replays: Record<string, Replay> = {
  'words-fixture-prices-counts': { text: 'Find brown Carhartt work pants in 38x36', events: events(words) },
  'photo-fixture-prices-counts': { text: 'Find pants like these', photo: '/garment.jpg', events: events(photo) },
  'trends-fixture-prices-counts': { text: 'What are the latest fashion trends millenials are wearing, what about gen z', events: events(trends) },
};
export function replayStart(name: string): Turn {
  const replay = replays[name];
  if (!replay) throw new Error('Unknown recording');
  return { ...newTurn(`recorded_${name}`, replay.text), photo: replay.photo, recorded: name };
}
export function replayTurn(name: string): Turn { return replays[name].events.reduce(reduceEvent, replayStart(name)); }
const full = () => replayTurn('words-fixture-prices-counts');
const thin = full();
if (thin.answer) {
  thin.answer = { ...thin.answer, blocks: [{ type: 'text', text: 'Only 3 matching sales in this recording. Too few to give a price estimate.' }], results: { r1: { ...thin.answer.results.r1, ok: false, reason: 'too_few', counts: { count: 3 }, rows: [], basis: '3 fixture sales; too few for a price estimate.' } }, sources: [], calls: [] };
  thin.status = 'thin_data';
}
const refusal = full();
refusal.status = 'refused';
if (refusal.answer) refusal.answer = { ...refusal.answer, state: 'refused', blocks: [{ type: 'text', text: 'I cannot verify authenticity from a photo. Ask the seller for proof of purchase.' }], results: {}, calls: [], sources: [], gate: { ...refusal.answer.gate, cut: 0 } };
export const reviewStates: { name: string; draft?: string; photo?: string; turns: Turn[] }[] = [
  { name: 'empty', turns: [] },
  { name: 'typing', draft: 'Find a canvas work jacket', turns: [] },
  { name: 'photo_attached', photo: '/garment.jpg', turns: [] },
  { name: 'running', turns: [replays['words-fixture-prices-counts'].events.slice(0, 3).reduce(reduceEvent, replayStart('words-fixture-prices-counts'))] },
  { name: 'answered', turns: [replayTurn('photo-fixture-prices-counts')] },
  { name: 'thin_data', turns: [thin] },
  { name: 'refused', turns: [refusal] },
  ...(['rate_limited', 'offline', 'failed'] as const).map(status => ({ name: status, turns: [{ ...replayStart('words-fixture-prices-counts'), status }] })),
  { name: 'long_answer', turns: [full()] },
];
