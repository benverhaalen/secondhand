import '@/edge/auth';
import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/captures';

export const PATCH = route('PATCH /v1/captures/:id', h['PATCH /v1/captures/:id']);
