# Vercel UI SDK in the factory

Open when: the build reaches its first interactive control, or at project start for the support and install check.

Facts here come only from `N/harness-overhaul-seeds/vercel-ui-sdk.md` and `N/harness-overhaul-seeds/raw-vercel-ui-sdk/extracts.md` (read 2026-11-13; N = a notes folder on Ben's Mac). Ben takes "the new vercel ui sdk" to be this one (`vercel-labs/ui`); if he meant json-render, this file changes.

## What it is

A beta library of tested interface behaviours (keyboard, focus, selection, dismissal, popups, drag and drop and their ARIA) and about 55 unstyled components built on them. "It isn't a component library. It's the layer underneath one." Repo `vercel-labs/ui`, Apache-2.0, site https://ui-sdk.dev/docs.

- Packages: `@ui-sdk/core` plus one adapter: `@ui-sdk/react`, `@ui-sdk/vue`, `@ui-sdk/svelte`, `@ui-sdk/solid`, `@ui-sdk/web` (Web Components).
- React needs React 19 and React DOM 19 or newer.
- Install (React): `npm install @ui-sdk/react @ui-sdk/core`. Per project only, never global.
- Import from per-component entries (`@ui-sdk/react/select`); never `@ui-sdk/core/internal/*`.
- Styling: none of its own; style from `data-*` state attributes and CSS variables; optional `@ui-sdk/core/web.css` default look (contrast issue #473). Declare `@layer ui-sdk;` first; with Tailwind import web.css after Tailwind with `layer(components)`.
- Components (core exports): accordion, alert-dialog, autocomplete, avatar, button, calendar, carousel, checkbox, collapsible, color-picker, combobox, command, date-input, date-picker, dialog, drawer, field, file-input, hover-card, image-cropper, input, label, listbox, menu, menubar, meter, navigation-menu, number-input, otp-input, pagination, password-input, popover, progress, radio, rating, resizable, scroll-area, segmented-control, select, separator, slider, switch, tabs, time-input, timeline, toast, toggle, token-input, toolbar, tooltip, tree, trigger-menu, waterfall. Missing ones are built from behaviours with `definePrimitive`.
- Testing: `@ui-sdk/core/testing` `checkPattern(root, "<pattern>")` for listbox, menu, menubar, tabs, radio-group, toolbar, tree, dialog, alertdialog, disclosure, accordion, combobox, slider, switch, checkbox; plus `checkServer`, `checkDirection`. Colour contrast and layout need a real browser, which `geometry_a11y.mjs` supplies.
- Agent bridge: `@ui-sdk/<framework>/agent` `createAgent()` with `snapshot()`, `act({steps})`, `query()`. Known bug: `act()` can return ok:true when the app cancelled the change (#458). Untested here as a driver for the door check.
- Rule from its own skill used by `sdk_controls.py`: "A div with role=listbox/menu/dialog... next to an installed ui-sdk package is almost always a bug."

## Its own agent skill and docs (not vendored)

The SDK ships a skill, `packages/core/skills/ui-sdk/SKILL.md` with references `agent-ready.md`, `build-interface.md`, `create-component.md`, `patterns.md`, `styles.md`, `testing.md`, `web-components.md` (about 70 KB). The raw research folder holds only extracts, not these files, so they are not vendored here. Once the SDK is installed in a project, read them from disk instead:
- `node_modules/@ui-sdk/core/skills/ui-sdk/SKILL.md` and its `references/` (read `build-interface.md` and `styles.md` before the first control; `testing.md` before writing checks; `create-component.md` when building a missing one).
- `node_modules/@ui-sdk/<framework>/docs/llms.txt` (index) and `docs/components/<name>.md` per component.
- Online: https://ui-sdk.dev/docs. Installing its skill globally (`npx skills add vercel-labs/ui --skill ui-sdk`) is not done; the copy inside the package is pinned to the project's version.

## Limits to keep in view

0.1.0-beta.2 on 2026-11-13 (npm `latest` still beta.1); public release 2026-11-12; repo 18 days old at research time; about 25 issues opened on launch day, including web.css contrast below 3:1 (#473), Tailwind preflight stripping control borders (#474), docs snippets that do not compile, Safari sheet animation (#485); APIs may change before general availability; beta terms apply. It does nothing for brand or looks. Nothing in it was installed or run during research.
