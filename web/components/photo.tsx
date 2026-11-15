'use client';
import { useState } from 'react';
import { safeUrl } from '../lib/widgets';
export function Photo({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const allowed = src.startsWith('/') && !src.startsWith('//') || src.startsWith('data:image/jpeg;base64,') || safeUrl(src);
  return failed || !allowed ? <div className={`photo missing-photo ${className}`} role="img" aria-label={alt}>Photo unavailable</div> : <img className={`photo ${className}`} src={src} alt={alt} onError={() => setFailed(true)} />;
}
