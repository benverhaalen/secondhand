# What photo shape and size does each resale site want, and what one capture frame crops cleanly to all of them?
Researched 2026-11-15 by Ben (Claude Code, Opus 5.5). Feature: capture.

Evidence marks: *observed* (I opened the source today and it says so; pages were read through a fetch summarizer, so exact wording should be re-read before it is quoted in the pitch), *asserted* (the source claims it without showing it, or memory), *inferred* (my reasoning).

## 1. The question, the decision, the draft

Ben, 06:19 ([words](../../../product/words.md#2026-11-15-notes-on-the-first-gallery-today-must-explain-itself-you-is-a-dashboard-the-camera-frames-the-listing-photo)): "you need to ensure the frame size is whatever the photo size should be ... be intentional about the frame size that you intend to put on these sites. And I hope you've ... researched which one is."

**Decision it feeds:** the frame the camera draws ([pages §6.5](../../../spec/pages.md#65-camera)), drawn the way the iOS camera draws 1:1 or 4:3: the area outside the frame dimmed, crisp corners.

**Draft from memory, before searching:** most sites show a square; Poshmark went portrait; Grailed and Vinted are portrait 4:5; Etsy prefers landscape 4:3. So shoot square, since it is the common shape.

## 2. What each site wants

| Site | Shape the buyer sees first | Size | Mark |
|---|---|---|---|
| eBay | "photos in a 1:1 or 16:9 aspect ratio look best"; square in search | minimum "500 x 500 pixels", "about 1600 x 1600" recommended, up to 12 MB | *observed* ([eBay help, adding pictures](https://www.ebay.com/help/selling/listings/adding-pictures-listings?id=4148)) |
| Poshmark | "larger 3:4 portrait layouts", from the app redesign of 2026-03-25 | no pixel size published | *observed* ([Value Added Resource, 2026-03-25, updated 2026-04-10](https://www.valueaddedresource.net/poshmark-reimagines-app/)); earlier note: [platform-fit](../../list/ben/platform-fit.md) |
| Depop | square | 1280 x 1280 practical; 640 minimum | *asserted* ([depop note](../../list/ben/platforms/depop.md), Ben); Depop's own photo guide says nothing on shape *observed* ([Depop blog](https://blog.depop.com/articles/lets-talk-photography)) |
| Mercari | square preview | "up to 12 photos"; no shape on the help page | count *observed* ([Mercari help 451](https://www.mercari.com/us/help_center/article/451)); square *asserted* ([Crosslist docs](https://docs.crosslist.com/knowledge-base/image-management/cropping-strategy), [mercari note](../../list/ben/platforms/mercari.md)) |
| Facebook Marketplace | square feed tile; the listing page shows any shape | about 2048 px long edge after upload | *asserted* ([facebook note](../../list/ben/platforms/facebook-marketplace.md)); no Meta spec found |
| Vinted | 4:5 portrait in the app | "up to 20 images"; no size published | count *observed* ([Vinted help 375](https://www.vinted.com/help/375)); 4:5 *asserted* ([Closo help, 2026-06-14](https://help.closo.co/a/how-photos-work)) |
| Etsy | first photo "horizontal (landscape) or square"; thumbnails are "cropped to square, portrait, and landscape"; Shop Home shows squares since August 2023 | first photo at least 635 px on each side; "at least 2000 pixels" recommended | *observed* ([Etsy help 115015663347](https://help.etsy.com/hc/tr/articles/115015663347), [Etsy announcement](https://community.etsy.com/t5/Announcements/We-re-making-updates-to-size-and-ratio-for-listing-images/td-p/142858294)) |
| Grailed | portrait, about 4:5 | 1600 x 2000 proposed | *asserted* ([grailed note](../../list/ben/platforms/grailed.md)); no Grailed help page found |
| OfferUp | the first photo is the cover in the main feed; square tile | none published | feed *observed* ([OfferUp help 360031995352](https://help.offerup.com/hc/en-us/articles/360031995352)); square *asserted* ([offerup note](../../list/ben/platforms/offerup.md)) |

## 3. What changed from the draft

**The draft was wrong.** Shooting square loses Poshmark, Vinted and Grailed: a portrait crop cannot be cut out of a square without padding, and eBay bans added borders *observed* ([ebay note](../../list/ben/platforms/ebay.md)). The shapes run from 3:4 portrait (the tallest, Poshmark) to 1:1 (most sites) to Etsy's landscape. A frame must be at least as tall as 3:4 and as wide as 1:1 *inferred*.

## 4. The frame

**Capture 3:4 portrait, and keep the item inside the centered square** *agent proposal*.

- 3:4 portrait is the phone's own photo shape held upright (a 12 MP sensor is 4032 x 3024), so nothing is thrown away and the iOS camera's default 4:3 frame is what people already know *inferred*.
- From one 3:4 still: Poshmark keeps all of it; Vinted and Grailed trim 3.75% top and bottom to 4:5; eBay, Depop, Mercari, Facebook, OfferUp and Etsy's square views trim 12.5% top and bottom to 1:1 *inferred*. The item inside the centered square survives every crop.
- Size: at 3024 px across, the square is 3024 x 3024, above Etsy's 2000 recommendation, eBay's 1600 and Depop's 1280 *inferred*. The camera refuses nothing smaller than 2000 px on the short side.
- What it gives up: Etsy's landscape thumbnail cuts the top and bottom of a tall garment. Etsy accepts a square first photo *observed*, so Etsy gets the square cover *inferred*.

How it is drawn: the 3:4 frame with everything outside dimmed, the four corners crisp, and the square marked inside it by four short corner ticks, the way the iOS camera marks its grid *agent proposal*.

## 5. References and their jobs

- eBay, Etsy, Mercari, Vinted and OfferUp help pages: **evidence**, the rawest sources for shape and size. Etsy's is the most specific: it names all three thumbnail crops.
- Value Added Resource on Poshmark: **evidence**, a trade press source that quotes Poshmark's own press release.
- Closo and Crosslist docs: **weak signal**, listing-tool vendors stating rules they enforce; they disagree on Poshmark (Crosslist still says 1:1), which shows their pages lag.
- The platform notes in [research/list/ben/platforms](../../list/ben/platforms): **evidence** gathered on 2026-11-14 with their own marks.

## 6. Searched, and not reached

Searched: each site's help center for photo size and aspect; Poshmark 3:4 news; Vinted and Grailed display shape. Not reached: a Grailed help page on photos, a Meta spec for Marketplace photo sizes, a Vinted statement of display shape, Poshmark's help center (it refuses automated readers). A narrow search does not show these do not exist.
