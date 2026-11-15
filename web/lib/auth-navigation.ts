export function workspaceDestination(next: string | string[] | undefined) {
  if (typeof next !== 'string' || !next.startsWith('/app')) return '/app';
  try {
    const base = 'https://secondhand.invalid';
    const destination = new URL(next, base);
    return destination.origin === base && (destination.pathname === '/app' || destination.pathname.startsWith('/app/'))
      ? destination.pathname + destination.search + destination.hash : '/app';
  } catch { return '/app'; }
}

export function accountDestination(mode: 'signin' | 'signup', next: string) {
  return `/${mode}?next=${encodeURIComponent(workspaceDestination(next))}`;
}
