import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/uploads';

export const PUT = route('PUT /v1/uploads/:id', h['PUT /v1/uploads/:id'], { auth: 'none', body: 'raw', max_bytes: 26214400 });
