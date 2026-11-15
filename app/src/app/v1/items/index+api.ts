import '@/edge/auth';
import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/items';

export const GET = route('GET /v1/items', h['GET /v1/items']);
