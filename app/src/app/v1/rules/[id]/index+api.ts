import '@/edge/auth';
import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/rules';

export const DELETE = route('DELETE /v1/rules/:id', h['DELETE /v1/rules/:id']);
