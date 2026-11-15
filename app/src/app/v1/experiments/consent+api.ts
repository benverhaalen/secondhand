import '@/edge/auth';
import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/scores';

export const POST = route('POST /v1/experiments/consent', h['POST /v1/experiments/consent']);
