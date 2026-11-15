import '@/edge/auth';
import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/wants';

export const POST = route('POST /v1/matches/:id/act', h['POST /v1/matches/:id/act']);
