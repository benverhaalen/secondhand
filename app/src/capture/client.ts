import { api, ApiFailure, type Fetch } from '@/api/client';
import { fetch } from '@/api/fetch';
import type { Question, plan } from '@/engines/capture/plan';

export type Capture = {
  id: string; item_id: string; version: number; purpose: 'sell' | 'appraise' | 'find';
  plan: ReturnType<typeof plan>; coverage: { needed: string[]; kept: string[] };
};
export type Still = { uri: string; base64: string; type: 'image/jpeg' | 'image/png' | 'image/heic'; step: string; role: string };
type Upload = { id: string; upload: { url: string; method: string } };
export const captureMessage = (error: unknown) => error instanceof ApiFailure && error.status === 401
  ? 'Sign in to continue.'
  : error instanceof Error ? error.message : 'Could not reach the service. Try again.';
export const openCapture = (purpose: Capture['purpose']) => api.call<Capture>('POST /v1/captures', {
  body: { mode: 'shots', purpose, intent: purpose === 'appraise' ? 'worth' : purpose, confirm_mode: 'tap', device: { has_lidar: false, object_capture: false } },
});
export const readCapture = (id: string) => api.call<Capture>(`GET /v1/captures/${encodeURIComponent(id)}`);
export const answerCapture = (capture: Capture, question: Question, value: unknown) => api.call<Capture>(`PATCH /v1/captures/${encodeURIComponent(capture.id)}`, {
  body: { version: capture.version, answer: { field: question.field, value } },
});
// What the item is, picked before the camera: one of FAMILIES (engines/capture/process.ts); the shots follow from it.
export const setType = (capture: Capture, type: string) => api.call<Capture>(`PATCH /v1/captures/${encodeURIComponent(capture.id)}`, {
  body: { version: capture.version, type },
});
export const skipQuestion =(capture: Capture, field: string) => api.call<Capture>(`PATCH /v1/captures/${encodeURIComponent(capture.id)}`, {
  body: { version: capture.version, refuse: field },
});
export const requestStudio = (capture: Capture) => api.call<Capture>(`PATCH /v1/captures/${encodeURIComponent(capture.id)}`, {
  body: { version: capture.version, generate: true },
});

export async function uploadStills(capture: Capture, stills: Still[], uploadFetch: Fetch = fetch): Promise<Capture> {
  // A plain loop: Uint8Array.from over a multi-megabyte string builds a list of every character first, a heavy spike on Hermes.
  const bytes = stills.map(still => {
    const raw = atob(still.base64), out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  });
  const signed = await api.call<{ photos: Upload[]; capture: Capture }>(`POST /v1/captures/${encodeURIComponent(capture.id)}/photos`, {
    body: { photos: stills.map((still, index) => ({ role: still.role, step: still.step, key: still.step, content_type: still.type, bytes: bytes[index].length })) },
  });
  if (signed.photos.length !== stills.length) throw new Error('The upload service did not accept every photo. Your photos are still here.');
  if (signed.photos.some(photo => new URL(photo.upload.url).hostname.endsWith('.example'))) {
    throw new Error('Photo uploads are not connected yet. Your photos are still here; try again when the service is ready.');
  }
  await Promise.all(signed.photos.map(async (photo, index) => {
    const response = await uploadFetch(photo.upload.url, { method: photo.upload.method, headers: { 'Content-Type': stills[index].type }, body: bytes[index] });
    if (!response.ok) throw new Error('A photo did not upload. Your photos are still here; try again.');
  }));
  return readCapture(capture.id);
}
