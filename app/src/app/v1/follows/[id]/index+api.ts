import '@/edge/auth';
import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/market';

export const DELETE = route('DELETE /v1/follows/:id', h['DELETE /v1/follows/:id']);
export const PATCH = route('PATCH /v1/follows/:id', h['PATCH /v1/follows/:id']);
