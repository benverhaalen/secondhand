import { health } from '@/edge/databricks';

export async function GET() {
  const h = await health();
  return Response.json(h, { status: h.ok ? 200 : 503 });
}
