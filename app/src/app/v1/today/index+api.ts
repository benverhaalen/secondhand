import '@/edge/auth';
import { route } from '@/edge/api/http';
import { routeHandlers as h } from '@/edge/api/today';

export const GET = route('GET /v1/today', h['GET /v1/today']);
