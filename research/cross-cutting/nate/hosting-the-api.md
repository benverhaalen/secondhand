# Hosting the API: Vercel, Expo server output, Databricks Apps, Fly.io, Render

Researched 2026-11-15 by Nate (Claude Code, two retriever seats for the third integration lead).
Owner: Nate. Status: reference for [spec/plans/hosting.md](../../../spec/plans/hosting.md). Every claim is quoted from the page named beside it and is marked sourced, inferred or not found.


All pages fetched with curl on 2026-11-15, tags stripped, grepped. Label: sourced unless stated.
Page dates are the "Last updated"/modificationDate each page states.

## 1. Expo Router server output and Vercel deployment

1a. API routes need server output; in SDK 58 enabled by default. (sourced)
- URL: https://docs.expo.dev/router/web/api-routes/ (md: .../index.md), modificationDate November 03, 2026
- Quote: "In SDK 58 and later, API routes are enabled by default with web.output: "server"."
- Static mode alternative: "use web.output: "static" and enable apiRoutes in the expo-router config plugin". "Set apiRoutes to false to disable API routes".

1b. Export and output folders. (sourced, same page)
- Quote: "This exports prerendered HTML and API routes to dist/server, and client assets to dist/client. It requires a deployed server."
- Command: `npx expo export --platform web`. API-only (no website): `npx expo export --platform web --no-ssg` ("generate a dist directory containing only the server code").
- Local test: `npx expo serve`.

1c. Vercel adapter and config. (sourced, same page, "Hosting on third-party services > Vercel")
- Adapter: `expo-server/adapter/vercel` (package `expo-server`, added SDK 54; `@expo/server` for older SDKs). Quote: "The expo-server library was added in SDK 54. Use @expo/server for older SDKs instead."
- Warning: "Third-party adapters are subject to breaking changes. We have no continuous tests against them."
- Entry file `api/index.ts` (location "is important"):
  `const { createRequestHandler } = require('expo-server/adapter/vercel'); module.exports = createRequestHandler({ build: require('path').join(__dirname, '../dist/server') });`
- vercel.json "v3" (current):
  `{"buildCommand":"expo export -p web","outputDirectory":"dist/client","functions":{"api/index.ts":{"includeFiles":"dist/server/**"}},"rewrites":[{"source":"/(.*)","destination":"/api/index"}]}`
- Quote: "The newer version of the vercel.json does not use routes and builds configuration options anymore, and serves your public assets from the dist/client output directory automatically."
- Legacy "v2" uses `builds` with `@vercel/static-build` and `@vercel/node` (`api/index.ts`, includeFiles `dist/server/**`), routes `handle: filesystem` then `/(.*)` -> `/api/index.ts`; needs a `vercel-build` script `expo export -p web`.
- Deploy: `vercel build` then `vercel deploy --prebuilt`.
- Runtime: the page names no runtime/version for the v3 config. The legacy v2 config names `@vercel/node`. Runtime version: not found on this page.
- Known limits (same page): "API Routes currently work by bundling all code (minus the Node.js built-ins) into a single file." No dynamic imports. "All code will be transpiled down to Common JS".
- Node fs: Quote: "Node.js standard library — ensure that you are using the correct version of Node.js locally for your server environment."

1d. Background work primitive in Expo. (sourced, same page, "Task scheduling")
- Quote: "use expo-server's runTask() helper function to run concurrent tasks. This is equivalent to the waitUntil() method"
- Quote: "calling the function without await wouldn't guarantee that this task keeps a serverless function running."
- Whether the Vercel adapter wires runTask to Vercel waitUntil: not found on this page.

1e. Native app API origin. (sourced, same page)
- Quote: "Relative fetch requests automatically fetch relative to the dev server origin in development, and can be configured in production using the origin field in the app.json"
- Config: `{"plugins":[["expo-router",{"origin":"https://evanbacon.dev/"}]]}` (plugin option `origin`).
- Quote: "for production native builds to work you'll need to deploy the server to a secure host and set the origin property of the Expo Router Config Plugin."
- Auto-deploy to Expo Hosting (`EXPO_UNSTABLE_DEPLOY_SERVER=1`) requires origin NOT set and "you aren't using app.config.js"; "Automatic deployment does not support dynamic app config (app.config.js and app.config.ts) files yet." Skip with `EXPO_NO_DEPLOY=1`. (Not relevant if origin is set manually.)
- Whether `origin` can be set from an env var in app.config.ts: not found on this page (only static app.json shown).

1f. EXPO_PUBLIC_ vars at build time. (sourced)
- URL: https://docs.expo.dev/guides/environment-variables/ (md), modificationDate November 02, 2026
- Quote: "replaces all references in your code to process.env.EXPO_PUBLIC_[VARNAME] with the corresponding value set in the .env files."
- Quote: "Every environment variable must be statically referenced as a property of process.env using JavaScript's dot notation for it to be inlined."
- Quote: "Do not store sensitive info, such as private keys, in EXPO_PUBLIC_ variables. These variables will be visible in plain-text in your compiled application."
- Quote: "server routes have access to all environment variables, not just the ones prefixed with EXPO_PUBLIC_" (api-routes page).
- Example in guide: `EXPO_PUBLIC_API_URL=https://staging.example.com`, used as `process.env.EXPO_PUBLIC_API_URL`.

Note: the URL docs.expo.dev/router/reference/hosting and /router/reference/api-routes return 404 / same content now; docs live at /router/web/api-routes/.

## 2. One Vercel project for Next.js site plus a second app

- Microfrontends (sourced). URL: https://vercel.com/docs/microfrontends
  - Quote: "Each application is its own Vercel project and deploys on its own, no matter where its code lives."
  - Quote: "Microfrontends allow you to split a single application into smaller, independently deployable units that render as one cohesive application for users."
  - Config file `microfrontends.json`; monorepo auto-detected; polyrepo needs the default app deployed first. Template listed: "A SaaS dashboard that talks to 2 API microservices defined in Nitro and Hono, all running under the same domain."
  - Plan limits quote: "Hobby and Pro include two microfrontend projects." Hobby: 50K routed requests/month included; Pro: 2 projects, extra project $250/project/month, routing $2 per 1M requests (table on the page).
- Rewrites to external origins (sourced). URL: https://vercel.com/docs/routing/rewrites (Last updated August 11, 2026)
  - Quote: "Rewrites to external origins forward requests to these destinations, effectively allowing Vercel to function as a reverse proxy or standalone CDN."
  - List item: "Create microfrontends: Combine multiple Vercel applications into a single website". Example: `{"source":"/api/:path*","destination":"https://api.example.com/:path*"}` in vercel.json.
  - Vercel forwards `x-real-ip` and `x-forwarded-for` (visitor's public IP) to the external origin.
- Monorepo, multiple projects (sourced). URL: https://vercel.com/docs/monorepos (Last updated August 11, 2026)
  - Quote: "Monorepos allow you to manage multiple projects in a single directory."
  - Each project gets its own Root Directory; number of Projects connected to one Git repo "limited depending on your plan".
  - Related Projects: "A maximum of 3 projects can be linked together".
- Hosting a Next.js site and an Expo `api/index.ts` function inside ONE project: not found as a documented pattern. The Expo vercel.json (1c) sets `outputDirectory: dist/client` and rewrites `/(.*)` to `/api/index`, i.e. it takes over the whole project, so a Next.js app would need a separate project (inferred).

## 3. Vercel Functions filesystem

- Read-only except /tmp (sourced). URL: https://vercel.com/docs/functions/runtimes (Last updated August 12, 2026)
  - Quote: "Vercel functions have a read-only filesystem with writable /tmp scratch space up to 500 MB."
  - Also in the summary list: "Isolation boundary: microVM" and "File system support: Read-only filesystem with writable /tmp scratch space up to 500 MB".
- Is /tmp shared between invocations or instances: not found in the docs fetched (functions/runtimes, limitations, fluid-compute). Inferred only: /tmp lives with an instance, so not shared across instances.
- Bundle size (sourced). URL: https://vercel.com/docs/functions/limitations (Last updated August 24, 2026): "Size (uncompressed) 250 MB, or 500 MB for Python."
- Archiving (sourced, runtimes page): functions "are archived when they are not invoked: Within 2 weeks for Production Deployments".

## 4. Work after the response

- waitUntil (sourced). URL: https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package (Last updated September 3, 2026)
  - Quote: "Promises passed to waitUntil() will have the same timeout as the function itself. If the function times out, the promises will be cancelled."
  - Quote: "Extends the lifetime of the request handler for the lifetime of the given Promise."
  - Deadline helper quote: "The deadline is the time when Vercel will terminate the invocation if it has not completed, based on the function's configured maxDuration. This includes request processing and asynchronous waitUntil tasks."
  - Import: `import { waitUntil } from '@vercel/functions'`; available in Node.js and Edge Runtime.
  - Page advises: if on Next.js 15.1 or above, use `after()` from `next/server` instead.
- Next.js after() (sourced). URL: https://nextjs.org/docs/app/api-reference/functions/after (Last updated September 16, 2026; docs v16.4.6; stable since v15.1.0)
  - Quote: "after will run for the platform's default or configured max duration of your route."
  - Quote: "this is achieved using a primitive called waitUntil(promise), which extends the lifetime of a serverless invocation until all promises passed to waitUntil have settled."
- Counting against maxDuration: yes, per the two quotes above (same timeout / max duration of the route). (sourced)
- Not found in these pages: whether idle/I-O wait in waitUntil work is billed differently beyond the Active CPU model (see 9).

## 5. Maximum durations and streaming

- Duration table, fluid compute (default on) (sourced). URL: https://vercel.com/docs/functions/configuring-functions/duration (Last updated August 24, 2026)
  - Quote: "Hobby 300s (5 minutes) 300s (5 minutes) - Pro 300s (5 minutes) 800s 1800s (30 minutes) Beta" (columns Default / Maximum / Extended maximum).
  - Quote: "The 800 second maximum is generally available for Pro and Enterprise teams."
  - Extended 30 min (beta): "Pro and Enterprise teams can set individual Vercel Functions using supported Node.js, Bun, and Python runtime versions to run for up to 30 minutes." Over 800 s must be set per function, not project default.
  - Config: Next.js App Router `export const maxDuration = 5`; other runtimes `vercel.json` `functions: {"api/test.js": {"maxDuration": 30}}`.
- Fluid default on: https://vercel.com/docs/fluid-compute: "As of April 23, 2025, fluid compute is enabled by default for new projects."
- Without fluid compute: the current duration pages state only fluid-compute limits; non-fluid (legacy) limits: not found on the pages fetched.
- Streaming/SSE (sourced). URL: https://vercel.com/docs/functions/streaming-functions (Last updated September 1, 2026)
  - Quote: "Maximum durations can be configured for Node.js functions to enable streaming responses for longer periods."
  - Quote (duration page): allow time "including any necessary waiting periods (for example, streamed responses)". A stream counts against maxDuration (inferred from "terminate it" wording: "If a function runs for longer than its set maximum duration, Vercel will terminate it.").
  - A separate SSE-specific limit: not found.
- Other limits (limitations page, Last updated August 24, 2026): "Maximum memory Hobby: 2 GB, Pro and Ent: 4 GB"; "Auto-scales up to 30,000 (Hobby and Pro)"; "File descriptors 1,024 shared across concurrent executions"; default region iad1.
- New in the docs nav (seen, not fetched in detail): "Background Workers", "Schedules", "Queues", Vercel Daemons. The fluid-compute page links "Run background workers with Vercel Daemons" and "Daemons for continuous background workers". Content not read; flagged only.

## 6. State between invocations and stores

- Fluid compute instance sharing (sourced). URL: https://vercel.com/docs/fluid-compute (Last updated August 24, 2026)
  - Quote: "multiple invocations can share the same physical instance (a global state/process) concurrently."
  - Quote: "Fluid compute allows multiple invocations to share a single function instance"
  - Quote: "Optimized concurrency in fluid compute is available when using Node.js or Python runtimes."
  - Quote: "Unhandled errors won't crash other concurrent requests running on the same instance".
- In-memory state across instances: the pages do not say it is shared; instances are separate processes that scale out ("Auto-scales up to 30,000"). Explicit statement "in-memory state is not shared across instances": not found (inferred).
- Instance lifetime guarantee: "Archived" after 2 weeks idle; guaranteed reuse period: not found.
- Storage (sourced). URL: https://vercel.com/docs/storage
  - Quote: "Upload generated files with Vercel Blob, read low-latency configuration with Global Config, or provision a database through Vercel Marketplace."
  - Edge Config is now named "Global Config" in these docs ("Global Config | Ultra-fast reads | Seconds writes | Runtime configuration (e.g., feature flags)"). Blob: "Fast reads, Milliseconds writes, Hobby, Pro". Runtime Cache: "In-region ... Ephemeral cache for storing and retrieving data across your functions".
  - Marketplace quote: "through providers like Neon, Upstash, and Supabase"; provision with `vercel install neon` / `vercel install upstash`.
  - Redis (Upstash) and Postgres (Neon) access is over network clients, so async; Blob and Global Config SDK reads are async. The page does not use the word synchronous. Synchronous-safe store: none documented (inferred; a synchronous node:fs JSON file would need rewriting to await).

## 7. Cron jobs

- URL: https://vercel.com/docs/cron-jobs/usage-and-pricing (Last updated July 15, 2026) (sourced)
  - Table: "Hobby 100 cron jobs Once per day Per-hour (±59 min) / Pro 100 cron jobs Once per minute Per-minute".
  - Quote: "Hobby accounts are limited to cron jobs that run once per day. Cron expressions that would run more frequently will fail during deployment."
  - Quote: "Cron Jobs are a legacy feature and will be migrated to Schedules in the future."
  - Cron jobs invoke Vercel Functions, so same limits/pricing apply. A 60 s watcher tick = Pro minimum interval; not possible on Hobby.
  - Long-running continuous process: not a cron; docs mention Daemons/Background Workers (not read, see 5).

## 8. Client IP header

- URL: https://vercel.com/docs/headers/request-headers (Last updated December 13, 2025) (sourced)
  - `x-forwarded-for`: "The public IP address of the client that made the request." Quote: "we currently overwrite the X-Forwarded-For header and do not forward external IPs. This restriction is in place to prevent IP spoofing."
  - `x-vercel-forwarded-for`: "This header is identical to the x-forwarded-for header. However, x-forwarded-for could be overwritten if you're using a proxy on top of Vercel."
  - `x-real-ip`: "This header is identical to the x-forwarded-for header."
  - Custom XFF: "Trusted Proxy is available on Enterprise plans".
  - Which one is overwritten: x-forwarded-for is stated as overwritten; the page does not separately state overwrite for x-real-ip or x-vercel-forwarded-for, only that they are identical to it. (Behind a Vercel rewrite to an external origin, x-real-ip and x-forwarded-for carry the visitor IP, per the rewrites page.)

## 9. Pricing for a small demo

- Fluid compute pricing (sourced). URL: https://vercel.com/docs/functions/usage-and-pricing (Last updated June 16, 2026)
  - Hobby: Quote: "Hobby includes monthly allowances for Active CPU, Provisioned Memory, and Invocations." Table: Active CPU 4 hours, Provisioned Memory 360 GB-hrs, Invocations 1 million included.
  - Pro: no included allowance; "Vercel bills Pro usage on demand, and your monthly Pro usage credit can offset those charges." Invocations $0.60 per million; Active CPU (iad1, Washington D.C.) $0.128 per hour; Provisioned Memory (iad1) $0.0106 per GB-hr.
  - Billing model quotes: "Vercel bills Active CPU only while your code is actually running." and "If the request is waiting on I/O, CPU billing pauses but memory billing continues."
  - Hobby over limit: "A paused production deployment stops serving traffic, and visitors see a 503 DEPLOYMENT_PAUSED".
  - Fair-use page (https://vercel.com/docs/limits/fair-use-guidelines) repeats Hobby: Active CPU 4 hours, 1,000,000 invocations; Pro "Starting at $0.128 per hour".
  - Pro monthly credit amount and Pro seat price: not extracted (not found in fetched text).
- Hobby and commercial use (sourced). URL: https://vercel.com/legal/terms
  - Quote: "You shall only use the Services under a Hobby plan for your personal or non-commercial use."
  - Docs page https://vercel.com/docs/plans/hobby (Last updated November 12, 2026): "Hobby plan is free"; the word "commercial" was not found in that docs page text.

## Not found
- Runtime/Node version named by Expo's Vercel section (v3 config names none).
- Whether Expo's vercel adapter hooks `runTask` into Vercel `waitUntil`.
- Setting expo-router `origin` from an env var in app.config.ts (only static app.json documented; auto-deploy does not support dynamic config).
- Any documented pattern of a Next.js site and an Expo server function in a single Vercel project.
- Whether /tmp persists or is shared across invocations or instances.
- Duration limits for non-fluid (legacy) functions on the current pages.
- A specific SSE/streaming time limit separate from maxDuration.
- An explicit statement about in-memory state across instances; reuse guarantees.
- A synchronous-safe store on Vercel.
- Pro monthly usage credit amount.
- x-real-ip / x-vercel-forwarded-for overwrite behavior stated separately from x-forwarded-for.

## Sources fetched (2026-11-15)
- https://docs.expo.dev/router/web/api-routes/ (and index.md; modificationDate November 03, 2026)
- https://docs.expo.dev/guides/environment-variables/index.md (November 02, 2026)
- https://vercel.com/docs/functions/runtimes (August 12, 2026)
- https://vercel.com/docs/functions/limitations (August 24, 2026)
- https://vercel.com/docs/functions/configuring-functions/duration (August 24, 2026)
- https://vercel.com/docs/functions/streaming-functions (September 1, 2026)
- https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package (September 3, 2026)
- https://vercel.com/docs/fluid-compute (August 24, 2026)
- https://vercel.com/docs/functions/usage-and-pricing (June 16, 2026)
- https://vercel.com/docs/cron-jobs/usage-and-pricing (July 15, 2026)
- https://vercel.com/docs/headers/request-headers (December 13, 2025)
- https://vercel.com/docs/microfrontends ; https://vercel.com/docs/routing/rewrites (August 11, 2026) ; https://vercel.com/docs/monorepos (August 11, 2026)
- https://vercel.com/docs/storage ; https://vercel.com/docs/plans/hobby (November 12, 2026) ; https://vercel.com/docs/limits/fair-use-guidelines
- https://vercel.com/legal/terms
- https://nextjs.org/docs/app/api-reference/functions/after (September 16, 2026)

## Part 2: Databricks Apps, Fly.io, Render, Vercel rewrites


## 1. Databricks Apps (docs.databricks.com/aws/en/dev-tools/databricks-apps/)
- No-identity client / public app: NOT CONFIRMED either way. The only sourced statement says access starts with OAuth.
  - sourced https://docs.databricks.com/aws/en/dev-tools/databricks-apps/networking : "Initial user requests to a Databricks app initiate OAuth authentication with the control plane to validate the session and authorize access to the app."
  - same page: "Upon successful authentication, all subsequent requests are routed directly to the serverless compute plane without traversing the control plane."
  - /auth page: "Grant CAN USE permissions only to specific users or groups who are approved to run the app."
  - A "public app" / "no authentication" option: not found on apps index, auth, networking, key-concepts, system-env pages.
- Local filesystem persistence: NOT persistent.
  - https://docs.databricks.com/aws/en/dev-tools/databricks-apps/key-concepts (Last updated Nov 12, 2026): "Local file system for temporary files during app execution. This data is lost when the app restarts."
  - same: "Apps don't preserve in-memory state after restarts."
  - same: persistent options are "Databricks tables using Databricks SQL for persistent structured data" and "Workspace files for persistent unstructured data."
  - Redeploy specifically (separate from restart): not found.
- Always on / background process: partly.
  - key-concepts: "An app can have one of the following statuses: Running, Stopped, Deploying, or Crashed." and "Stopped - The app is not accessible and doesn't incur any costs."
  - apps index (Last updated Oct 29, 2026): "Apps are billed per hour of compute time while running, based on provisioned capacity."
  - Auto-idle-stop: not found. Statement that an app may run a second/background process: not found. system-env page: "DATABRICKS_APP_PORT The network port the app should listen on." app.yaml page (Nov 12, 2026) defines the run command; background processes not stated.
- Node.js: sourced https://docs.databricks.com/aws/en/dev-tools/databricks-apps/system-env (Nov 12, 2026): "Node.js environment: Node.js version 22." Also "No Node.js libraries are pre-installed".
- Compute sizes/price: sourced https://docs.databricks.com/aws/en/dev-tools/databricks-apps/compute-size (Nov 12, 2026), cost per hour:
  - "Medium Up to 2 vCPUs 6 GB 0.5 DBU"; "Large Up to 4 vCPUs 12 GB 1 DBU"; "XLarge Up to 12 vCPUs 48 GB 3 DBU".
  - "If you don't specify an instance size, Databricks assigns the Medium size by default."
  - Dollar price per DBU: not found on these pages.
- Resource-limits page (.../databricks-apps/limits) returned 404; app-count limit not fetched.

## 2. Fly.io
- Volumes: sourced https://fly.io/docs/volumes/overview/
  - "Fly Volumes are local persistent storage for Fly Machines." and "...information that needs to persist after deploy or restart."
  - "The root file systems of a Fly Machine are ephemeral" (rebuilt on deploy/restart).
  - "A volume can attach to one Machine"; one volume per Machine, one Machine mounts one volume.
  - Warning on page: "Always provision at least two volumes per app. Running an app with a single Machine and volume leaves you at risk for downtime and data loss."
  - Snapshots: "Fly.io takes daily snapshots and can retain them from 1 to 60 days (5 days by default)".
- Always running: sourced https://fly.io/docs/launch/autostop-autostart/
  - "The options are "off" (equivalent to false), "stop" (equivalent to true), or "suspend"." and "If "off", Fly Proxy will never stop Machines."
  - "set auto_stop_machines to "off" and auto_start_machines to false to turn off autostop/autostart completely."
- Price: sourced https://fly.io/docs/about/pricing/
  - "Started Machine, shared-cpu-1x with 256MB RAM $2.19/month Smallest Machine size."; 512MB $3.69/month; 1GB $6.70/month.
  - "Volume $0.15/GB/month". 256MB machine + 1 GB volume = $2.34/month; 512MB + 1 GB = $3.84 (inferred arithmetic). Excludes egress ($0.02/GB NA/EU) and dedicated IPv4 ($2/month, optional per the page row).
  - Page: "The cheapest always-on app is a shared-cpu-1x Machine with 256MB of RAM in Ashburn (iad) or Secaucus (ewr)."
  - Whether 256MB suffices for Node: not assessed.
- Two processes: sourced https://fly.io/docs/apps/processes/
  - "Process groups are a way to configure a single Fly App to run multiple different programs."
  - "Every defined process runs in its own Fly Machine(s) within the app".
  - Inferred: with one volume per Machine (volumes page) and one Machine per process group (this page), two process groups cannot share one volume. Two processes inside ONE Machine: not described on the processes page (not found).
- HTTPS on fly.dev: sourced https://fly.io/docs/networking/custom-domain/ : "When you create a Fly App, it is automatically given a fly.dev subdomain, based on the app's name." and "have HTTPS set up for you as it is with your .fly.dev domain."

## 3. Render
- Disk plans: sourced https://render.com/docs/disks : "You can attach a persistent disk to a paid Render web service, private service, or background worker."
  - Free web service: https://render.com/docs/free : "Whenever a service spins down, any changes to its local filesystem are lost" (spins down after 15 minutes idle).
- Zero-downtime: disks page: "Adding a disk to a service prevents zero-downtime deploys." Reason: "When you redeploy your service, Render stops the existing instance before bringing up the new instance."
  - Also: "You can't scale a service to multiple instances if it has a disk attached."
- Price: sourced https://render.com/pricing (compute table row text from HTML): "Less than 1 CPU | $7/month | 512 MB RAM | 0.5c-512mb". Disk: "SSDs for $0.25/GB per month". Smallest paid + 1 GB disk = $7.25/month (inferred). Page date: not shown.
  - Same page also has "Expandable storage ($0.30/GB)" in an unclear product context (not verified as disks).
  - Workspace plans: Hobby "$0 /mo + compute", Pro "$25 /mo + compute". Whether Hobby workspace allows paid instances/disks: not found.
- Worker/cron alongside: https://render.com/docs/cronjobs : "There is a minimum monthly charge of $1 per cron job service." A disk can attach to a paid background worker (disks page). A cron job sharing the web service's disk: not found (disks page lists only web, private, worker). Background worker per-plan price: not found as text.
- HTTPS: https://render.com/docs/web-services lists "Free, fully managed TLS certificates".

## 4. Vercel rewrites (https://vercel.com/docs/routing/rewrites)
- External origin: sourced: "An external origin is any API or website outside your Vercel project. Rewrites to external origins forward requests to these destinations, effectively allowing Vercel to function as a reverse proxy or standalone CDN."
  - Use listed: "Proxy API requests: Hide your actual API endpoint".
  - Next.js: "In Next.js, add the rule to rewrites() in next.config.js and return it in the beforeFiles array".
  - Page uses `:path*` wildcard syntax (e.g. "/uk/:path*"); a verbatim `/v1/:path*` to an external https destination is not shown (inferred from the wildcard syntax).
  - Caching: "Vercel honors cache-control, CDN-Cache-Control, and Vercel-CDN-Cache-Control headers from upstream servers on external rewrites." Default-on for projects created on or after April 6, 2026; opt out with header x-vercel-enable-rewrite-caching set to 0.
- Streaming / SSE through rewrite: NOT FOUND. Searches for "server-sent", "text/event-stream", "SSE", "stream" on the rewrites and limits pages returned no relevant statement.
- Timeout: sourced https://vercel.com/docs/limits : "Proxied Request Timeout (Seconds) 120 120 120" (Hobby, Pro, Enterprise). Text: "The maximum timeout is 120 seconds (2 minutes)." and "If the external server does not reply until the maximum timeout is reached, an error with the message ROUTER_EXTERNAL_TARGET_ERROR will be returned." Whether 120 s is time-to-first-byte or total duration: not found.

## Not found
- Databricks: public/unauthenticated app access; per-DBU dollar price; auto-idle stop; background-process statement; redeploy vs restart filesystem; limits page (404).
- Fly: two processes in one Machine.
- Render: background worker per-plan price; cron sharing a disk; Hobby plan disk eligibility; page dates.
- Vercel: SSE/streaming passthrough on rewrites; whether 120 s is total or first-byte.

## Sources fetched
https://docs.databricks.com/aws/en/dev-tools/databricks-apps/ ; /system-env ; /auth ; /compute-size ; /app-runtime ; /key-concepts ; /best-practices ; /networking ; /app-development (200); /limits and /resource-limits (404)
https://fly.io/docs/volumes/overview/ ; /docs/launch/autostop-autostart/ ; /docs/about/pricing/ ; /docs/apps/processes/ ; /docs/networking/custom-domain/
https://render.com/docs/disks ; /pricing ; /docs/cronjobs ; /docs/background-workers ; /docs/free ; /docs/web-services ; /docs/compute-plans
https://vercel.com/docs/routing/rewrites ; https://vercel.com/docs/limits
