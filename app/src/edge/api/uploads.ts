// Rests-on: features/capture/README.md (single-use upload agreement); spec/product.md §7.
import { receiveUpload, UploadError, type Blobs } from '../store/blobs.ts';
import { ApiError, type Handler } from './http.ts';

class UploadApiError extends ApiError {
  uploadStatus: number;
  constructor(error: UploadError) {
    super(error.status === 404 ? 'not_found' : 'invalid', error.message, 'upload', { by: error.status === 404 ? 'none' : 'user' });
    this.uploadStatus = error.status;
  }
  get status() { return this.uploadStatus; }
}

export function createUploads(blobs: Blobs): Handler {
  return async ctx => {
    if (!ctx.raw) throw new Error('upload route requires body: raw');
    try { await receiveUpload(blobs, ctx.params.id, ctx.raw); }
    catch (error) { if (error instanceof UploadError) throw new UploadApiError(error); throw error; }
    return { status: 204 };
  };
}

let upload: Handler | undefined;
// Server composition calls this with the same Blobs instance passed to capture.
export function setBlobs(blobs: Blobs | undefined): void { upload = blobs ? createUploads(blobs) : undefined; }
export const handlers: Record<string, Handler> = {
  'PUT /v1/uploads/:id': (ctx, req) => {
    if (!upload) throw new ApiError('unavailable', 'photo store is not configured', 'upload', { by: 'auto' });
    return upload(ctx, req);
  },
};
