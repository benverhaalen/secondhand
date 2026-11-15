import type { Answer, AssistEvent, ToolCallInfo } from './types.ts';

export type TurnStatus = 'running' | 'answered' | 'thin_data' | 'refused' | 'rate_limited' | 'offline' | 'failed';
export interface Photo { media_type: string; data_base64: string }
export interface Turn {
  id: string;
  text: string;
  photo?: string;
  image?: Photo;
  idempotencyKey: string;
  jobId?: string;
  jobFailed?: boolean;
  status: TurnStatus;
  tools: (ToolCallInfo & { phase: 'start' | 'end' })[];
  streamed: string;
  answer?: Answer;
  recorded?: string;
  replayIndex?: number;
}
export function newTurn(id: string, text: string): Turn {
  return { id, text, idempotencyKey: crypto.randomUUID(), status: 'running', tools: [], streamed: '' };
}
export function retryTurn(turn: Turn): Turn {
  if (!turn.jobFailed) return { ...turn, status: 'running' };
  return { ...turn, status: 'running', answer: undefined, tools: [], streamed: '', jobId: undefined, jobFailed: false, idempotencyKey: crypto.randomUUID() };
}
export function reduceEvent(turn: Turn, event: AssistEvent): Turn {
  if (turn.answer) return turn;
  if (event.event === 'assist.settled') {
    const answer = event.data;
    const thin = Object.values(answer.results).some(r => r.reason === 'too_few');
    return { ...turn, answer, jobFailed: answer.state === 'failed', streamed: '', tools: answer.calls.length ? answer.calls.map(c => ({ ...c, phase: 'end' })) : turn.tools, status: answer.state === 'answered' && thin ? 'thin_data' : answer.state };
  }
  if (event.event === 'assist.text') return { ...turn, streamed: turn.streamed + event.data.delta };
  const old = turn.tools.find(t => t.id === event.data.id);
  if (old?.phase === 'end' && event.data.phase === 'start') return turn;
  return { ...turn, tools: old ? turn.tools.map(t => t.id === event.data.id ? event.data : t) : [...turn.tools, event.data] };
}
