import '@/edge/auth';
import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/accounts';

export const POST = route('POST /v1/accounts/:id/import', h['POST /v1/accounts/:id/import']);
