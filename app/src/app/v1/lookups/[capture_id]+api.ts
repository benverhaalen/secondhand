import '@/edge/auth';
import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/lookups';

export const DELETE = route('DELETE /v1/lookups/:capture_id', h['DELETE /v1/lookups/:capture_id']);
