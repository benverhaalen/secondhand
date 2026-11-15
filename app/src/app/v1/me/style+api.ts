import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/me';

export const GET = route('GET /v1/me/style', h.styleGet);
export const PATCH = route('PATCH /v1/me/style', h.stylePatch);
