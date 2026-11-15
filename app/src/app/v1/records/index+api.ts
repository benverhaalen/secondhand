import '@/edge/auth';
import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/records';

export const GET = route('GET /v1/records', h['GET /v1/records']);
