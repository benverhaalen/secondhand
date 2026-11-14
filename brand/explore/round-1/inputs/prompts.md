# secondhand brand showcase prompts (ui-factory Stage 1, brand iteration)

Shared card (prepend to every prompt):

secondhand is a shipping iPhone app for students and casual sellers who buy and sell used stuff across eBay, Depop, Poshmark, Mercari and Facebook Marketplace from one place. Each item becomes a measured "item card"; you approve price, pickup and address with one tap; the app handles the rest. Calm, not AI-in-your-face: no chatbot, decisions are buttons.
Brand: the wordmark is all lowercase "secondhand" (see wordmarks@2x.png). Palette (swatch.png): flower yellow for grounds and highlights, never for text; center red only for small dots and alerts; black for all text and the primary button; white page. Signature: a five-petal yellow flower with a red center.
SCALE, the most important rule: this must look exactly like a real iPhone screen viewed at true size, not enlarged. The attached true-scale render (true-*-today@3x.png) is 390 x 844 points at 3x. Match its element sizes exactly: body text 15 pt, small uppercase mono labels 11 pt, card titles 20 pt, the big headline 32 pt, buttons 48 pt tall, 20 pt side margins, a 44 pt navigation bar and an 84 pt tab bar. Image models usually draw UI about 1.5x too large; draw it at the reference's size, so the screen shows as much content as the reference does or more. App content only, no device frame, no hands, no desk. Real iOS status bar and home indicator. Readable text, no lorem ipsum, no fake badges, no box-in-box nesting.
Output: portrait PNG, the whole 390 x 844 pt screen.

Directions (one named axis: how loud the brand is and where it lives):

1. flower (quiet ground, the flower is the signature). Inputs: swatch.png, wordmarks@2x.png, true-C-today@3x.png. White page, Clofie-style geometric sans for the wordmark and headlines, a neutral grotesk for UI text, tiny mono uppercase labels. Yellow appears only as the round center camera button with the flower and as a highlight behind money. Red only as unread/alert dots.
   a) screen "today": the home review inbox of 2 to 4 one-tap decision cards (an offer to accept or counter, a pickup to confirm, a price drop suggestion).
   b) screen "sold": an item just sold on Depop; the app is delisting it from the other 4 platforms, one row per platform with status, one failed in red with a retry.
   c) screen "deal check": an iOS share sheet sheet over another marketplace app, showing whether a listing is a good deal: a typical price band, the sample size, and a verdict.

2. ledger (calm, editorial, like a measured report). Inputs: swatch.png, wordmarks@2x.png, true-B-today@3x.png. Neue Montreal-style grotesk everywhere at Book weight, Medium only on buttons; headlines in two luminances (second phrase 45% black) instead of bold; uppercase mono labels for units, steps and sources; thin 1 px rules and tables; yellow only highlights the number you keep; red dot only for alerts. Same three screens a), b), c).

3. sticker (loud, thrift-store price stickers). Inputs: swatch.png, wordmarks@2x.png, true-A-today@3x.png. A full-bleed yellow header area with the black wordmark, prices shown on round yellow thrift-store dot stickers, heavy geometric sans (Clofie-style semibold) headlines, black cards with white text for the main action, red only for alerts. Same three screens a), b), c).

File names: brand/showcase/<direction>-<screen>.png, for example flower-today.png.
