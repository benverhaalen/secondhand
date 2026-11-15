import '@/edge/auth';
import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/orders';

export const GET = route('GET /v1/orders/pick-list', h['GET /v1/orders/pick-list']);
