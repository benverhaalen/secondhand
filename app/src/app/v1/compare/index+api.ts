import '@/edge/auth';
import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/buy';

export const POST = route('POST /v1/compare', h['POST /v1/compare'], { auth: 'visitor' });
