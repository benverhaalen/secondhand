import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/auth';

export const POST = route('POST /v1/auth/apple', h.apple, { auth: 'none' });
