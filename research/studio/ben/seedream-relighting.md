# How do we relight and restage item photos with Seedream 5.5 without misrepresenting the item?
Researched 2026-11-14 by Ben (Claude Code). Feature: studio.

Ben: wrinkly item, weird lighting; user picks studio, garage or home; use Seedream 5.5, not the ChatGPT image model; use all the photos to build an accurate representation, correct color, like reference-to-video models that keep a person consistent.

## What Seedream 5.5 is

- Released Nov 9, 2026 as the successor to Seedream 5.0 Pro [observed, https://docs.comfy.org/tutorials/partner-nodes/bytedance/seedream-5-5].
- Text-to-image and edit with **up to 10 reference images** (each up to 30 MB / 36 MP) [observed, https://runware.ai/seedream-5-5].
- Output 1K, 1.5K, 2K presets or custom 0.92–4.62 MP; transparent background (`background: transparent`, PNG/WEBP); layer decomposition into up to 99 named transparent layers [observed].
- Claims pixel-level stability of unedited regions over long edit chains (ByteDance says 100 rounds) [asserted]; a reseller saw no drift over 3 rounds [asserted, third-party test, https://blog.siray.ai/seedream-5-5-api-pricing-prompts/].
- Price: $0.02 per image up to 1.5K, $0.035 at 2K, +$0.008 per reference image on Runware; OpenRouter from $0.02, slug `bytedance-seed/seedream-5-5` [observed, https://openrouter.ai/bytedance-seed/seedream-5-5].
- Latency: P50 about 24 s on OpenRouter [observed]; 19–40 s in a third-party test.
- Caveat: background cut-outs are **redrawn, not masked**, so the output is a close copy, not the original pixels [asserted, Runware].

## Adjacent prior art to adapt

- **Reference-to-video identity** (Ben's analogy): the model gets several views of one subject and keeps it consistent. Seedream's 10 references do this for stills: pass front, back, tag and close-ups together [inferred].
- **IC-Light** (open-source relighting) and Luma/Jasper relight tools show relighting as its own operation separate from background swap [asserted, from memory for current state].
- **Size AI TrueShape / Photo Studio**: real cut-out in 1–2 s plus AI ghost-mannequin or model shots in 15–30 s [asserted]. Same split we want: real cut-out as evidence, AI scene as presentation.

## Recommended pipeline

1. **Color-correct the real photos deterministically first.** Use the white paper or card in the first shot to compute a white-balance gain; apply it to every shot from that session. Optional: a printed color patch for full correction. This is classic photography, not AI, and it fixes "weird lighting" on the evidence photos without inventing anything [inferred].
2. **Clean evidence image.** Segment the item (SAM 2 / BiRefNet or Seedream transparent mode) and place it on white. Seedream redraws, so for evidence use a pixel mask from a segmentation model, not Seedream [inferred from Runware's caveat].
3. **Scene renders.** One Seedream edit per preset, with all capture shots as references (≤10) and a prompt that names what must not change, which third-party tests found more stable than describing the scene:
   > "Image 1 is the item. Images 2–6 are other views of the same item. Keep the item's shape, proportions, color, fabric texture, logos, tag and every visible mark or stain exactly as in the references. Change only the setting and lighting: [studio: seamless white sweep, soft key from upper left | garage: concrete floor, cool overhead daylight | home: wooden floor, warm window light]. Remove wrinkles only where no defect is visible."
   Presets are fixed prompts, so the user just taps one.
4. **Fidelity gate.** Run the Decisions fidelity questions (`research/identify/ben/openai-decisions-api.md`) with the render plus the originals as references, and compute a color difference (mean ΔE in Lab inside the item mask) between render and the color-corrected original. Reject on failure, retry once, otherwise ship only the evidence image. Show the user a before/after slider with "real" and "styled" labels.
5. **Labelling.** Renders carry a "styled" badge in our app and go after the real photos in the marketplace listing (see decision 1 in `research/cross-cutting/ben/tech-stack-overview.md`).

## Cost per item (estimate)

3 presets × ($0.035 + 6 refs × $0.008) ≈ $0.25, about 25 s each in parallel [inferred from observed prices].

## Risks

- Defects silently "fixed" by the model is the worst outcome (misrepresentation). The gate and the unedited defect close-ups are the guard.
- Which host to use: OpenRouter routes to ByteDance's own "Seed" provider [observed]; Runware and others are resellers. BytePlus ModelArk was not confirmed in what I read.
