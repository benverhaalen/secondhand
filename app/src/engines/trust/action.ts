import type { Decision } from './decide.ts';

export function messageAction(d: Decision): { scam_warning: boolean; hold_commits: boolean; reason: string | null } {
  return {
    scam_warning: d.action === 'block',
    hold_commits: d.action === 'block' || d.action === 'ask',
    reason: d.action === 'none' ? null : (d.action === 'warn' ? d.reasons.at(-1) : d.reasons[0]) ?? null,
  };
}
