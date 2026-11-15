// Rests-on: features/capture/README.md (single-use upload agreement); spec/product.md §7.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createLog, consoleSink } from '../../../../log/index.js';
import { createBlobs, receiveUpload, UploadError, type Blobs } from '../store/blobs.ts';
import { dataPath, db } from '../store/db.ts';
import { kv } from '../store/kv.ts';
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
    if (!ctx.readRaw) throw new Error('upload route requires body: raw');
    try { await receiveUpload(blobs, ctx.params.id, ctx.readRaw); }
    catch (error) { if (error instanceof UploadError) throw new UploadApiError(error); throw error; }
    return { status: 204 };
  };
}

const shared = globalThis as typeof globalThis & { __secondhandPhotos?: Blobs };
// One photo store per process, in the data folder beside the database, shared by every route bundle.
// The upload address is SECONDHAND_PUBLIC_ORIGIN, or this machine's port in development.
export function photos(env: Record<string, string | undefined> = process.env): Blobs {
  if (shared.__secondhandPhotos) return shared.__secondhandPhotos;
  const path = dataPath(env), dir = path === ':memory:' ? mkdtempSync(join(tmpdir(), 'secondhand-photos-')) : dirname(path);
  const origin = (env.SECONDHAND_PUBLIC_ORIGIN ?? `http://localhost:${env.PORT ?? 8081}`).replace(/\/+$/, '');
  const log = createLog({ src: 'edge.photos', build: env.npm_package_version ?? 'dev', sink: consoleSink });
  return shared.__secondhandPhotos = createBlobs({ kv: kv(db()), dir, origin, log });
}

let upload: Handler | undefined;
// A test binds its own store; otherwise the route uses the process's photo store, the one capture hands targets from.
export function setBlobs(blobs: Blobs | undefined): void { upload = blobs ? createUploads(blobs) : undefined; }
export const handlers: Record<string, Handler> = {
  'PUT /v1/uploads/:id': (ctx, req) => (upload ??= createUploads(photos()))(ctx, req),
};

export const manifest = [{ endpoint: 'PUT /v1/uploads/:id', source: 'engine' as const, auth: 'none' as const }];
