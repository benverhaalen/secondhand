import '@/edge/auth';
import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/conversations';

export const GET = route('GET /v1/conversations', h['GET /v1/conversations']);
