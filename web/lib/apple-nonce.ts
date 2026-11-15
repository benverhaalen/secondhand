// Apple puts the nonce it is given into the identity token as is. The API compares that claim with the
// SHA-256 hex of the nonce the browser sends (app/src/edge/auth.ts), so Apple gets the hash and the API the original.
export async function appleNonce() {
  const nonce = crypto.randomUUID() + crypto.randomUUID();
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(nonce));
  return { nonce, hashed: Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('') };
}
