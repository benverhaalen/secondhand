import '@/edge/auth';
import { route } from '@/edge/api/http';
import { handlers as h } from '@/edge/api/genie';

export const POST = route('POST /v1/genie', h['POST /v1/genie']);
