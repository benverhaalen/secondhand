import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/auth';

export const POST = route('POST /v1/auth/refresh', h.refresh, { auth: 'none' });
