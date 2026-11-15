import '@/edge/auth';
import { route } from '@/edge/api/http';
import { routeHandlers as h } from '@/edge/api/decisions';

export const GET = route('GET /v1/decisions', h['GET /v1/decisions']);
