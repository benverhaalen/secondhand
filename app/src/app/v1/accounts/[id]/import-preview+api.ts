import '@/edge/auth';
import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/accounts';

export const GET = route('GET /v1/accounts/:id/import-preview', h['GET /v1/accounts/:id/import-preview']);
