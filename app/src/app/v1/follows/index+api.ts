import '@/edge/auth';
import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/market';

export const GET = route('GET /v1/follows', h['GET /v1/follows']);
export const POST = route('POST /v1/follows', h['POST /v1/follows']);
