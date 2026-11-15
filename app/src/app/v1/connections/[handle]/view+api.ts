import '@/edge/auth';
import { route } from '@/edge/api/http';
import { handlers } from '@/edge/api/connections';

export const POST = route('POST /v1/connections/:handle/view', handlers.view);
