# Control sources: Vercel UI SDK first, Emil's pick where it does not cover

Open when: the build is about to choose any library or write any interactive control. Ben's rule: "can you have them both overlap in it. like where ui sdk doesnt cover use emil's".

One row per category in Emil's `pick-ui-library` (`.agents/vendor/emil/pick-ui-library/SKILL.md`, commit f7ce8c0). SDK coverage comes only from `N/harness-overhaul-seeds/vercel-ui-sdk.md` and `raw-vercel-ui-sdk/extracts.md` (the core export list and docs extracts).

| Category (Emil) | Emil's pick | SDK covers it? | Source used |
|---|---|---|---|
| Unstyled accessible components (dialogs, popovers, menus, selects) | base-ui | covered (dialog, popover, menu, select and the rest of the core list) | SDK |
| Command menus | cmdk | covered (`command`) | SDK |
| Toasts | Sonner | covered (`toast`) | SDK |
| One-time password inputs | input-otp | covered (`otp-input`) | SDK |
| Customizable GUIs / control panels | Leva (dialkit alternative) | not covered | Emil |
| General animation (springs, layout, enter/exit) | motion | not covered (SDK keeps elements present until exit ends and gives gesture math; its docs send movement to CSS, View Transitions or a motion library) | Emil |
| Animating numbers | NumberFlow | not covered | Emil |
| Animated text | torph | not covered | Emil |
| 3D globes | Cobe | not covered | Emil |
| Dynamic OG images | Satori | not covered | Emil |
| Syntax highlighting | shiki | not covered | Emil |
| Real-time / streaming charts | Liveline | not covered | Emil |
| General charts | recharts | not covered | Emil |
| Drag and drop | dnd kit | covered (drag-and-drop foundation; real-browser problems reported in issue #475) | SDK |
| Virtualization (long lists, large tables) | Virtuoso | not known from the notes (a `lists` foundation exists; virtualization is not named) | check SDK docs, then Emil |
| State management | zustand | not covered | Emil |
| Conditional className strings | clsx | not covered | Emil |
| Variant-driven Tailwind styling | cva | not covered | Emil |
| Theme switching / dark mode without flash | next-themes | not known from the notes (`preferences` and `storage` foundations exist) | check SDK docs, then Emil |

Counts: 5 covered, 12 not covered, 2 not known.

Rules:
1. Covered: use the SDK. Emil's pick for that row is not used, even if the project already has it, unless the framework is unsupported; then write a `ui-sdk-exception:` reason.
2. Not covered: use Emil's pick, following his "check what's already installed" step. No reason line is needed; `sdk_controls.py` accepts these libraries.
3. Not known: before choosing, check the SDK's current docs (`node_modules/@ui-sdk/<framework>/docs/llms.txt`, or https://ui-sdk.dev/docs). If the SDK has it, use the SDK and update this row; if not, use Emil's pick and write a one-line reason, which `sdk_controls.py` requires for these rows.
4. A need in neither list: say you have left both lists, as Emil's skill asks, and write a reason line.
