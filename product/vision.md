# Vision

The shared picture of secondhand. It changes as Ben and Nate shape it. Every line names who said it and links to their words in [words.md](words.md), or is marked *agent proposal*. Move a line to **Decided** only when both of you agree, and log the move in [decisions.md](decisions.md).

## Decided

- Build every feature from the recording; do not trim scope. Ben, [2026-11-14 18:07](words.md#2026-11-14-scope).
- The interface must stay intuitive across all features. The user should not have to think. Ben, [18:08](words.md#2026-11-14-ux) and [18:32](words.md#2026-11-14-tools-and-capture).
- Databricks is used well throughout the project, and creatively where that is warranted. Ben, [18:32](words.md#2026-11-14-tools-and-capture).
- In-app writing is minimal: show, don't say. All UI generation applies Ben's anti-claudish skill. Say it through familiar patterns, and use color and layout to direct attention ([copy.md](copy.md)). Ben, [19:45](words.md#2026-11-14-show-not-say) and [19:46](words.md#2026-11-14-familiar-and-attention).

- Platforms. The core set, which both lists and searches, is eBay, Facebook Marketplace, Depop, Poshmark and Mercari. OfferUp and Grailed come later and are search and price only. Craigslist, Etsy, Vinted and Swappa are out. Only eBay has an official listing API, so the demo posts to 3 or 4 platforms and searches the rest. Ben, [18:50](words.md#2026-11-14-platforms).

- Selling your own things comes first. Buying is a full side of the app, not an add-on: one engine identifies and values an item whether you own it or want it, and each side informs the other. Ben and Nate, decision card ([decisions](decisions.md#2026-11-14-selling-comes-first-buying-is-a-full-side)).

- Bottom bar: Today · Sell · ＋ · Buy · You. ＋ is the only way in (Sell this, What's it worth, Find this). Ben, decision card, 19:27 ([decisions](decisions.md#2026-11-14-the-bottom-bar-is-today--sell----buy--you)).

- Automation runs in tiers that learn: Auto, Ask, Never alone. An Ask promotes to Auto after 3 approvals; Never alone is locked. Ben, decision card, 19:29 ([decisions](decisions.md#2026-11-14-automation-runs-in-tiers-that-learn)); at 21:29 he added that only unedited approvals count, and "Always accept $X or more" is offered when an item is listed ([decisions](decisions.md#2026-11-14-always-accept-is-offered-at-listing-and-only-unedited-approvals-count)).

- Pickups: your time windows plus a saved public meetup spot; your home address only on a separate tap; confirmed times go to Google Calendar. Ben, decision card, 19:30 ([decisions](decisions.md#2026-11-14-pickups-use-your-windows-and-a-saved-meetup-spot)).

- Sell tab: a photo grid with state pills, in shelves by state. Buy tab: the same shelves (New matches, Watching, Bought), plus a camera and a link field in search for appraising. You tab: the numbers, a by-site comparison, then settings. Ben, 19:33 to 19:40 ([decisions](decisions.md#2026-11-14-the-sell-tab-is-a-photo-grid-with-state-pills-numbers-live-in-you)).

- All in on Databricks: Apps, Agent Bricks, Lakebase, MLflow "why?" timelines, and approvals as labels that train the tiers. Fall back to a hybrid if setup stalls for 2 hours. Ben, decision card, 19:41 ([decisions](decisions.md#2026-11-14-databricks-runs-the-whole-backend-with-a-hybrid-fallback)).

- First launch is setup first: connect sites, pickup windows and meetup spot, notifications, then Today. Ben, decision card, 19:43 ([decisions](decisions.md#2026-11-14-first-launch-is-setup-first)).

- The phone app comes first. A website with sign-in follows, with the same features except LiDAR and the guided camera (photo upload instead). Ben, [20:45](words.md#2026-11-14-app-first-and-ui-factory-after-the-brand).

- Messages: a chat icon with an unread count at the top right of every main screen; buyer messages that need you also become Today cards. Ben, decision card, 20:55 ([decisions](decisions.md#2026-11-14-all-messages-live-behind-a-chat-icon-with-a-count)).

- Capture is one session, and the item picks the mode: a guided shot list for flat clothes, a move-around scan with coverage and depth for rigid things and furniture, one more view only when it settles something. Both paths are tested on real items before either is final. Ben and Nate, decision card ([decisions](decisions.md#2026-11-14-capture-is-one-session-and-the-item-picks-the-mode)).

- Buyers are handled inside limits you set (lowest price, ship or pickup), from day one, logged and undoable; outside them the agent asks, and "Always do this" covers the rest. Ben and Nate, decision card ([decisions](decisions.md#2026-11-14-buyers-are-handled-inside-limits-you-set-then-it-learns)).

- The agent books a pickup itself inside your hours at your saved public spot; your home address goes out only on your tap. Ben and Nate, decision card ([decisions](decisions.md#2026-11-14-the-agent-books-pickups-inside-your-hours)).

- The first person we build for is someone clearing their own things, who also buys used; resellers can use it but do not shape the design. Ben and Nate, decision card ([decisions](decisions.md#2026-11-14-the-first-person-we-build-for-is-someone-clearing-their-own-things)).

## Proposed

- Guided capture: the app asks for the front, the back, the tag, close-ups and defects, one shot at a time. Each shot serves both the listing and the image model, in one list. Ben, [18:32](words.md#2026-11-14-tools-and-capture) and [18:48](words.md#2026-11-14-shots-serve-both).
- Studio photos: relight the item in a studio, a garage or a house with Seedream 5.5, built from all the captured photos with color correction. Ben, [18:32](words.md#2026-11-14-tools-and-capture).
- Measuring comes first for clothes ("the mechanism is measuring more than anything"). Ben, [18:32](words.md#2026-11-14-tools-and-capture).
- Appraise anything, for example at a garage sale: its value by platform, after defects and hidden demand. Ben, [18:36](words.md#2026-11-14-pavlo-and-appraise).
- Post once with Browser Use, then replay with Pavlo. Ben, [18:36](words.md#2026-11-14-pavlo-and-appraise).
- Center everything on one item card: a single measured record of the item that every platform listing is built from. *Agent proposal*, from the [concept brief](https://claude.ai/artifact/HCk31xVRxnrrcy5AL2Ff6U).

- Pitch: open on the economics of cheap items (consignment pays $3 of a $20 sale; doing it yourself keeps about $17 but rarely finishes), then "your second hand" as the product and a live clock as the demo. *Agent proposal*, [pitch.md](pitch.md), evidence in [pitch-evidence.md](../research/cross-cutting/ben/pitch-evidence.md).

- My SecondHand Store is the seller's private control room; secondhand runs no storefront and takes no payments, and buyers are linked out to the marketplace to pay. Nate, [words](words.md#2026-11-14-nate-store-and-buying). Agrees with Ben's "no public profile".
- Buying side: a "For you" shelf from your profile, listings and imported past purchases; saving a listing also saves, likes or carts it on its site; the agent makes offers to sellers under a ceiling you set. Nate, [words](words.md#2026-11-14-nate-store-and-buying). Ben has not answered.
- Where a site has no official connection, we build our own: a cloud browser with the user's login kept, behind one API across sites; and many more outside sources for price data. Nate, [words](words.md#2026-11-14-nate-frameworks-and-goals). Fits Ben's [harness per app](decisions.md#2026-11-14-each-marketplace-gets-its-own-harness-run-on-browser-use-cloud).
- Goals: a money goal for the month, a count of sales, progress shown. Nate, [words](words.md#2026-11-14-nate-frameworks-and-goals).

- How it earns: referral links on the buying side, and possibly selling unified, anonymous market data (what is listed, what sold recently, which ways of marketing worked). Nate, [words](words.md#2026-11-14-nate-referrals-and-market-data). Ben has not answered. *Agent note*: a referral must never decide which listing is called best; eBay's API licence bars reselling or aggregating its data ([platform-access.md](../research/connect/nate/platform-access.md), *observed*), and data from users needs their consent ([privacy-and-data.md](../research/cross-cutting/nate/privacy-and-data.md)).

## Open

- Posting with Browser Use could get users' accounts banned. Should posting be automatic or one tap by the user? *Agent proposal*: opt-in, with a warning.
- Do studio photos misrepresent the item? Buyers need to see the real defects. *Agent proposal*: always keep the real photos alongside.
- Should buyers be told an assistant is answering? Asked of both on a card; not answered. *Agent proposal*: natural voice in the seller's style, a short note on the first automatic message, always honest if asked ([handled-by-default.md](../research/messages/nate/handled-by-default.md), [privacy-and-data.md](../research/cross-cutting/nate/privacy-and-data.md)).
- The backend's front door: Databricks Apps takes only Databricks sign-in, so a phone and a marketplace webhook cannot reach it directly ([databricks-platform.md](../research/data/nate/databricks-platform.md), *observed* from docs, not yet tested on our workspace). *Agent proposal*: a thin public edge for sign-in and webhooks, everything else on Databricks; test on the real workspace first.
- Ben: "it's a demo, so build it" ([words](words.md#2026-11-14-demo-not-production)). Nate: design the whole product, and build our own frameworks where a site offers none ([words](words.md#2026-11-14-nate-frameworks-and-goals)). *Agent proposal*: each feature spec describes the whole product, records each site's rules as facts, and carries a "demo path" line that the two of you mark.
- Phone app: Ben decided Expo with a Swift camera module ([decisions](decisions.md#2026-11-14-the-app-is-an-expo-app-with-a-native-swift-camera-module)). Nate agrees if everything a native app could do in capture (Object Capture, LiDAR, our own capture systems per product type) works inside it ([words](words.md#2026-11-14-nate-expo-if-capture-is-fully-possible)). What settles it: a build task that runs Object Capture and LiDAR depth from the Swift module inside the Expo app on a real phone.

## When Ben and Nate disagree

Put both quotes side by side under **Open**, along with what depends on the answer. Then talk it through in person. Do not pick a side on their behalf.
