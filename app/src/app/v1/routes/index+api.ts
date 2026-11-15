import '@/edge/auth';
import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/routes';

export const GET = route('GET /v1/routes', h['GET /v1/routes']);
