import '@/edge/auth';
import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/accounts';

export const POST = route('POST /v1/accounts', h['POST /v1/accounts']);
export const GET = route('GET /v1/accounts', h['GET /v1/accounts']);
