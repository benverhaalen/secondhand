import { handlers as h, lensRoute } from '@/edge/api/lens';

export const GET = lensRoute(h['GET /v1/lens/:token']);
