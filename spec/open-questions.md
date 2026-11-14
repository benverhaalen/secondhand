# Open questions

Status: a list kept by Nate's session, *agent proposal* throughout. Written 2026-11-14. Each item is something an agent introduced or found that only Ben or Nate can settle. Nothing here is decided. When one is answered, record the words in [product/words.md](../product/words.md), the decision in [product/decisions.md](../product/decisions.md), and remove the row.

## For Nate

| # | Question | Agent's recommendation | What depends on it |
|---|---|---|---|
| N1 | Is the Free Edition workspace the one the hackathon entry is built on, or does the track provide a full workspace? | Find out first. Free Edition limits outbound internet to trusted domains, has no GPU serving, 3 apps that stop after 24 hours and 1 Lakebase project ([open-facts-databricks.md](../research/data/nate/open-facts-databricks.md)) | Where market data is collected, which models read images, the whole build order |
| N2 | Has the track published judging criteria? | Share them if so | What the demonstration leads with |
| N3 | May the Databricks explanation (`spec/databricks.md`, written but not committed) live in this public repo? | Yes; the build plans cite it | Whether Ben's sessions can read it |
| N4 | Install the official Databricks and MLflow skills into your harness for every session? The installer adds three local hooks; no network calls were found | Yes, for Claude Code only: `databricks aitools install --agents claude-code --scope global` | Whether future sessions have the skills without fetching them |
| N5 | The explanations written for people are in a new top-level folder, [docs/how-it-works/](../docs/how-it-works/README.md). Say if they belong elsewhere | Keep it | Where the documentation lives |
| N11 | The Expo app is at `app/` and is linked to the EAS project under your Expo account. Should the project be owned by an organisation that Ben can also build from? | Yes, before the first device build | Who can make builds |
| N12 | The app reaches Databricks through server routes inside the Expo project ([app/README.md](../app/README.md)). A deployed build needs a host for those routes and a service identity in the workspace | EAS Hosting for the routes; a service principal if the workspace allows one (to be checked with N1) | Anything running off your laptop |
| N6 | Give `buy`, `insights`, `market` and `score` their own pages under `features/` and rows in `product/features.md`? They have specs but no feature page | Yes | Packets and the layout check for those four |
| N7 | Sites without webhooks are detected mainly through the sale and message emails they send. May the product read a seller's mail for that? | Yes, with a narrow scope, and state it at connect time ([email-and-notification-detection.md](../research/sold/nate/email-and-notification-detection.md)) | How fast a sale or reply is seen on Poshmark, Mercari and Facebook |
| N8 | Which real marketplace accounts carry the risk of automation during the build (yours, Ben's, or fresh ones)? | Fresh accounts | Every live action by the harness |
| N9 | Taking the marketplaces' apps apart to learn their ranking | Do not: ranking runs on their servers, so it would not show the algorithm. Controlled experiments on users' own listings instead ([score.md](features/score.md)) | Nothing is blocked by this |
| N10 | The line on certainty: resolve identity, variant, size, measurements and visible condition and state them as confirmed; keep ranges for price and time to sell; say what was and was not checked for authenticity, function and hidden condition | Keep that line | Wording across every screen |

## For Ben

| # | Question | Agent's recommendation | What depends on it |
|---|---|---|---|
| B1 | Everything listed as waiting on Ben in [packet 40](../.agents/team/packets/team/40-unified-spec-from-nates-side.md) | See the packet | The buying side, disclosure, visitors, the market feature, goals, repo structure |
| B2 | The decision promises watch alerts "within the hour". The watch spec argues events and frequent checks support a much tighter promise | Tighten it once measured ([watch.md](features/watch.md)) | The words on the Watch screen |
| B3 | Studio's method: your ranked redraw with no blocking ([packet 30](../.agents/team/packets/studio/30-studio-build-plan.md)), or cut-out and paste-back with a block on any changed item pixel ([studio.md](features/studio.md))? If both, which runs at which touch-up level? | Yours where you decided it; keep the block for tag, label, serial and flaw photos | The studio card's actions |
| B6 | Are your touch-up levels and the per-site default level ([packet 31](../.agents/team/packets/list/31-platform-fit.md): 1 on eBay, Depop, Poshmark and Mercari; 0 on Facebook, OfferUp and Grailed) canon? | Yes | Studio and list defaults |
| B7 | With no AI tag on exported photos, does any surface still show that a photo was improved, and to whom (the seller only, or buyers too)? | The seller always sees it; buyers are yours to decide | Studio, list, the evidence check |
| B8 | Is 3D for clothes in, labelled as a model, or out? Your pipeline note and [capture.md](features/capture.md) differ | In, labelled as a model | Capture modes |
| B9 | The assistant asks through generated inputs: unclear words in a prompt are highlighted, and a tap opens the right control under the input ([Nate's words](../product/words.md#2026-11-14-nate-the-assistant-asks-through-inputs-not-questions)). The behaviour and contract are proposed in `spec/features/assist.md`; the components would be new entries in your catalog | Read the proposal and say which catalog entries you accept | The Ask sheet, search, capture |
| B4 | Capture: your "opens on the guided list, talk mode one tap away" and the joint "the item picks the mode" are read together as: always opens on the list; for rigid items the first step is the move-around scan | Confirm or correct ([capture.md](features/capture.md)) | The camera screen |
| B5 | Where the market feature lives: trends and a Following shelf inside Buy, or a Market section in You | Inside Buy ([market.md](features/market.md)) | The Buy tab's layout |

## For both

| # | Question | Agent's recommendation | What depends on it |
|---|---|---|---|
| J1 | The front door. Official app code confirms a Databricks App accepts only Databricks sign-in and has no per-user row isolation ([databricks-platform.md](../research/data/nate/databricks-platform.md)) | A thin public edge for sign-in, webhooks and visitor search, forwarding with a service identity; everything else on Databricks | Every request from the phone |
| J2 | The agent runtime: DBOS on Lakebase (exactly-once steps; an official guide and an Apps demo exist), Flue (open, runs at the edge, state in Lakebase, traces to MLflow), or Databricks' own Python agent server | DBOS for the durable jobs; decide after a one-hour trial of each on the workspace ([port-durable-agents.md](../research/data/nate/port-durable-agents.md), [flue-agent-harness.md](../research/cross-cutting/nate/flue-agent-harness.md)) | The harness and every background action |
| J3 | Should buyers be told an assistant is answering? | Natural voice in the seller's style, a short note on the first automatic message, always honest if asked | Every automatic reply |
| J4 | Offers to sellers on the buying side: ask every time, or automatic under a ceiling (Nate picked "negotiate for me"; eBay and Depop bar buying agents) | Ask every time until both decide | The buy spec and the account risk |
| J5 | The harness decision says outward actions happen "after the user's tap"; the later joint decision makes in-limit replies, counters, accepts and pickup booking automatic | The later decision governs; confirm it covers actions taken through the cloud browser | What runs without a tap on each site |
| J6 | How it earns: referral links and anonymous market data (Nate); Ben has not answered | Design neutral; a referral never changes the order of results | Ranking in search, the data product |
| J7 | Experiments on people's own listings (one thing varied, measured) | Opt in, per test | The scoring engine's learning |
| J8 | What the product claims as new on Databricks | Only what was verified: a citation that lets a number be recomputed; an evidence check built on the gateway's policy hook; rights that travel with data. Not an ontology: Databricks shipped Genie Ontology on 2026-11-11 ([port-ontology-and-aggregation.md](../research/data/nate/port-ontology-and-aggregation.md)) | The presentation |
| J10 | One target payout turned into a list price per site: Ben's multipliers ([packet 31](../.agents/team/packets/list/31-platform-fit.md): Depop and Poshmark target / 0.85, Mercari x 1.18, eBay x 1.10) or the fee formula in [money.md](determinations/money.md)? | The fee formula is the calculation; the multipliers are shown as what it produces at typical prices | Every list price |
| J9 | Repo structure: specs in `spec/features/` while AGENTS.md points at `features/<slug>/`; no status for planned or reviewed in `product/features.md`; the task board is one shared file | Add one line to AGENTS.md pointing at `spec/`; add the two statuses; keep the single board | How agents on both sides find and claim work |

## Corrections the session made to its own earlier statements

- "Photo count matters far more than photo quality for whether something sells": the strong figure was for resale profit, not chance of sale ([open-facts-money-and-markets.md](../research/price/nate/open-facts-money-and-markets.md)).
- "Databricks has nothing that generates and reconciles an ontology": it shipped one on 2026-11-11.
- "A past table version can be re-read for about 30 days": 7 days by default, so a citation keeps the ids of the observations it used.
- The claim that reverse engineering showed TikTok scoring attractiveness and reading emotion: no source opened supports it ([quality-and-value-classifiers.md](../research/price/nate/quality-and-value-classifiers.md)).
