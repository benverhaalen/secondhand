import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/me';

export const GET = route('GET /v1/me', h.get);
export const PATCH = route('PATCH /v1/me', h.patch);
export const DELETE = route('DELETE /v1/me', h.delete);
