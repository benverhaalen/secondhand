import '@/edge/auth';
import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/search';

export const POST = route('POST /v1/search', h['POST /v1/search'], { auth: 'visitor' });
