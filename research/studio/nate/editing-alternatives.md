# Besides Seedream, which image-editing models and APIs can clean up a used-item photo (background, light, shadow) while leaving the item's own pixels unchanged, and what does each offer for masks, detail retention, speed and price?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: studio.

Marks: *observed* = page opened and bytes read this session; *asserted* = source claims; *inferred* = my reasoning. Most vendor pricing pages carry no date; "undated" means the page showed none. Prices expire; re-check before use.

## 0. What the existing notes already say, and where this extends them

- Confirms: Seedream has no mask and redraws cut-outs, so a segmentation mask is needed for evidence ([seedream-relighting.md:14](../ben/seedream-relighting.md), [seedream-relighting.md:25](../ben/seedream-relighting.md), [build-plan.md:74](../ben/build-plan.md), [build-plan.md:137-138](../ben/build-plan.md)).
- Extends: the composite fallback "SAM 3 or BiRefNet" ([build-plan.md:272](../ben/build-plan.md)) now has licences and prices below. The brief's tools "not reached" in [build-plan.md:344](../ben/build-plan.md) (SwitchLight, Claid, Pebblely, Flair, Picsart) are still not reached here.
- Extends: IC-Light and Luma/Jasper were "from memory" ([seedream-relighting.md:19-20](../ben/seedream-relighting.md)). IC-Light licence and a fal v2 price are now observed (section 6). Luma/Jasper stays unobserved.
- Confirms and narrows: the Photoroom 28 to 29% figure ([build-plan.md:156](../ben/build-plan.md), [studio.md:128](../../../spec/features/studio.md)). The primary page (observed, published 2026-07-06) tests flat-lay to virtual-model generation on Nano Banana 2, Nano Banana Pro, GPT Image 2 Medium and FLUX.2 Klein 9B, best pass rate 29.0% under a one-flag-fails rule. It does not test background cleanup or relight of a single item. This matches the caveat at [scan-to-images.md:154](../../capture/nate/scan-to-images.md).
- Extends the studio spec's statement "no host offers a mask" ([studio.md:126](../../../spec/features/studio.md)): that is true for Seedream only. Flux Fill and gpt-image take masks (sections 3 and 8).
- The Etsy "unaltered photo" rule stays *asserted*, page unopened ([studio.md:87](../../../spec/features/studio.md), [scan-to-images.md:101](../../capture/nate/scan-to-images.md)). Not re-checked here.

## 1. Photoroom API

- Pricing page (observed, https://www.photoroom.com/api/pricing, undated): Basic plan remove-background $0.02 per image; Plus plan (AI backgrounds, AI shadows and other edits) $0.10 per image.
- Edit endpoint `v2/edit` (observed, docs.photoroom.com image-editing-api pages, docs last updated "7 months ago" at fetch): parameters `removeBackground`, `background.color`, `padding`, `shadow.mode=ai.soft`; a newer `shadow.mode=ai.auto-with-overrides` is selected with header `pr-ai-shadows-model-version: 2026-04-15`.
- Detail retention (observed, docs FAQ "Will the API make alterations to my products?"): by default the API removes the background and repositions and adds effects around the isolated subject, so "it's simply not possible to introduce alterations such as modifying a logo". Features the docs list as able to alter: AI Relight ("can alter colors"), AI Text Removal, AI Uncrop, AI Expand, AI Beautifier, AI Upscale, Describe Any Change. The docs recommend human validation when accuracy matters.
- Design consequence (inferred): cut-out plus background colour plus soft AI shadow stays in the "no alteration" default set; relight does not.
- Masks: no input mask found in what I read (not-found). Output of the cut-out is the subject isolated by the API.
- Speed: not found.
- A docs page for AI Relight at `/image-editing-api/lighting` returned 404; `/ai-relight`, `/pricing` under image-editing-api also 404 (observed). Relight price and parameters not found.

## 2. Clipdrop (Stability) and Jasper

- Clipdrop pricing page returned almost no text through curl and Exa (observed, stripped). No price, no mask terms, no Jasper relation extracted. Not found.
- Jasper: nothing observed. Remains asserted from memory at [seedream-relighting.md:19-20](../ben/seedream-relighting.md).

## 3. Flux.1 Kontext and Flux Fill (BFL, fal, Replicate)

- Kontext prices (observed, BFL docs page script data, undated; derived, because bfl.ai/pricing returned stripped text): `priceUnit` 4 credits for pro and 8 for max, with 1 credit = $0.01, so $0.04 and $0.08 per image. This is a derivation from page data, label it so.
- Kontext [dev]: $0.025 per MP on fal (observed, fal model page, undated). The weights licence is non-commercial unless a licence is bought (observed, model licence text).
- Kontext is an instruction editor: it redraws the whole image from text, with no mask input (inferred from the API shape; I saw no mask field). Pixel preservation of the item is therefore not guaranteed (inferred).
- Flux Fill (observed, BFL docs and fal page, undated): takes an image plus a black and white mask; white is inpainted and black is preserved. fal price $0.05 per MP. Whether the black region is bit-exact after the latent round trip was not verified (not-found); a hard-paste of original pixels after the call removes the question (inferred).
- Speed for all of the above: not found in page text.
- Replicate listings: not opened (not found).

## 4. Qwen-Image-Edit

- Licence (observed, Hugging Face model card header, "License: apache-2.0", undated; the Qwen-Image README states "Qwen-Image is licensed under Apache 2.0").
- fal host page was fetched; price not extracted (not found).
- Instruction editor, no mask field seen (inferred). Detail retention: no published product test found.

## 5. Gemini image editing (Nano Banana)

- Models named in the image-generation doc (observed, https://ai.google.dev/gemini-api/docs/image-generation, undated): gemini-2.5-flash-image, gemini-3-pro-image, gemini-3.1-flash-image, gemini-3.1-flash-lite-image, and Nano Banana 2.1 (`gemini-nano-banana-2.1`).
- Price for Nano Banana 2.1 (observed, Gemini pricing page, undated): standard output images $30.00 per 1M tokens, "Equivalent to $0.0336 per 1K image, $0.0504 per 2K image, and $0.113 per 4K image"; batch $0.0168 per 1K image. Input $1.50 per 1M tokens text, image or video.
- Mask: none. The doc's "inpainting" is "semantic masking" by prompt: the model is told in words to change one element and keep everything else (observed). So preservation is by instruction, not by pixels (inferred).
- All outputs carry a SynthID watermark (observed, same doc). Relevant to the studio rule against hidden alteration and to marketplace AI rules (inferred).
- This is the challenger in [build-plan.md:66-67](../ben/build-plan.md); the price above extends it.

## 6. IC-Light (v1 and v2)

- Licence: Apache-2.0 (observed, GitHub README, undated). README describes text-conditioned relighting of a foreground with a lighting preference (Left, Right, and so on).
- fal v2 endpoint $0.1 per MP (observed, fal page, undated). Extends [build-plan.md:163](../ben/build-plan.md).
- Foreground kept: IC-Light relights the foreground, so it changes pixel values of the item by design (inferred). Build-plan's DetailTransfer idea at the same line addresses that (asserted there).
- Speed: not found.

## 7. Open background removal and licences

| Model | Licence | Mark |
|---|---|---|
| BiRefNet | MIT | observed, GitHub/HF, undated |
| InSPyReNet | MIT | observed, GitHub, undated |
| BRIA RMBG-2.0 | weights CC BY-NC 4.0 (non-commercial); commercial use through the Bria API or a licence | observed, HF model card, undated |

- The fal birefnet/v2 page showed "$0 per compute second"; treated as a rendering artifact, no price reported (not found).
- fal Bria background-removal page was fetched; price not extracted (not found).
- Composite approach (inferred): cut out with one of these masks, generate only the background and shadow, paste the original pixels under the mask. The item's pixels are unchanged by construction; edges (hair-thin fringes, glass, fur) are where a mask can fail and need the gate in [prototype/README.md:9-10](../ben/prototype/README.md). The studio gate and repair loop already match this ([build-plan.md:81-86](../ben/build-plan.md)).
- [scan-to-images.md:66-72](../../capture/nate/scan-to-images.md) section f lists SAM 3 and says BiRefNet was "not searched" (line 70); this note supplies BiRefNet and its licence.

## 8. OpenAI gpt-image edits with masks

- Edit with mask (observed, OpenAI image-generation guide, undated): the mask must be the same format and size as the image, under 50 MB, and contain an alpha channel; with multiple inputs, the mask applies to the first image. The guide says the model uses the mask as guidance and "may not follow its exact shape with complete precision". So the mask is a hint, not a pixel lock (observed).
- Pricing (observed, OpenAI pricing page, undated): gpt-image-2.6-sunburst and -flare image tokens input $8.00, output $30.00, cached input $2.00 per 1M; batch $4.00 and $15.00. Per-image dollar figures were not extracted (not found).
- `input_fidelity` is documented for earlier models; the page says to omit it for gpt-image-2 (observed). Extends [build-plan.md:142](../ben/build-plan.md), which marked the GPT Image 2.6 mask as asserted; the mask behaviour is now observed.

## 9. remove.bg

- API doc (observed, https://www.remove.bg/api, changelog dated through 2024-01-10): output up to 50 MP (PNG up to 10 MP), full-size 1 credit per image, rate limit 500 megapixel-images per minute (a 1 MP image counts 1), 429 without credit charge when exceeded; requires a foreground; `add_shadow` exists for cars.
- Dollar price per credit: JS-rendered, not extracted (not found).

## 10. Published tests of product-detail preservation

- Photoroom benchmark, 2026-07-06 (observed): see section 0. Generation task, not cleanup.
- Masonry test cited at [build-plan.md:141](../ben/build-plan.md): not re-opened here.
- No independent published test of logo, text or texture preservation for Flux Fill, Qwen-Image-Edit, IC-Light or remove.bg found (not found).
- Seedream "no drift over 3 rounds" remains a third-party reseller claim ([seedream-relighting.md:11](../ben/seedream-relighting.md)).

## Not found

- Clipdrop price and mask terms; Jasper relation.
- Photoroom AI Relight page, price and any input-mask parameter; speed for any tool.
- remove.bg dollar price per credit.
- Replicate listings and prices for Kontext, Fill and Qwen.
- Per-image dollars for gpt-image-2.6.
- BiRefNet and Bria prices on fal (rendering artifact).
- Bit-exactness of Flux Fill outside the mask.
- Independent logo, text and texture preservation tests per tool.

## Sources fetched

All fetched 2026-11-14, none dated unless stated.
- https://www.photoroom.com/api/pricing; docs.photoroom.com image-editing-api overview and FAQ pages; Photoroom benchmark page (published 2026-07-06).
- BFL docs (Kontext, Fill); fal model pages for Fill, Kontext dev and max, Qwen-Image-Edit, Bria, IC-Light v2, BiRefNet v2.
- Hugging Face model cards: BiRefNet, BRIA RMBG-2.0, Qwen-Image-Edit; GitHub READMEs: InSPyReNet, IC-Light.
- https://ai.google.dev/gemini-api/docs/image-generation and the Gemini pricing page.
- OpenAI image-generation guide and pricing page.
- https://www.remove.bg/api and the pricing page (stripped).
- Clipdrop pricing page (stripped).

## Searched / could not reach

Searched the vendors' own docs and pricing pages listed above. Could not reach usable text for Clipdrop and remove.bg pricing, and three Photoroom docs paths returned 404. Did not search Replicate, SwitchLight, Claid, Pebblely, Flair or Picsart. A narrow search does not prove an absent item does not exist.
