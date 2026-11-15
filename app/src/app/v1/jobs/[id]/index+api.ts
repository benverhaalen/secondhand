import '@/edge/auth';
import { route } from '@/edge/api/http';
import { routeHandlers as h } from '@/edge/api/jobs';

export const GET = route('GET /v1/jobs/:id', h['GET /v1/jobs/:id'], { auth: 'visitor' });
