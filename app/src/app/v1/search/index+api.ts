import '@/edge/auth';
// The dev server bundles each route alone: loading the runtime gives search its harness and composed browser clients.
import '@/edge/api/runtime';
import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/search';

export const POST = route('POST /v1/search', h['POST /v1/search'], { auth: 'visitor' });
