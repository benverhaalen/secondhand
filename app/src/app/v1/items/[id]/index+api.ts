import '@/edge/auth';
import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/items';

export const GET = route('GET /v1/items/:id', h['GET /v1/items/:id']);
export const PATCH = route('PATCH /v1/items/:id', h['PATCH /v1/items/:id']);
