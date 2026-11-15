import '@/edge/auth';
import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/insights';

export const GET = route('GET /v1/insights', h['GET /v1/insights']);
