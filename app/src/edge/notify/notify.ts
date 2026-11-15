// Notifications for decisions (nt-1). Rests: spec/features/today.md#what-the-person-does-and-sees.
//
// Operating notes
// - Reads: the decision, Params quiet_hours_start / quiet_hours_end (hours 0-23, scope person, read at every call so a
//   changed row applies at once), and the clock. No constants. Start equal to end means no quiet hours.
// - onDecision: drop a repeat id (seen set, kept even after the send), drop a decision that is not open, queue it for
//   its person, then flush. flush: per person, if their local hour is outside quiet hours send everything queued as ONE
//   send({user_id, decisions}); inside, keep it. So quiet hours end -> the next flush sends one batch.
// - No model here: it is a clock and a set, so it is exact and fast. People are flushed in parallel.
// - Likely breaks, each with a test: a repeat event (one send), quiet hours (held, wraps midnight, 06:59 vs 07:00),
//   hours changed in params, timezone (person's own), a failed send (batch kept, sent once later), a closed decision.
// - The caller runs flush() on a timer (every minute is enough); nothing here sleeps or keeps a process alive.
import type { DecisionRow, Params } from '../events/ports.ts';

export interface NotifierDeps {
  params: Params;
  send: (n: { user_id: string; decisions: DecisionRow[] }) => Promise<void> | void;
  now: () => Date;
  log: { error(where: string, e: unknown, fields?: Record<string, unknown>): unknown; event(name: string, fields?: Record<string, unknown>): unknown };
  timezone?: (user_id: string) => string; // IANA name; default UTC until the person's timezone is stored
}

export function createNotifier({ params, send, now, log, timezone = () => 'UTC' }: NotifierDeps) {
  const seen = new Set<string>();
  const pending = new Map<string, DecisionRow[]>();

  function quiet(user_id: string): boolean {
    const scope = { person: user_id };
    const start = params.get('quiet_hours_start', scope), end = params.get('quiet_hours_end', scope);
    if (start === end) return false;
    const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: timezone(user_id) }).format(now()));
    return start < end ? hour >= start && hour < end : hour >= start || hour < end;
  }

  async function flush(): Promise<number> {
    let sent = 0;
    await Promise.all([...pending.keys()].map(async user_id => {
      const batch = pending.get(user_id)!;
      if (!batch.length || quiet(user_id)) return;
      pending.set(user_id, []);
      try { await send({ user_id, decisions: batch }); sent++; log.event('notify.sent', { user_id, decisions: batch.map(d => d.id) }); }
      catch (e) { pending.set(user_id, [...batch, ...(pending.get(user_id) ?? [])]); log.error('notify.send', e, { user_id }); }
    }));
    return sent;
  }

  async function onDecision(decision: DecisionRow): Promise<void> {
    if (decision.state !== 'open' || seen.has(decision.id)) return;
    seen.add(decision.id);
    pending.set(decision.user_id, [...(pending.get(decision.user_id) ?? []), decision]);
    await flush();
  }

  return { onDecision, flush };
}
