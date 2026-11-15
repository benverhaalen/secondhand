import '@/edge/auth';
import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/assist';

export const POST = route('POST /v1/assist', h['POST /v1/assist'], { auth: 'visitor' });
