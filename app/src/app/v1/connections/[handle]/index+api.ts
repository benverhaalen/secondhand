import '@/edge/auth';
import { route } from '@/edge/api/http';
import { handlers } from '@/edge/api/connections';

export const DELETE = route('DELETE /v1/connections/:handle', handlers.cancel);
