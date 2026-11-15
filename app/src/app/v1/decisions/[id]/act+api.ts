import '@/edge/auth';
import { route } from '@/edge/api/http';
import { routeHandlers as h } from '@/edge/api/decisions';

export const POST = route('POST /v1/decisions/:id/act', h['POST /v1/decisions/:id/act']);
