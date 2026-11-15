import '@/edge/auth';
import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/valuations';

export const POST = route('POST /v1/valuations', h['POST /v1/valuations']);
