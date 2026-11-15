import '@/edge/auth';
import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/insights';

export const PUT = route('PUT /v1/goals/:month', h['PUT /v1/goals/:month']);
