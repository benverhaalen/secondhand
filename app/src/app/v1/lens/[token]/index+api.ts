import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/lens';

// A malformed percent escape answers 503 from the shared router before this handler; no token can match it either way.
export const GET = route('GET /v1/lens/:token', h['GET /v1/lens/:token'], { auth: 'none' });
