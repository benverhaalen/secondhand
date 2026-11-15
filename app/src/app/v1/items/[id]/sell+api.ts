import '@/edge/auth';
import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/items';

export const POST = route('POST /v1/items/:id/sell', h['POST /v1/items/:id/sell']);
