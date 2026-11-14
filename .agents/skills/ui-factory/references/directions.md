# Stage 3. Directions

Open when: full size, after the screen frame, for a big screen. Read before this stage runs: `.agents/vendor/emil/prototype/SKILL.md` (its named-axis rule is used here for images; its picker in `.agents/vendor/emil/prototype/PICKER.md` is read and used only when directions are built as live coded variants instead of images, for example a small component question in an existing shell).

His rules: the brand is fixed and "the layout and exact wording and everything else should be up to inference and pseudohallucination"; "the prompt given to it isnt too rigid"; "each ideation should show different things"; "think about the system as a whole". Ideation is for "bigger screens where an agent has to infer more intent" and "shouldn't be done for every sub state".

## What the image model is given (one prompt per direction)

1. Purpose, audience, platform and viewport, written as if the product already exists.
2. The image card from `brand/image-card.md`, with the actual swatch and board images attached as image inputs. A file name written in the prompt is not an image input (ui-continuity.md).
3. One named structural axis for this direction, decided in text first: navigation model, information hierarchy, density, or what leads the screen. No two directions share a position on an axis (Emil's `prototype`: "Variants diverge on a named axis"; "If two proposed directions would differ only in accent color or copy, they are one direction").
4. The state list, and the few strings that must read correctly.
5. "App content only, no device frame", because device chrome belongs to the code.
6. Measured anchors where they matter: intended CSS viewport, control heights, real font files (ui-continuity.md). Output raster size does not establish CSS scale.

Not given: a layout, zones or a wireframe; the full token file; long ban lists; screenshots of unrelated layouts; the other directions; layout menus, numeric dials or style variation engines from the old image skills.

Readability rules carried from the kept image skills (source: `imagegen-frontend-mobile` sections 13, 15, 18, 29 and `imagegen-frontend-web` "Background-image harmony" and "Mobile-implied fidelity", in `~/.local/share/harness-reset-backup/2026-11-12/codex/skills/`; restated, no licence file was found there). Put these in the image card's words where they describe legibility:
- Text must never feel small; if it does, simplify, cut content, enlarge or split the screen rather than shrink type. Readable beats dense and decorative.
- Text over imagery gets protection (a scrim, fade or mask); raw images under text are not used.
- Phone screens respect safe areas, the status bar, bottom navigation, the home indicator and gesture space; critical controls stay out of unsafe regions. Screens look like app screens, not posters.
- Tap-friendly hit sizes and readable captions even in desktop images.
- Anti-clutter: no box-in-box-in-box nesting, no filler pills, badges, pseudo-system labels or fake metadata; fewer, stronger containers and one primary framing move.

## Form of a direction image

The screen's main region at its real viewport, in the brand, app content only. Not a set of finished full pages. One large readable image per screen or section; never a whole site shrunk onto one board. Names by character ("Quiet", "Dense ledger"), never "Option A". How many follows how uncertain the screen is ("Do not impose a fixed number of generations", his method); Emil's default of three in `prototype` is a starting point, not a rule. The edge states go into the same brief; one sheet or separate images is left to the agent per screen (untested).

## What is kept from an image

Kept: the structural idea (what leads, the navigation model, density, the primary action) and proposed features as hypotheses. Not kept: generated lettering as final copy, invented counts or data, exact pixel values, font identity. A generated invention stays a candidate until selected.

## Image hygiene

Before anything moves on, regenerate (do not combine or crop) images that are unreadable, near-identical or missing the task. For a section that needs a closer look, generate a fresh standalone image of the same design rather than cropping an old one (image-to-code "Do not crop old images" and "Fresh re-generation"). Record lineage: which inputs and which call made each image.

## Making images

- Inside Codex: use the built-in image tool (`image_gen`) on his subscription. Do not start a nested Codex.
- From Claude Code: ask Codex by command line, which uses his subscription. Tested once on 2026-11-13 (heard row 33):
  ```
  codex exec --ephemeral -s workspace-write -C <project>/brand/directions \
    -i <swatch.png> -i <board.png> \
    "Use your built-in image generation tool. <the direction prompt>. Save each image as PNG in this folder with the names <names>. Reply with the file paths only."
  ```
  Then open each file and look at it at readable size. Do not pass a model flag; his Codex default applies. Never claim generation happened without the files.
- Anything billed to an API key is flagged to him before it runs. Today that includes the Codex `imagegen` skill's fallback script, which needs `OPENAI_API_KEY`. Subscription use is not flagged.
- If no image generation is available: say so and build from inspected reference pixels. Never substitute imagined images.

## Evidence against (keep in view)

No controlled study of screen ideation with a current image model exists in the notes; the guidance is vendor guides about other models (ui-image-handoff.md:3, :119). Long prompts can reduce variety (ui-image-handoff.md:31), so keep the card short. Impeccable says Operate and Read surfaces "come out better built than pictured" (ui-expert-process.md:21); this is why most screens run at light size.
