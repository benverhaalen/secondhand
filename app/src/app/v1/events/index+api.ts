import '@/edge/auth';
import { route } from '@/edge/api/http';
import { routeHandlers as h } from '@/edge/api/events';

export const GET = route('GET /v1/events', h['GET /v1/events']);
