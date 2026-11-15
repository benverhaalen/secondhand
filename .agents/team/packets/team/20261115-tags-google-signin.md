# Paired tag identity and Google sign-in UI

Owner: Ben
Agent: Codex
Status: implemented; Google provider setup remains with Nate

Exact requests: product/words.md, November 15 entries "paired tags replace hand branding" and "Google sign-in UI for Nate to connect".

`brand/mark.svg` is the transparent canonical mark; `mark-light.svg` is its contrast variant. `node scripts/brand-mark-assets.mjs` copies them to app/web and exports installed icons, Android adaptive layers, splash and favicon. Website and app lockups put the tags left of the wordmark. Hand branding, intro animation and choice assets are retired. Old source locators remain solely to preserve citations. iOS points to `assets/images/icon.png`, replacing the Expo composer override.

## Nate's connection point

In `app/src/you/sign-in-wire.ts`, implement `requestGoogleIdToken(): Promise<string | null>` with the Google provider. Return null for cancellation. `SignIn` also accepts `requestGoogleToken` for injection. `googleSignIn` posts the ID token to the existing `POST /v1/auth/google`, stores the returned session with `api.signIn`, and only then lets the screen call its existing `onDone`. Configure the backend's `GOOGLE_CLIENT_IDS` to validate the provider audience. No fabricated session or placeholder token exists. Until connected, tapping Google says it is unavailable and offers email. The button uses Google's unchanged pre-approved artwork.

Checks: `node scripts/brand-mark.test.mjs`; Node 24 `--test app/src/you/sign-in-wire.test.ts`; `node --test brand/explore/web-home/hero/brand.test.mjs`.

Verification: five sign-in wire tests pass, including cancellation/unavailable/rejected tokens without a session. Browser clicks at 320/390 stay on sign-in with the honest unavailable notice; no token exchange request occurs. Next header passes at 320/390/1440 with 8px gap, centered mark and no overflow. Marketing hero geometry passes all 11 viewports. App rendered brand check has only the pre-existing B35 missing scenario-coverage error. Typecheck is blocked by the existing implicit-any in edge/api/auth.ts:19. The repository pre-push check still fails on existing diagnostics outside this change, so this commit is not pushed without an explicit exception. Installed icons require a native rebuild.

Ben explicitly approved pushing despite the existing repository check failures in the same Codex chat: "yes push". The focused tag and Google sign-in checks were rerun after updating to the latest main.
