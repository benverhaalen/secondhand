import '@/edge/auth';
import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/wants';

export const POST = route('POST /v1/wants', h['POST /v1/wants']);
export const GET = route('GET /v1/wants', h['GET /v1/wants']);
