import type { Handler } from './http.ts';
import { connectionServices, connectionSite, hostedConnections } from '../connect/hosted.ts';

const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };
export const handlers = {
  list: (ctx => ({ status: 200, body: connectionServices(ctx.user_id!), headers })) as Handler,
  start: (async ctx => ({ status: 201, body: await hostedConnections().start(ctx.user_id!, connectionSite(ctx.body.site)), headers })) as Handler,
  view: (async ctx => ({ status: 200, body: await hostedConnections().view(ctx.user_id!, ctx.params.handle), headers })) as Handler,
  complete: (async ctx => ({ status: 200, body: await hostedConnections().complete(ctx.user_id!, ctx.params.handle), headers })) as Handler,
  cancel: (async ctx => { await hostedConnections().cancel(ctx.user_id!, ctx.params.handle); return { status: 204, headers }; }) as Handler,
  unlink: (async ctx => { await hostedConnections().unlink(ctx.user_id!, ctx.params.id); return { status: 204, headers }; }) as Handler,
};

export const manifest = ['GET /v1/connections', 'POST /v1/connections', 'POST /v1/connections/:handle/view',
  'POST /v1/connections/:handle/complete', 'DELETE /v1/connections/:handle', 'DELETE /v1/connections/accounts/:id']
  .map(endpoint => ({ endpoint, source: 'engine' as const, auth: 'user' as const }));
