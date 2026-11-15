// Called as options.fetch(...), so it must not carry options as `this`: an unbound window.fetch throws Illegal invocation.
export const fetch: typeof globalThis.fetch = (input, init) => globalThis.fetch(input, init);
