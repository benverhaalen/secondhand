import type { Photo } from './events.ts';
export function fitImage(width: number, height: number): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error('Invalid photo dimensions');
  const scale = Math.min(1, 1600 / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
export async function readPhoto(file: Blob): Promise<Photo> {
  if (!file.type.startsWith('image/')) throw new Error('Choose a photo');
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const canvas = document.createElement('canvas');
    const size = fitImage(bitmap.width, bitmap.height);
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Photo processing unavailable');
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    return { media_type: 'image/jpeg', data_base64: canvas.toDataURL('image/jpeg', 0.85).split(',')[1] };
  } finally { bitmap.close(); }
}
export const photoUrl = (photo: Photo) => `data:${photo.media_type};base64,${photo.data_base64}`;
