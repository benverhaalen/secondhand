import '@/edge/auth';
import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/accounts';

export const DELETE = route('DELETE /v1/accounts/:id', h['DELETE /v1/accounts/:id']);
