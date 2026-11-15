import '@/edge/auth';
import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/sources';

export const GET = route('GET /v1/sources/health', h['GET /v1/sources/health']);
