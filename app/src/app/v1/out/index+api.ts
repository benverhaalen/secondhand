import '@/edge/auth';
import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/buy';

export const GET = route('GET /v1/out', h['GET /v1/out'], { auth: 'visitor' });
