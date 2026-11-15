import '@/edge/auth';
import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/scores';

export const GET = route('GET /v1/citations/:id', h['GET /v1/citations/:id']);
