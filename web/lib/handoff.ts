import { record, isAnswer, isCall } from './contract.ts';
import type { Turn } from './events.ts';
const key = 'secondhand.buy.conversation';
export function createConversationLoader(load: () => Turn[]): () => Turn[] {
  let saved: Turn[] | undefined;
  return () => saved ??= load();
}
export function saveConversation(storage: Pick<Storage, 'setItem'>, turns: Turn[]): void { storage.setItem(key, JSON.stringify(turns)); }
export function readConversation(storage: Pick<Storage, 'getItem' | 'removeItem'>): Turn[] {
  const saved = storage.getItem(key);
  if (!saved) return [];
  storage.removeItem(key);
  const value: unknown = JSON.parse(saved);
  if (!Array.isArray(value) || !value.every(isTurn)) throw new Error('Invalid saved conversation');
  return value as Turn[];
}
function isTurn(t: unknown): t is Turn {
  if (!record(t) || typeof t.id !== 'string' || typeof t.text !== 'string' || typeof t.idempotencyKey !== 'string' || typeof t.streamed !== 'string') return false;
  if (!Array.isArray(t.tools) || !t.tools.every(tool => isCall(tool) && record(tool) && (tool.phase === 'start' || tool.phase === 'end'))) return false;
  if (!['running', 'answered', 'thin_data', 'refused', 'rate_limited', 'offline', 'failed'].includes(String(t.status))) return false;
  return (t.answer === undefined || isAnswer(t.answer)) && (t.recorded === undefined || typeof t.recorded === 'string') && (t.photo === undefined || typeof t.photo === 'string') && (t.jobId === undefined || typeof t.jobId === 'string') && (t.jobFailed === undefined || typeof t.jobFailed === 'boolean') && (t.replayIndex === undefined || typeof t.replayIndex === 'number' && Number.isInteger(t.replayIndex) && t.replayIndex >= 0) && (t.image === undefined || record(t.image) && typeof t.image.media_type === 'string' && typeof t.image.data_base64 === 'string');
}
