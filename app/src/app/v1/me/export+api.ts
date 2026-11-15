import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/me';

export const POST = route('POST /v1/me/export', h.export);
