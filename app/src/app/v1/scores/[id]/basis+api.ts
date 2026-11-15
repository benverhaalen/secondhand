import '@/edge/auth';
import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/scores';

export const GET = route('GET /v1/scores/:id/basis', h['GET /v1/scores/:id/basis']);
