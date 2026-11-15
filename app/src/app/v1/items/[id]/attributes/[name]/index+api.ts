import '@/edge/auth';
import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/items';

export const PATCH = route('PATCH /v1/items/:id/attributes/:name', h['PATCH /v1/items/:id/attributes/:name']);
