import '@/edge/auth';
import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/conversations';

export const GET = route('GET /v1/conversations/:id/messages', h['GET /v1/conversations/:id/messages']);
export const POST = route('POST /v1/conversations/:id/messages', h['POST /v1/conversations/:id/messages']);
