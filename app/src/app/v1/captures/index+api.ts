import '@/edge/auth';
import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/captures';

export const POST = route('POST /v1/captures', h['POST /v1/captures']);
