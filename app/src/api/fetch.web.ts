let sessionWrite: Promise<void> = Promise.resolve();

export const fetch: typeof globalThis.fetch = (input, init) => {
  const target = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    typeof window === 'undefined' ? 'http://localhost' : window.location.href);
  const run = () => globalThis.fetch(input, { ...init, credentials: 'include' });
  const changesSession = /^\/v1\/auth\/(refresh|signout|email\/verify|apple|google)$/.test(target.pathname);
  if (!changesSession) return run();
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request(`secondhand-session:${target.origin}`, { ...(init?.signal ? { signal: init.signal } : {}) }, run);
  }
  const request = sessionWrite.then(run, run);
  sessionWrite = request.then(() => undefined, () => undefined);
  return request;
};
