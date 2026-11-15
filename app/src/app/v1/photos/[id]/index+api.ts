import '@/edge/auth';
import { route } from '@/edge/api/http';
import { readPhoto } from '@/edge/api/uploads';

export const GET = route('GET /v1/photos/:id', readPhoto);
