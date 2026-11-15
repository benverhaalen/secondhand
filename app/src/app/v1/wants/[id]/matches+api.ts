import '@/edge/auth';
import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/wants';

export const GET = route('GET /v1/wants/:id/matches', h['GET /v1/wants/:id/matches']);
