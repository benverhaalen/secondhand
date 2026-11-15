import '@/edge/auth';
import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/orders';

export const POST = route('POST /v1/orders/:id/handed-over', h['POST /v1/orders/:id/handed-over']);
