import '@/edge/auth';
import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/market';

export const GET = route('GET /v1/index/:id', h['GET /v1/index/:id'], { auth: 'visitor' });
