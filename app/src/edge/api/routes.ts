// Rests-on: spec/product.md §7 Resources; spec/examples/README.md.
import { manifest as uploads } from './uploads.ts';
import { manifest as connections } from './connections.ts';
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
import { manifest as lookups } from './lookups.ts';

export const notBuilt: Record<string, string> = {};

export const handlers: Record<string, Handler> = {
  'GET /v1/routes': () => ({ status: 200, body: { data: manifest, next_cursor: null } }),
};

export const manifest = [
  ...[uploads, connections, captures, market, sources, items, valuations, conversations, orders, records, rules, wants, buy, assist, search, genie, scores, accounts, insights, auth, me, jobs, decisions, events, today, lookups].flat(),
  ...Object.keys(handlers).map(endpoint => ({ endpoint, auth: 'user' as const, source: 'engine' as const })),
].map(row => ({ ...row, method: row.endpoint.split(' ')[0], needs_session: row.auth === 'user' })).sort((a, b) => a.endpoint.localeCompare(b.endpoint));

// Endpoint operations and engine inputs that are still missing; keep every example explicit.
export const exampleReasons: Record<string, string> = {
  "GET /v1/products/:id": "The sold-price arithmetic exists, but no catalog projection or raw sold-comp input is present; the example contains only a published range.",
  "GET /v1/products/:id/history": "No historical comp reader exists. The example contains two aggregate p50 points, not the dated sold rows productSnapshot requires.",
  "GET /v1/trends": "No TypeScript category-adjusted demand-trend reader exists. market.productTrend measures price movement and explicitly cannot stand in for demand trends.",
  "GET /v1/index/:id": "marketIndex exists, but its versioned basket, product weights and underlying product facts are absent; the example contains only the final index point.",
  "POST /v1/items/:id/sell": "No capture-session creation service exists for the returned item/capture pair.",
  "POST /v1/items/:id/listings": "Posting service exists in app/src/edge/post/post.ts, but this route has no join from the stored item card to the draft, claim-check and per-site posting inputs it requires.",
  "GET /v1/scores/:id/basis": "No score-basis read service exists; the example is an aggregate sentence without the underlying 41 basis row IDs.",
  "GET /v1/citations/:id": "Generated Genie and success-score citations can be read from memoryProof, but the default example citation has no underlying basis IDs to seed a replayable proof.",
  "GET /v1/sites/:site/ranker": "No ranker panel/notice reader exists in TypeScript.",
  "GET /v1/experiments": "No experiment membership reader exists in TypeScript.",
  "POST /v1/experiments/consent": "No experiment-consent engine or user-store port exists for this operation.",
  "PUT /v1/goals/:month": "The analytics engine computes funnel figures; it has no goal-write operation.",
  "GET /v1/records": "No CSV/PDF tax-record engine exists in TypeScript; orders.ledger does not implement this report.",
  "GET /v1/appointments": "No appointment read service exists; the order book models order state, not appointment windows and places.",
  "POST /v1/orders": "The order book requires a confirmed external_order_id; no adapter records a person-marked purchase from the match-only request.",
  "POST /v1/orders/:id/handed-over": "No handover service joins the order transition, item transition, event and undo record promised by this endpoint.",
  "POST /v1/orders/:id/ship": "No rate/label purchase engine exists; the order book does not buy shipping labels.",
  "POST /v1/orders/labels": "No batch label purchase/rendering engine exists.",
  "GET /v1/orders/pick-list": "No packing/location/parcel read service exists; those fields are absent from orderBook.",
  "POST /v1/captures/:id/talk": "No capture-session, upload-signing or realtime-session service exists; capture/process.ts only defines the process/picker calculation."
};
