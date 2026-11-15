import '@/edge/auth';
import { route } from '@/edge/api/http';
import { handlers } from '@/edge/api/connections';

const view = route('POST /v1/connections/:handle/view', handlers.view);
export function POST(request: Request) {
  const headers = new Headers(request.headers);
  headers.delete('Idempotency-Key');
  return view(new Request(request, { headers }));
}
