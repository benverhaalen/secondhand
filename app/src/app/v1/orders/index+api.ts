import '@/edge/auth';
import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/orders';

export const GET = route('GET /v1/orders', h['GET /v1/orders']);
export const POST = route('POST /v1/orders', h['POST /v1/orders']);
