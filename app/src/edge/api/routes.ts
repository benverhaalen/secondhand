// Rests-on: spec/product.md §7 Resources; spec/examples/README.md.
import type { Handler } from './http.ts';
import { manifest as captures } from './captures.ts';
import { manifest as market } from './market.ts';
import { manifest as sources } from './sources.ts';
import { manifest as items } from './items.ts';
import { manifest as valuations } from './valuations.ts';
import { manifest as conversations } from './conversations.ts';
import { manifest as orders } from './orders.ts';
import { manifest as records } from './records.ts';
import { manifest as rules } from './rules.ts';
import { manifest as wants } from './wants.ts';
import { manifest as buy } from './buy.ts';
import { manifest as assist } from './assist.ts';
import { manifest as search } from './search.ts';
import { manifest as genie } from './genie.ts';
import { manifest as scores } from './scores.ts';
import { manifest as accounts } from './accounts.ts';
import { manifest as insights } from './insights.ts';
import { manifest as auth } from './auth.ts';
import { manifest as me } from './me.ts';
import { manifest as jobs } from './jobs.ts';
import { manifest as decisions } from './decisions.ts';
import { manifest as events } from './events.ts';
import { manifest as today } from './today.ts';

export const notBuilt: Record<string, string> = {};

export const handlers: Record<string, Handler> = {
  'GET /v1/routes': () => ({ status: 200, body: { data: manifest, next_cursor: null } }),
};

export const manifest = [
  ...[captures, market, sources, items, valuations, conversations, orders, records, rules, wants, buy, assist, search, genie, scores, accounts, insights, auth, me, jobs, decisions, events, today].flat(),
  ...Object.keys(handlers).map(endpoint => ({ endpoint, auth: 'user' as const, source: 'engine' as const })),
].map(row => ({ ...row, method: row.endpoint.split(' ')[0], needs_session: row.auth === 'user' })).sort((a, b) => a.endpoint.localeCompare(b.endpoint));
