import '@/edge/auth';
import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/rules';

export const GET = route('GET /v1/rules', h['GET /v1/rules']);
export const POST = route('POST /v1/rules', h['POST /v1/rules']);
