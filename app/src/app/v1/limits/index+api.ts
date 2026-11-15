import '@/edge/auth';
import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/rules';

export const GET = route('GET /v1/limits', h['GET /v1/limits']);
export const PUT = route('PUT /v1/limits', h['PUT /v1/limits']);
