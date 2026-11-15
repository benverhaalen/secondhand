import '@/edge/auth';
import { route } from '@/edge/api/http';
import { routeHandlers as h } from '@/edge/api/events';

export const POST = route('POST /v1/events/:id/undo', h['POST /v1/events/:id/undo']);
