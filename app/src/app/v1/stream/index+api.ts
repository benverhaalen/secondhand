import '@/edge/auth';
import { route } from '@/edge/api/http';
import { routeHandlers as h } from '@/edge/api/jobs';

export const GET = route('GET /v1/stream', h['GET /v1/stream']);
