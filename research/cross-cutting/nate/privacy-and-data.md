# What privacy, security and store-policy facts constrain an iOS app that captures photos and 3D scans inside people's homes, holds links to their marketplace accounts, reads buyer messages, stores home and meetup addresses and pickup hours, and has AI agents act for them, as of November 2026?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: cross-cutting.

Labels: *observed* = I opened the source and it says so (bytes via curl, or a fetched page). *asserted* = a source claims it, or it is from memory, or a search snippet. *inferred* = my reasoning. Anything I did not open is marked "unopened". No recommendations here; these are facts and their consequences.

## 0. How this relates to the existing notes

- Confirms `spec/README.md:44` ("Never log tokens, addresses, payment details or message text, only their ids"). *inferred*: the same rule is what keeps log files out of the "collected data" and "personal information" categories in sections 3, 4 and 6. It does not cover the places where text must exist (Lakebase, model prompts, vendor logs); see section 11.
- Confirms and extends `research/messages/ben/messages-and-offers.md:96` and `:99-135` (the `send_to_buyer` guard with `address_like`, `fuzzy_contains(vault.home_tokens)`, 15-minute HMAC approval tokens). Extends: the guard covers text the app sends. It does not cover what the model provider receives as input (section 7), what photos carry (section 1), or the buyer's own data (section 6).
- Confirms `research/messages/ben/messages-and-offers.md:189` (Lakebase holds ids and labels only, `buyer_ref_hash`). Extends: a hashed buyer reference is still personal information under eBay's definition if it can be tied back to a user (section 6, *inferred*).
- Contradicts, in part, `research/messages/ben/messages-and-offers.md:24-27` (browser agents run on the user's own session for sites other than eBay). Apple 5.1.1(v) text, as written, bars storing tokens for social networks off device, and several marketplace terms bar bots (sections 3 and 5). Whether the marketplaces count as "social networks" is not defined by Apple (*not-found*). On-device-only sessions are the pattern that sits inside the literal text.
- Extends `product/decisions.md:62-71` (pickups: windows, saved public meetup spot, home address only on a separate "Never alone" tap, calendar event, "Ask me every time"). The home address, meetup spot and pickup hours are location-like personal data; the calendar write needs an iOS permission and a purpose string (section 2).
- Extends `research/cross-cutting/ben/psychology.md:258` (in-app capture with metadata, marking AI edits). That line has no privacy-law content; sections 1 and 5 add the metadata risk and the AI-labelling law.

## 1. What photo and scan files carry

- Photos from iOS cameras carry EXIF; GPS is present when Camera has location permission. *asserted* (Apple and EXIF specs, from memory). The Share sheet has an "Options" toggle for Location, which is on by default per Apple support. *asserted*, unopened.
- Portrait and LiDAR captures can store depth and matte as auxiliary data inside HEIC (`kCGImageAuxiliaryDataTypeDepth`, `...PortraitEffectsMatte`). *asserted* from Apple ImageIO docs, from memory, unopened. *inferred*: a depth map of a room corner, plus a background, reveals furniture, windows and layout even when the item is the subject.
- ARKit scene meshes and RoomPlan `CapturedRoom` exports (USDZ/JSON) hold room geometry, wall and door and window positions, and object categories. *asserted*, from memory, unopened. *inferred*: a RoomPlan export is a floor plan of someone's home.
- How marketplaces treat metadata on upload: *not-found* in official docs for eBay, Facebook, Depop, Poshmark and Mercari. Commonly repeated: big sites re-encode and strip EXIF on display. *asserted*, no primary source found. *inferred*: because it is undocumented, the app cannot rely on the marketplace to strip GPS, so stripping before upload is the only step under the app's control.
- Background pixels (house numbers, mail, screens, faces, reflections) are not metadata and no marketplace strips them. *inferred*.

## 2. Apple App Store rules

Source: App Store Review Guidelines, Last Updated Oct 16, 2026, https://developer.apple.com/app-store/review/guidelines/ (*observed* by curl, 2026-11-14).

- 5.1.1(v), account deletion: apps that support account creation must let the user start deleting the account inside the app. *observed* (guidelines; the Apple account-deletion page https://developer.apple.com/support/offering-account-deletion-in-your-app/ was also read, *observed*). *inferred*: if the app has its own account, deletion must also remove marketplace link tokens and stored message-derived data, and the app cannot just point to a website.
- 5.1.1(v), credentials: "An app may not store credentials or tokens to social networks off of the device and may only use such credentials or tokens to directly connect to the social network from the app itself while the app is in use." *observed* (same page). Whether eBay, Depop, Poshmark and Mercari are "social networks" under this clause is not stated by Apple. *not-found*. Facebook clearly is one. *inferred*.
- 5.1.2(i): "You must clearly disclose where personal data will be shared with third parties, including with third-party AI, and obtain explicit permission before doing so." *observed* (same page). *inferred*: sending a buyer message or a room photo to a model provider falls under this, and the permission is the seller's, not the buyer's.
- App Privacy details ("nutrition labels"): an app declares data collected, linked to identity, used for tracking. "Collect" means data transmitted off device and kept longer than needed to serve the request. *asserted* (Apple App Privacy docs, from memory; the page https://developer.apple.com/app-store/app-privacy-details/ was read in the earlier pass but not captured to bytes in this run, so treat as *asserted*). Categories likely implicated: Photos or Videos, Precise Location (home and meetup address), Contact Info (address), User Content (messages), Identifiers, Other User Content.
- Privacy manifest (`PrivacyInfo.xcprivacy`), required-reason APIs, and third-party SDK manifests: *asserted* from memory; Apple's page returned empty to the fetcher. *not-found* as bytes.
- Permission strings: camera, photo library, location (when in use), calendars (full or write-only), notifications each need a purpose string in Info.plist. *asserted*, from memory.
- LiDAR and RoomPlan need no special permission beyond Camera. *asserted*, from memory, unopened.
- Automation: no Apple rule found that bars AI agents acting for a user. 5.1.2(i) (AI disclosure) and 4.7 (mini apps and plug-ins) are the nearest. *not-found* for a direct rule.

## 3. Apple and Google rules for apps that log into other services

- Apple: the 5.1.1(v) sentence above is the only direct rule found. *observed*.
- Google Play: User Data policy, and the "Deceptive Behavior" and "Device and Network Abuse" sections. Not opened this run. *not-found*. Google Play requires a Data safety form and account deletion in app and on web (*asserted*, from memory, unopened).
- Marketplace terms on bots and scraping: eBay API licence (section 6) permits only API access under its terms. Facebook Marketplace, Depop, Poshmark and Mercari ToS were not opened. *not-found*. *inferred*: automating a logged-in session on those sites is a ToS question the app owner carries, separate from Apple's rule.

## 4. US privacy law for a small consumer app

- CCPA/CPRA thresholds: annual gross revenue above $26,625,000 (the adjusted figure), or buying, selling or sharing personal information of 100,000 or more consumers or households, or 50% or more of annual revenue from selling or sharing personal information. *observed* via the California Privacy Protection Agency FAQ / AG page, fetched in the earlier pass (figures only; page date not recorded, treat as 2025-2026). *inferred*: a small app is below all three until it grows, but nothing stops it from being covered by processor contracts with larger partners.
- State comprehensive laws in force by 2026 include Indiana, Kentucky and Rhode Island from Jan 1, 2026, on top of earlier states. *asserted* (search snippets, several law-firm trackers), unopened as primary. Most use thresholds based on 100,000 consumers (lower in some states, and some have no revenue test). *asserted*.
- Washington My Health My Data Act and similar: not relevant unless the app handles health data. *inferred*.
- FTC: positions on undisclosed AI chatbots and impersonation, and Operation AI Comply (Sept 2024). *asserted*, from memory; I did not open a 2026 FTC page. *not-found* as 2026 primary.
- California Bot Disclosure Law, Business and Professions Code 17940-17943 (SB 1001, 2019): bars using a bot to communicate with a person online to incentivise a sale or vote, without disclosing that it is a bot. *asserted* (secondary sources and memory; statute text on leginfo, Justia and others did not load as bytes). *inferred*: an AI agent that answers buyers about a sale falls inside the plain reading of "incentivise a purchase or sale of goods". Whether a sole seller's agent counts as "bot used by a person" is not settled in anything I opened.
- 2025-2026 chatbot disclosure laws: an Orrick table of state chatbot laws, including California SB 243 (companion chatbots), was fetched in the earlier pass (*observed* as WebFetch summary, not bytes). Most target companion chatbots and minors, not seller assistants. *inferred*: few of these reach a marketplace answering bot, but the 17940 rule does the work in California.
- Colorado AI Act (SB 24-205): *asserted*, delayed to June 30, 2026 by a 2025 special session; I did not verify its November 2026 status. *not-found* as bytes.

## 5. Disclosure to buyers that an AI is replying

- Law: see 17940-17943 above. *asserted*.
- Marketplace policy on automated messaging: not opened for any marketplace except eBay's API terms (section 6). *not-found*.
- Existing notes: `research/messages/ben/messages-and-offers.md` covers an "AI wrote this" mark only as design. *inferred*: law (California) and trust both point the same way; the note does not rule on it.

## 6. The other-party problem: buyers who never agreed

Source: eBay API License Agreement, footer "Sept 3, 2025", https://developer.ebay.com/develop/apis/api-license-agreement (*observed* by curl with a browser user-agent, 2026-11-14; the `/join/` URL returned 403 to the fetcher).

- Definition: "Personal Information" means "any information that directly or indirectly identifies an eBay User that you obtain or send to eBay through your participation in the Program and your use of the Developer Tools ... including information ... that is included in eBay Content". *observed*. A buyer's name, ship-to address and message text qualify. *inferred*.
- Deletion: you must "promptly delete Personal Information" on the earliest of your own retention policy, a request from eBay or the user, or when no longer needed for the purpose collected. *observed*.
- "Other Users": information about eBay users who are not Your Users may be used "only as strictly necessary to perform activities permitted under these Terms and strictly in compliance with your posted privacy policy, eBay's Privacy Notice and applicable" law. *observed*. *inferred*: a buyer is an Other User of the seller's app; a posted privacy policy is therefore a licence condition, not only a store requirement.
- Credentials: "You will not under any circumstances collect, store or share any eBay User' User IDs or passwords." *observed*. *inferred*: eBay access has to go through OAuth tokens; no login-scripting on eBay with a stored password.
- Training: you may not "Use eBay Content, including without limitation any Personal Information, to train algorithms, conduct machine learning, ... train large learning models, and/or train artificial intelligence systems." *observed*. *inferred*: tuning or hill-climbing on logged buyer messages from eBay is inside this ban; using them only as prompt input is a different question the text does not answer (*not-found*).
- Restricted APIs: you may not "Ingest or otherwise incorporate information from Restricted APIs, including AI Outputs, into any artificial intelligence model, system, or tool ... not provided by or licensed from eBay without eBay's prior written consent." *observed*. *inferred*: if messaging or order APIs are Restricted APIs for this app, feeding them to a third-party model needs eBay's written consent. Which APIs are Restricted for a given developer is *not-found* in the page text I extracted.
- Service providers: acts of service providers that breach the licence "will be deemed a breach by you". *observed* (Section 4.2 text). *inferred*: a model vendor and Databricks are service providers.
- Marketplace Account Deletion notifications: eBay requires subscribing to deletion notices (or opting out) and deleting that user's data. *observed* (eBay developer guide on marketplace account deletion, read in the earlier pass; URL not recorded in this run's bytes). *inferred*: the app must be able to find and delete one eBay user's rows, including hashed buyer refs.
- Other marketplaces' API terms on buyer data (Etsy and others): *not-found*; Facebook Marketplace, Depop, Poshmark and Mercari have no public seller API I found. *asserted*.

## 7. Sending personal data to model providers

- Apple 5.1.2(i) (section 2) is the store rule. *observed*.
- eBay licence limits above apply to eBay-sourced data. *observed*.
- Provider terms (Anthropic, OpenAI, Google, Databricks Foundation Model APIs): API inputs are not used for training by default, with retention windows (often 30 days) and zero-retention options. *asserted*, from memory; I did not open a 2026 page for any provider. *not-found* as bytes.
- GDPR: a US seller using a US processor to answer an EU buyer needs a transfer basis (EU-US Data Privacy Framework or SCCs). *asserted*, from memory, unopened. eBay's own licence carries SCCs naming eBay GmbH and eBay (UK) Limited as data exporters (*observed*, Annex III in the licence text), which shows eBay treats the developer as an importer of EU personal data.

## 8. GDPR basics if EU buyers message a US seller

- Art. 3(2): applies to a non-EU controller that offers goods to people in the EU or monitors them. *asserted*, from memory, unopened.
- A seller acting in a personal capacity might fall under the household exemption (Art. 2(2)(c)); the app vendor does not. *asserted*.
- Rights: access, erasure, objection; Art. 22 limits solely automated decisions with legal or similarly significant effect. *asserted*. *inferred*: an agent that accepts or declines an offer is unlikely to meet "significant effect", but nothing I opened says so.
- Not opened: EDPB guidance, any 2026 enforcement. *not-found*.

## 9. Session tokens and cookies: Keychain versus server vault

- Apple rule: tokens for social networks stay on device (5.1.1(v), *observed*).
- eBay: OAuth tokens only (section 6, *observed*).
- iOS Keychain with `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` keeps items out of backups and other devices; background tasks cannot read them while the phone is locked. *asserted*, from memory. *inferred*: an agent that must act while the phone sleeps cannot read a token stored this way; this is the tension with server-run agents.
- What known crosslisters do (Vendoo, List Perfectly, Crosslist, Flyp): the commonly reported pattern is a browser extension or in-app browser that uses the user's logged-in session, with some storing credentials or cookies on their servers. *asserted*, from marketing and help pages seen in search results, unopened. *not-found* as primary documentation of their storage.
- Facebook sessions: Meta states in its terms that automated data collection needs permission. *asserted*, unopened.

## 10. Incidents where an assistant leaked or acted wrongly

- Muse template leak, Proton, 30 Sep 2026: already in `research/messages/ben/messages-and-offers.md:17`. *observed* there; I did not re-open the source.
- Other dated incidents (an agent leaking a seller address, or an AI reply wrongly committing a seller): searched, *not-found* with dates and sources I could open. Known adjacent cases from memory: Air Canada chatbot ruling (Moffatt v. Air Canada, BC Civil Resolution Tribunal, Feb 2024) held a company liable for its chatbot's statement. *asserted*, unopened this run. *inferred*: the same reasoning would put a seller on the hook for an agent's promise to a buyer.

## 11. Retention and deletion

- App Store: in-app deletion start for any app with account creation. *observed* (section 2).
- eBay: delete on request, on eBay's request, on purpose end, and on account-deletion notices. *observed* (section 6).
- CCPA: right to delete and to know, 45 days to respond (extendable). *asserted*, from memory.
- GDPR: erasure without undue delay, about one month. *asserted*.
- Local logs: `spec/README.md:44` keeps text out of logs. Deletion must also reach: model-provider logs, MLflow traces (`trace` field at `spec/README.md:37,43`), Lakebase rows, and image files in object storage. *inferred*. Whether an MLflow trace stores prompt text by default: *not-found* in what I opened. *inferred*: if traces capture prompts, they hold message text despite the logging rule.

## 12. Data classification (*inferred*)

| Data | Sensitivity | May live | Who may read | Keep |
|---|---|---|---|---|
| Marketplace OAuth tokens and session cookies | Highest | On device Keychain; server vault only for eBay OAuth (allowed by Apple text for non-social sites, uncertain) | The connector code only; never agents' prompts or logs | Until the user unlinks, or eBay revokes; delete on unlink |
| Marketplace passwords | Do not hold | Nowhere | Nobody | Never stored (eBay clause, *observed*) |
| Home address | High | Device and vault; never in prompts except through the guard's token list | Only the user; the guard reads it to block leaks | Until user deletes |
| Public meetup spot | Medium | Account store | Agents may use it | Until user deletes |
| Pickup hours and calendar events | Medium | Account store, user's calendar | Agent proposes, user confirms (`product/decisions.md:62-71`) | Until the item closes plus a short tail |
| Room photos and depth/scan files (raw) | High | Device; uploaded only for the model step the user starts | Models via a disclosed call; staff no | Delete after cutouts are produced, unless the user keeps them |
| Cutouts and listing photos with EXIF stripped | Medium | Device and storage | Public once listed | While listed, then user choice |
| Raw EXIF/GPS | High | Device only | Nobody server-side | Dropped at export |
| RoomPlan / mesh exports | High | Device only | User only | User choice |
| Buyer name, ship-to address | High (personal information under eBay licence) | Marketplace, shown not copied; if stored, a short-lived cache | Seller, and agent only on the minimum fields | Delete on eBay deletion notice and when the order closes |
| Buyer message text | High | In transit to the model; not in logs (`spec/README.md:44`) | Seller, the model provider under disclosure | Short; delete with the thread |
| Buyer reference hash | Medium | Lakebase (`messages-and-offers.md:189`) | Backend | Delete on buyer deletion notice |
| Prices, floors, item facts | Low | Anywhere | Agents | Item life plus audit period |
| Model traces and call logs | Medium (may carry text) | MLflow | Engineers | Short fixed window, and checked for text |
| Approval tokens (HMAC) | Medium | Memory | Guard only | 15 minutes (`messages-and-offers.md` guard) |

## 13. Disclosures an honest app would show (*inferred*)

To the seller:
- Which marketplaces are linked and what each link lets the app do; how to unlink and what is deleted then.
- That photos, scans and buyer messages are sent to a named AI provider, with explicit consent (Apple 5.1.2(i), *observed*).
- That the app strips location from photos before upload, and what it cannot strip (backgrounds).
- That room geometry and depth data are captured and where they are stored.
- Which actions the agents take alone, which they ask about, and which they never do (matches `product/decisions.md:62-71`).
- What is logged, and that message text and addresses are not.
- How to delete the account and all data from inside the app.
- That a marketplace may treat automation as a terms violation.

To buyers:
- That an AI wrote or sent the reply (California 17940, *asserted*).
- That the message is processed by an AI provider on behalf of the seller.
- A way to ask for deletion of their data (eBay licence and GDPR).

In the store listing:
- Privacy label entries for photos, location, contact info, user content, identifiers; a privacy policy URL posted (eBay "other user" clause, *observed*).

## Not found

- Official marketplace documentation on EXIF/GPS stripping at upload (eBay, Facebook, Depop, Poshmark, Mercari).
- Apple privacy manifest page as bytes; Apple App Privacy details page as bytes in this run.
- California B&P 17940-17943 statute text as bytes.
- A 2026 FTC primary page on AI agents or undisclosed bots.
- Colorado AI Act status in November 2026.
- Google Play policy text on third-party logins and automation.
- Facebook, Depop, Poshmark, Mercari terms on bots and automation.
- Model-provider (Anthropic, OpenAI, Google, Databricks) data retention terms as 2026 bytes.
- Crosslister primary documentation of token storage.
- Dated incidents of an agent leaking a seller's address, beyond the Muse case already in the repo.
- Whether eBay's messaging or order APIs count as "Restricted APIs" for this app.
- Whether Apple treats non-social marketplaces as "social networks" in 5.1.1(v).

## Sources fetched

- Apple App Store Review Guidelines, Last Updated Oct 16, 2026: https://developer.apple.com/app-store/review/guidelines/ (*observed*, curl, 2026-11-14).
- Apple, offering account deletion in your app: https://developer.apple.com/support/offering-account-deletion-in-your-app/ (*observed*, earlier pass).
- Apple, App Privacy details: https://developer.apple.com/app-store/app-privacy-details/ (read in the earlier pass, summary only).
- eBay API License Agreement, footer Sept 3, 2025: https://developer.ebay.com/develop/apis/api-license-agreement (*observed*, curl).
- eBay Marketplace Account Deletion guide (eBay developer docs, read in earlier pass, URL not recorded).
- California Privacy Protection Agency / AG CCPA FAQ (threshold figures, earlier pass, WebFetch summary).
- Orrick, 2026 state chatbot law table (earlier pass, WebFetch summary).
- Repo files: `spec/README.md`, `research/messages/ben/messages-and-offers.md`, `product/decisions.md`, `research/cross-cutting/ben/psychology.md`.

## Searched / could not reach

- eBay `/join/api-license-agreement` returned 403 to WebFetch; the `/develop/` URL worked by curl.
- Apple privacy manifest documentation page returned empty.
- Leginfo, Justia, Legiscan and one law-firm page gave no usable text for California B&P 17941; one URL returned 404. A Wayback Machine fetch was refused by the permission layer and was not retried.
- Not attempted for lack of time in this run: Google Play policy pages, Meta, Depop, Poshmark and Mercari terms, FTC 2026 pages, GDPR primary text, model-provider policy pages, crosslister help pages, and a systematic incident search.
- A narrow search does not prove any of these do not exist.
