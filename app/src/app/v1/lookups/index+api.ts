import '@/edge/auth';
import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/lookups';

export const GET = route('GET /v1/lookups', h['GET /v1/lookups']);
export const DELETE = route('DELETE /v1/lookups', h['DELETE /v1/lookups']);
