# Determinations: fields by kind
Status: *agent proposal* for Ben and Nate. Written 2026-11-14.

This file answers Nate's ask ([words](../../product/words.md#2026-11-14-nate-a-framework-of-fields-for-every-kind-of-product-filled-by-the-engines)): every product people buy and sell gets the fields it needs, and the engines find and fill the rest. It is read with his entry on capture ([words](../../product/words.md#2026-11-14-nate-front-back-and-tag-for-clothes-lidar-for-objects-the-least-extra-input)): a few photos, the least extra input, and we control how each listing is described.

Everything below is *agent proposal*. Every weight and threshold is a starting value, refit by the checks named on each card. Claims are marked *observed*, *asserted* or *inferred*.

Cards this file links rather than repeats: item kind ([seeing 1](seeing-the-item.md#1-item-kind)), what must still be captured ([seeing 3](seeing-the-item.md#3-what-must-still-be-captured-and-when-it-is-enough)), which product it is ([seeing 9](seeing-the-item.md#9-which-product-it-is-and-when-identity-is-confirmed)), the next question ([seeing 17](seeing-the-item.md#17-which-question-to-ask-next-and-when-to-stop)), stated as confirmed ([seeing 18](seeing-the-item.md#18-whether-a-fact-may-be-stated-as-confirmed)), whether an answer changes anything ([asking 3](asking-and-intent.md#3-whether-resolving-a-span-would-change-anything)), attributes and category per site ([listing D6](listing-and-marketing.md#d6-attributes-per-site), [D7](listing-and-marketing.md#d7-category-placement)), claim check ([listing D25](listing-and-marketing.md#d25-claim-check)) and the price adjustments ([money D2](money.md#d2-condition-variant-completeness-and-size-adjustment)).

## 1. The taxonomy spine

**Spine: Shopify's Standard Product Taxonomy** (*agent proposal*). Facts *observed* at [github.com/Shopify/product-taxonomy](https://github.com/Shopify/product-taxonomy) on 2026-11-14:
- MIT licence; release v2026-11, published 2026-11-13; monthly versions.
- 26 verticals, 12,333 attributes and 127,383 values; about 12,000 to 64,000 categories depending on how leaf and parent categories are counted, read from the release at build time ([claims validated](../../research/cross-cutting/nate/claims-validated-determinations.md)). Ids look like `gid://shopify/TaxonomyCategory/aa-1-13-8` (Apparel & Accessories > Clothing > Clothing Tops > T-Shirts).
- A mapping to the Google product taxonomy (2021-09-21) ships with it.
- Distribution is release assets (`categories.en.json.gz`, `integrations.all_mappings.en.json.gz`). The committed `dist/` folder is deprecated.

Why this spine: it is open, versioned, broad (vehicles, media, collectibles, tools, baby gear all present), carries attributes and values rather than only names, and maps to Google. The same ids appear on Shopify Catalog offers, which [market's one catalog](../features/market.md#one-catalog) already reads. The alternatives fall short:
- **Google's taxonomy** is frozen at 2021-09-21 with 5,595 categories and has no attributes (*observed*).
- **eBay's tree** differs per marketplace and its aspects are per category through an API (*observed*, [listing fields §1](../../research/list/nate/listing-fields-by-platform.md)).
- **GS1 GPC** is built for retail supply chains, with no resale fields (*asserted*).

**What Shopify lacks.** Its attributes describe the new product, not the used unit (*observed*). T-Shirts list 24 attributes ([claims validated](../../research/cross-cutting/nate/claims-validated-determinations.md)), among them fabric, fit, neckline, size and sleeve length. None of them is brand, artist, era, a measurement or condition. Condition does exist as separate attributes (`Condition` 2360, `Item condition` 2680, `Cosmetic condition` 1857, `Part condition` 8587), but no T-Shirt carries them (*observed*). The unit-level fields therefore come from our own registry (section 2).

### Other taxonomies mapped onto it

| Taxonomy | How it maps to the spine | Source |
|---|---|---|
| Google product taxonomy | Shopify's own mapping file, read as is | *observed*, Shopify `data/integrations/google` |
| Facebook Marketplace and Shops | through Google, since the catalog feed accepts a Google category | *asserted* |
| eBay leaf categories, per marketplace | our `category_map` row per (kind, marketplace): seeded by eBay Taxonomy `getCategorySuggestions` on the kind's name, then checked by a person; aspects come per eBay category from `getItemAspectsForCategory` | suggestions *asserted*; aspects *observed* ([listing fields §1](../../research/list/nate/listing-fields-by-platform.md)) |
| Depop department and product type | static `category_map` rows, one per kind | *observed* fields, mapping *inferred* |
| Poshmark department, category, subcategory | static rows | *observed* fields, mapping *inferred* |
| Mercari three levels | static rows | *asserted* |
| schema.org Product (pasted links, retail pages) | `gtin`, `mpn`, `brand`, `model` and `itemCondition` read straight into fields | *asserted* |

A site whose category is not in `category_map` falls back to [listing D7](listing-and-marketing.md#d7-category-placement), which places it from that site's own search.

### Families, kinds and inheritance

A **kind** is one Shopify category, or a subtree of one, that needs its own fields. A **family** groups kinds that share a condition scale and a capture recipe. Fields are inherited along `root > family > kind`, so a kind's row lists only what it adds or overrides. A new kind usually costs three to six lines. The 13 families are the 13 kinds of [identity-schema-by-kind](../../research/item-card/nate/identity-schema-by-kind.md) that [seeing 1](seeing-the-item.md#1-item-kind) classifies, so that card keeps working unchanged.

| Family | Shopify subtrees (*observed* ids) | Example kinds | Condition scale (from identity-schema) |
|---|---|---|---|
| `apparel` | `aa-1` Clothing | T-shirts `aa-1-13-8`, jackets, jeans, dresses | eBay NWT to Pre-owned Fair, plus flaws |
| `shoes` | `aa-8` Shoes | athletic `aa-8-1`, sneakers `aa-8-8`, boots | box state plus wear |
| `bags` | `aa-5`, `lb` | handbags `aa-5-4`, luggage | Fashionphile's seven grades |
| `jewellery_watches` | `aa-6` | watches `aa-6-11`, rings | condition plus polish state |
| `furniture` | `fr` | sofas `fr-22`, chairs, tables | named defects |
| `lighting_home` | `hg` | lamps `hg-13-5`, decor, kitchenware | named defects |
| `electronics` | `el`, `co` | phones `el-4-8-5`, cameras `co-2-2`, consoles | Swappa or KEH grades, battery health |
| `appliances_tools` | `ha`, `hg` appliances | drills `ha-15-14-3`, mixers | function as the person's yes or no |
| `media` | `me` | vinyl `me-3-6`, print books `me-1-3` | Goldmine, item and sleeve apart |
| `cards_collectibles` | `ae-2-2` Collectibles | trading cards `ae-2-2-3`, coins, comics | TCGplayer or a grade and cert |
| `toys_lego` | `tg` | LEGO sets, video games | sealed, complete, incomplete; loose, CIB |
| `bikes_sports` | `sg` | bicycles `sg-4-4-3`, golf clubs | function plus wear |
| `baby_gear` | `bt` | strollers `bt-6-3`, car seats | defects plus recall and expiry |

Any Shopify leaf resolves to the nearest ancestor that has a row. So all 14,606 categories have a field set from the day the spine is loaded, and the coverage gaps are fields, not missing categories (section 6).

## 2. The field registry is the requirement row

Field importance and the capture `requirement` rows are one registry. The `requirement` row in [product §3](../product.md) already carries item_kind, field, type, values_or_unit, role, site_names, importance, fill_ladder, views_needed, seconds, effort, priority and a version; this section says what each column means. Capture reads `views_needed` from it, identify reads `fill_ladder`, list reads `site_names`, and the `requirement_fold` challenger in `param_fold` ([product §6](../product.md#real-time-weights-agent-proposal)) learns `importance` on it. A field still missing is asked through one `clarify(slot, candidates[], value_of_information)` ([product §5](../product.md#decision-kinds-the-complete-list)).

| Column | Values | Meaning |
|---|---|---|
| `node` | a family, kind or `root` id, plus the Shopify gid | where the row sits in the inheritance |
| `field` | snake_case name, from Shopify's attribute handle where one exists | |
| `type` | `text`, `enum`, `number`, `bool`, `date`, `list` | |
| `values_or_unit` | an enum list (Shopify values where they exist) or a unit (`cm`, `in`, `g`, `GB`, `V`, `Ah`, `%`) | |
| `role` | `identifies` (the product), `unit` (this one item), `commercial` (the offer) | identifies-fields drive the match; unit-fields drive condition and price class; commercial-fields drive the offer |
| `site_names` | per site: the site's field name, max length, required or recommended | from [listing fields](../../research/list/nate/listing-fields-by-platform.md) and eBay's aspect call |
| `importance` | `{match, value, rank: {site}}`, each `high`, `medium` or `low` | learned (card F2); `priority` becomes the maximum of the three, so seeing 3 reads it unchanged |
| `fill_ladder` | ordered rungs, each with its route | card F3; replaces `obtained_by` (the old values become rung names) |
| `views_needed` | as today | for the capture rung |
| `version` | as today | a person approves each new version |

### Root fields (every item)

| Field | Type | Role | Usual rung | Notes |
|---|---|---|---|---|
| `kind` | Shopify gid | identifies | capture, then lookup | [seeing 1](seeing-the-item.md#1-item-kind) |
| `brand` | text | identifies | label, lookup | Depop requires it (*observed*) |
| `model` | text | identifies | label, lookup | |
| `gtin`, `mpn` | text | identifies | label | a code beats every other rung |
| `colour` | enum, up to 2 | identifies | seen | Depop and Poshmark take up to 2 (*observed*) |
| `material` | enum list | unit | label, seen | |
| `condition` | the family's axes | unit | seen, then said | mapped per site, never stored per site |
| `flaw.<n>` | typed, sized, with a photo | unit | seen | |
| `completeness` | list of the kind's parts | unit | seen, then said | sets the price class (identity-schema, *observed*) |
| `measurements` | numbers with a unit | unit | measured | kept apart from the size label |
| `era` | decade or year | unit | label, inferred | absent from Shopify |
| `function` | `works`, `partly`, `not_working`, `not_checked` | unit | said only | never decided from photos ([identify](../features/identify.md#when-it-asks-and-when-it-must-not)) |
| `recall_flag` | bool with a source | unit | lookup | blocks a sale ([seeing 20](seeing-the-item.md#20-recall-or-safety-flag)) |
| `quantity`, `cost`, `location` | number, money, place | commercial | said, profile | never required |
| `package` | weight and box size | commercial | measured, then spec | Mercari asks weight first (*asserted*) |
| `retail_price` | money | commercial | lookup | Poshmark requires the original price (*observed*) |

### Family and kind fields (what each adds)

| Node | Adds | Fill note |
|---|---|---|
| `apparel` | `size_label`, `size_system`, `fit`, `sleeve_length`, `neckline`, `fabric`, `rn_ca`, `style_code`, `origin`, `hangtag` | the tag photo fills most of them; `rn_ca` gives the maker |
| T-shirt kind | `print_subject` (band, artist, team), `print_year`, `stitch` (single or double), `print_method` | resale fields Shopify lacks |
| `shoes` | `size` with `size_system` and `width`, `style_code`, `colourway`, `release_year`, `box` | the style code inside the tongue identifies the pair |
| `bags` | `serial_or_date_code` (never proof), `hardware_colour`, `dust_bag`, `authenticity_card` | |
| `jewellery_watches` | `reference`, `serial` (kept apart, never in a listing), `case_size_mm`, `movement`, `box_papers`, `polished` | |
| `furniture` | `width`, `depth`, `height`, `seat_height`, `seats`, `maker_mark`, `style`, `assembly`, `pickup_only` | LiDAR fills the sizes ([measure](../features/measure.md)) |
| `electronics` | `storage_gb`, `carrier_lock`, `imei_tac`, `battery_health_pct`, `screen_size`, `accessories` | Mercari sets battery thresholds (*observed*) |
| `appliances_tools` | `voltage`, `power_source`, `battery_count`, `battery_ah`, `charger`, `case`, `serial` | |
| `media` | `catalogue_no`, `matrix`, `isbn`, `edition`, `item_grade`, `sleeve_or_jacket_grade` | graded apart (Goldmine, *observed*) |
| `cards_collectibles` | `set`, `card_no`, `rarity`, `finish`, `language`, `year`, `grader`, `grade`, `cert_no` | eBay needs condition descriptors; cert number at most 30 characters (*observed*) |
| `toys_lego` | `set_no`, `pieces`, `minifigures`, `sealed`, `manual`, `platform` | |
| `bikes_sports` | `frame_size`, `wheel_size`, `groupset`, `serial`, `hand` | |
| `baby_gear` | `model`, `date_code`, `expiry`, `harness`, `all_hardware` | the date code drives the recall check |

Shopify's own attributes for a kind (the 24 for T-shirts) join the row set as `low` importance fields filled by lookup or vision. They earn a higher importance only through card F2.

## 3. The fill ladder

Every field is tried rung by rung, cheapest first. A rung runs only for fields the earlier rungs left empty or in conflict. Every value written carries `attribute.source`, `evidence[]` and `method`, and every value used in a listing passes `claim_check` ([listing D25](listing-and-marketing.md#d25-claim-check)).

| Rung | What it is | `source` and `evidence.kind` | Cost to the person | Cost to us (*inferred*, starting estimates) |
|---|---|---|---|---|
| 1. Read from the capture | label OCR, barcode, vision over the accepted frames, LiDAR, flaw pass | `label`, `measured`, `inferred`; `label_text`, `depth`, `image_region` | none beyond the photos | on-device free; one cloud vision pass, about 1 to 3 cents |
| 2. Looked up once identified | catalogue spec of the matched `product` ([market](../features/market.md#one-catalog)), eBay ePID or GTIN aspects, a specialist (Discogs, PriceCharting, card and watch services), routed per need through the [source router](../features/data.md#source-registry-and-router-agent-proposal) | `spec`, `marketplace`; `lookup` | none | one routed call per need, priced in `route_table` |
| 3. Inferred | the modal value across listings of the same product, or the product spec, when 5 or more agree (start) | `inferred`; `lookup` with the listing ids | none | reuses the comparables already fetched for price |
| 4. Carried from what the person said | words already typed or spoken in the assistant prompt, and the profile (location, shipping) | `you_said`; `owner` | none: it was said already | a parse of text we hold |
| 5. A generated input | one highlighted span or widget in the assistant ([assist](../features/assist.md)), only for a field still short of filled-enough | `you_said`; `owner` | one tap, about 2 to 4 seconds (*inferred*) | none |

The order is the order of **trying**, set by cost to the person and then cost to us. It is not the order of **belief**: a `you_said` value is never overwritten by a model, and a code beats a resemblance. Card F5 settles conflicts.

### Filled enough

| Importance on any target | Filled enough when | If it stays empty |
|---|---|---|
| `high` (identifies, changes value class, or a target site requires it) | confirmed under [seeing 18](seeing-the-item.md#18-whether-a-fact-may-be-stated-as-confirmed), or `you_said`, or an allowed unknown (`function: not_checked`) | the rung 5 input is offered; if still empty, it is `item.missing_fields[]` and the dot on that site's logo; that site does not post |
| `medium` | any rung 1 to 3 value with evidence that passes `claim_check`, stated as what the evidence shows ("measures 56 cm across", "no tag, likely 1990s") | omitted from the listing and from structured fields |
| `low` | any value with evidence | omitted. Never guessed, never filled with a placeholder such as "Unbranded" unless the evidence supports that value |

A site that requires a field the item cannot have (a size on a lamp) takes the site's own "does not apply" value. That value is recorded as `method: site_not_applicable` with no claim behind it.

## 4. The workflow, from the first photo to five listings

| When | Job (runs in parallel) | Tool or route | Writes |
|---|---|---|---|
| First frame | provisional kind; shot prompts | phone vision ([seeing 1](seeing-the-item.md#1-item-kind)); the family's `views_needed` | provisional `kind` |
| As soon as a code is read | label read, code lookup | Apple Vision OCR and barcode; GTIN, ISBN, style code, IMEI or TAC, set number ([identify routes](../features/identify.md#design-choices)) | `label` values; candidate `exact` |
| From the first words | carry | parse of the prompt and profile | `you_said` values |
| `POST /v1/captures/:id/finish` | kind vote; the five identify routes; measure; flaw pass; colour and material | `capture_judge`; [identify](../features/identify.md); [measure](../features/measure.md) | `kind`, candidates, `measured`, `flaw.<n>`, `condition` axes |
| Kind accepted | row set | root, family and kind rows, plus the mapped eBay category's aspects (cached per category) | the item's field list |
| Identity `exact` or `likely_same_model` | lookup rung | the matched `product.spec`; `retail_offer`; specialists; each through the router | `spec` and `marketplace` values |
| Comparables fetched for price | inference rung | the same comps valuate uses ([money D1](money.md#d1-comparable-set-and-weights)) | `inferred` values |
| Gaps remain on `high` fields | rung 5 | [seeing 17](seeing-the-item.md#17-which-question-to-ask-next-and-when-to-stop) picks the next input; at most 3 per item | `you_said` values |
| Card complete | five listings | [listing D4 to D7](listing-and-marketing.md#d4-title-per-site) map fields to each site; `claim_check` on every claim | `listing` drafts |

Conflict between sources is settled by card F5, which applies [seeing 9](seeing-the-item.md#9-which-product-it-is-and-when-identity-is-confirmed) and identify's evidence ladder to fields. Importance is learned weekly by the `requirement_fold` challenger in `param_fold` ([product §6](../product.md#real-time-weights-agent-proposal)) from how often each field changed the value, the match or the rank (card F2), and lands as a new `requirement` version a person approves.

## 5. Six worked examples

Values are illustrations. "Rung" is the rung that filled the field.

**Band T-shirt** (`aa-1-13-8`, family `apparel`). Photos: front, back, tag.

| Field | Value | Rung |
|---|---|---|
| brand | the blank's maker, from the tag | 1, label |
| print_subject, print_year | band name and "1994 tour" read from the print | 1, label; the tour confirmed by image search, 2 |
| size_label | L | 1, label |
| measurements | 56 cm pit to pit, 74 cm length | 1, measured |
| stitch, era | single stitch; 1990s | 1, seen; era 3, inferred from tag and stitch, stated as "likely" |
| fabric | 100% cotton | 1, label |
| condition, flaws | Pre-owned Good; print cracking | 1, flaw pass |

Asked: nothing. If the tag is cut out, one input offers the sizes the measurements fit, with none preselected.

**Running shoes** (`aa-8-1`, family `shoes`). Photos: pair, inside the tongue, sole.

| Field | Value | Rung |
|---|---|---|
| style_code | the code on the tongue label | 1, label |
| brand, model, colourway, release_year, retail_price | from the style code | 2, lookup |
| size, width | US 10, D | 1, label |
| condition | outsole wear on the heel | 1, flaw pass |
| insoles | present | 1, seen |
| box | not seen | 5 |

Asked: "Original box?" with a yes or no input, because the box changes the price class and eBay's condition value.

**Sofa** (`fr-22`, family `furniture`). Photos: a LiDAR walk-around, the label under the cushion.

| Field | Value | Rung |
|---|---|---|
| width, depth, height, seat_height | 213 x 91 x 84 cm, seat 46 cm | 1, measured |
| seats | 3 | 1, seen |
| material, colour | polyester (law label), grey | 1, label and seen |
| maker_mark, brand | none found | stays empty, `not_visible`; omitted |
| style | mid-century | 3, inferred from comps |
| flaws | a stain on the left arm | 1, flaw pass |
| location, pickup_only | from the profile | 4, carried |

Asked: nothing. Smoke and pet home stay `not_asked` and unstated.

**Phone** (`el-4-8-5`, family `electronics`). Photos: front, back, the About screen, the battery screen.

| Field | Value | Rung |
|---|---|---|
| model, storage_gb, imei_tac | from the About screen | 1, label |
| carrier_lock, recall_flag | from the IMEI or TAC | 2, lookup |
| colour | from the model and the back photo | 2, spec, matched by 1 |
| battery_health_pct | 87% | 1, label |
| condition | Good: a scratch on the screen | 1, flaw pass |
| function, signed out | works; erased | 5 |

Asked: one input with two checks, "Works" and "Erased and signed out", none preselected. Function is always the person's statement.

**Trading card** (`ae-2-2-3-2`, family `cards_collectibles`). Photos: front and back; a slab label if graded.

| Field | Value | Rung |
|---|---|---|
| name, set, card_no | from the card's text | 1, label |
| rarity, year, language, finish | from the set and number | 2, lookup (card specialist) |
| condition | Near Mint; centring measured from the borders | 1, seen and measured |
| grader, grade, cert_no | if slabbed, from the slab label, checked against the grader | 1, label; 2, lookup |
| retail and used price | for valuate | 2, lookup |

Asked: nothing.

**Power drill** (`ha-15-14-3`, family `appliances_tools`). Photos: the tool, the model plate, the batteries.

| Field | Value | Rung |
|---|---|---|
| brand, model, voltage, serial | from the plate | 1, label |
| chuck, brushless, retail_price | from the model | 2, lookup |
| battery_count, battery_ah | 2 batteries, 2 Ah | 1, label |
| charger, case | charger seen, no case | 1, seen |
| condition | light wear | 1, flaw pass |
| function | works | 5 |

Asked: "Works?", the only fact no photo settles.

## 6. Coverage

- **Counts.** 13 families and the root resolve all 14,606 Shopify categories. The registry above names 18 root fields and about 85 family and kind fields. Shopify's 8,240 attributes join as `low` fields per category (*observed* counts; field counts from the tables here).
- **Used goods covered poorly** (*inferred* from Shopify's attribute lists):
  - era and vintage dating;
  - handmade work and art (maker, signature, edition);
  - parts and repair (part numbers, what a part fits);
  - lots and mixed bundles (Shopify's `bu` vertical describes new bundles);
  - graded collectibles beyond cards (coins, comics);
  - non-US sizing and regional items;
  - vehicles past the category level (VIN details);
  - musical instruments (serial dating).
  
  Each gets its fields as kind rows in this registry, filled first by lookup routes that the router ranks.
- **An unknown kind on day one.** If the kind is not accepted, [seeing 1](seeing-the-item.md#1-item-kind) offers family chips; the item then takes root plus family fields. If the family has no kind row, the nearest Shopify ancestor's attributes and each target site's own required aspects are added: eBay through `getItemAspectsForCategory` for the category [D7](listing-and-marketing.md#d7-category-placement) picks, the other sites through their static rules. If even the family is unknown, root fields and the site's required aspects are enough to list.

## F1. Kind assignment mapped to the spine

**Determines**: the kind's Shopify gid, its family, and its `category_map` rows per site. The family vote itself is [seeing 1](seeing-the-item.md#1-item-kind).

**Sources and weights**

| source | contributes | weight | why |
|---|---|---|---|
| person's tap | the kind | overrides | owner statement |
| decoded code with a catalogue category (eBay Catalog, GS1, Shopify Catalog) | a category, mapped to a gid | 1.0 (start) | an identifier |
| matched `product.category` once identity is `exact` | a gid | 0.9 (start) | inherits the match's evidence |
| vision over the accepted frames, constrained to the accepted family's subtree | a probability per leaf | 0.6 (start) | sees the item; the subtree keeps it from roaming |

**Method**:
1. Accept the family by seeing 1.
2. Score leaves under the family's subtrees, `S = sum w * p / sum w`.
3. Take the deepest node with `S >= 0.60` (start).
4. If no leaf passes, take its parent: a parent is always a valid kind.
5. Read `category_map` for each target site.

**Why this method**: stopping at the deepest confident node never forces a wrong leaf, and every node inherits fields (*inferred*). The alternative is a flat classifier over 14,606 leaves. It is cheaper to run, but it guesses leaves it cannot tell apart.

**When it is not shown**: always shown as the kind name; the gid is internal.

**How it is explained**: "Running shoes", which opens the frames or the code that decided it, with "Change".

**Speed**: one model call on the frames already sent to `capture_judge`; the map lookup is cached in Lakebase.

**Check later**: on 300 labelled captures, the leaf is wrong for fewer than 1 in 30 items and too shallow for fewer than 1 in 5.

## F2. Field importance

**Determines**: `importance.match`, `importance.value` and `importance.rank[site]` on each `requirement` row.

**Sources and weights**

| source | contributes | weight | why |
|---|---|---|---|
| a site marks the field required | `rank[site] = high` | overrides | a missing field blocks the post |
| how often the field split the candidate set or changed the match label ([seeing 9](seeing-the-item.md#9-which-product-it-is-and-when-identity-is-confirmed)) | match effect | 1.0 (start) | measured on our items |
| the field's price adjustment from the comparable model ([money D2](money.md#d2-condition-variant-completeness-and-size-adjustment)), divided by the median price | value effect | 1.0 (start) | measured on sold listings |
| the field's attribution in the site's `ranker_model` ([score](../features/score.md)) | rank effect | 1.0 (start) | measured on observed ranks |
| eBay `aspectUsage` RECOMMENDED, Depop and Poshmark guidance | rank prior | 0.5 (start), fading as observations grow | *observed* guidance, not measured effect ([listing fields §7](../../research/list/nate/listing-fields-by-platform.md)) |
| identity-schema's per-kind list | starting importance | the prior for a new row | the research, until data exists |

**Method**:
1. Weekly, the `requirement_fold` challenger computes three effects per field and node.
2. Match: high if the field changed the label in 5% or more of items, medium at 1% (start).
3. Value: high at 10% of the median price or more, medium at 3% (start).
4. Rank: a site requirement, or high attribution, gives high.
5. Nodes with fewer than 30 items take their parent's values.
6. The result is a challenger `requirement` version; promotion has a person's approval as its guard.

**Why this method**: importance is what a field changed, which is the test [asking 3](asking-and-intent.md#3-whether-resolving-a-span-would-change-anything) applies to a single span, here applied to the row (*inferred*). The alternative is a hand list per kind. It is fast to write, but it goes stale as the sites change.

**When it is not shown**: always internal; it orders fields and questions.

**How it is explained**: on a field's "Why?": "Changes the price" or "eBay needs it".

**Speed**: a weekly batch; reads are a cached row.

**Check later**: high fields hold at least 80% of the observed price variance the comparables model explains. Fewer than 1 in 10 asked inputs change nothing.

## F3. Fill-ladder order

**Determines**: the order in which rungs are tried for each field, and which routes each rung uses.

**Sources and weights**

| source | contributes | weight | why |
|---|---|---|---|
| cost to the person (seconds) | the first sort key | dominant | the least extra input (Nate) |
| `route_table` unit cost over (ok, hit and right rates) ([router](../features/data.md#source-registry-and-router-agent-proposal)) | the second sort key, among the lookup routes | as the router ranks | measured per route |
| a field's past fill rate per rung | skips a rung that rarely fills it | below 2% over 90 days (start) | saves latency |
| `views_needed` | whether rung 1 can fill it at all | gate | |

**Method**:
1. Sort the rungs by person cost (0 for rungs 1 to 4), then by our cost.
2. Rungs 1, 2 and 4 run in parallel when their inputs exist. Rung 3 waits for comparables. Rung 5 waits for all the others.
3. A rung with a past fill rate under 2% for the field and node is skipped (start).

**Why this method**: the person's time is the scarce cost, and parallel free rungs keep latency to the slowest rung (*inferred*; identify uses the same rule, *observed* in [identify](../features/identify.md#design-choices)). The alternative is a fixed serial ladder. It is simpler, but it is slower.

**When it is not shown**: internal. The "Why?" history shows the rung that filled each field.

**How it is explained**: "From the tag", "From the catalogue", "Seen in 6 sold listings", "You said".

**Speed**: rungs 1 and 4 run in under a second on device. Rungs 2 and 3 finish within identify's 15 s cap (*asserted* target).

**Check later**: the median item reaches filled-enough with zero rung 5 inputs, and rung 5 averages under 1 input per item.

## F4. Filled enough

**Determines**: whether each field, and so each site's listing, is ready.

**Sources and weights**

| source | contributes | weight | why |
|---|---|---|---|
| the row's importance per target | which bar applies | rule | section 3 table |
| [seeing 18](seeing-the-item.md#18-whether-a-fact-may-be-stated-as-confirmed) | confirmed or not | gate for high fields | one definition of confirmed |
| `claim_check` | pass, hold or abstain | gate for any field in a listing | a hold becomes `unbacked_claim` |
| site required flags | must be present | gate per site | |

**Method**:
1. For each target site, take the fields high for that site, the site's required fields, and the medium fields that have values.
2. A site is ready when every high field meets its bar.
3. A medium field is listed only after `claim_check` passes.
4. Low fields that are empty are dropped from that site's form.

**Why this method**: per site, so one site's gap never holds the other four (*inferred*, matches item-card's per-logo dot). The alternative is one bar for the whole item. It is simpler, but it blocks four sites for one site's field.

**When it is not shown**: when no site is chosen yet.

**How it is explained**: a dot on the site's logo; tapping it opens the one input that fills the gap.

**Speed**: recomputed on every attribute write, in milliseconds.

**Check later**: no post fails for a missing field (the harness read-back), and no listed claim is later corrected by the person in more than 1 in 100 items.

## F5. Conflict between sources

**Determines**: the value kept when two rungs disagree on a field.

**Sources and weights**

| source | contributes | weight | why |
|---|---|---|---|
| `you_said` | a value | overrides; a model never replaces it | owner statement |
| decoded code or model plate, and a catalogue spec reached from it | a value | rank 1 | identify's ladder |
| `label` text read from the item | a value | rank 2 | read, not guessed |
| `measured` | a value | rank 2 for measurements | it beats the size label for fit, and both are kept |
| catalogue match without a code | a value | rank 3 | |
| `inferred` from 5 or more agreeing listings | a value | rank 4 | others' listings carry errors |
| vision guess | a value | rank 5 | |

**Method**:
1. Take the highest-ranked value.
2. If a value of equal rank disagrees, write `value: null` with `unknown_reason: conflict`.
3. A `high` field in conflict goes to rung 5 with both values as options. A `medium` or `low` field is omitted.
4. A conflict between a label and the matched product's spec reopens the match through [seeing 9](seeing-the-item.md#9-which-product-it-is-and-when-identity-is-confirmed). It does not settle the field.

**Why this method**: it is identify's evidence ladder applied per field, so identity and fields never disagree on what counts as proof (*inferred*). The alternative is a confidence-weighted average. It works for numbers, but it invents values for text.

**When it is not shown**: when no conflict exists.

**How it is explained**: "The tag says M; the catalogue says L for this code. Which?"

**Speed**: inline on each write.

**Check later**: on 200 items with injected conflicts, the kept value is right at least 95% of the time, and label against spec conflicts catch at least 80% of wrong-variant matches.

## All determinations

| # | Determines | Main source | Learned or fixed |
|---|---|---|---|
| F1 | kind gid, family, site category map | code, match, vision within the family | weights start values |
| F2 | importance per field for match, value, rank | measured effects | learned weekly, approved |
| F3 | fill-ladder order | person cost, router rank | fill rates learned |
| F4 | filled enough per site | importance, seeing 18, claim_check | rule |
| F5 | conflict between sources | evidence rank | rule |

## What cannot be made credibly

- **Era of an unmarked item.** It is inferred and stated as "likely". It is never confirmed without a printed date or a catalogue entry.
- **Rank importance on Facebook and Depop.** There is no ranker model until score has observed enough ranks. Until then the guidance prior stands.
- **A Shopify to eBay category map without a person's check.** The suggestions are a search, not a mapping (*asserted*).

## What I need from other areas

- **product.md (shared model).**
  - Widen `requirement` as in section 2: `node`, `type`, `values_or_unit`, `role`, `site_names`, `importance`, and `fill_ladder`, which replaces `obtained_by`; `priority` is derived.
  - Add `kind` (id, parent_id, family, shopify_gid, google_id, version) and `category_map` (kind_id, site, marketplace, site_category, version).
- **seeing-the-item.** Card 1's "13 kinds" are the families here. Card 3 reads `importance` through the derived `priority`.
- **data.** `param_fold` runs the `requirement_fold` challenger for the three effects in F2.
- **money.** D2 exposes the per-field adjustment that F2 reads.
- **list.** D6 and D7 read `site_names` and `category_map`.
- **data.** The router adds the spec lookup and the IMEI or TAC lookup as needs.

## What its parameters learn from (*agent proposal*)

Every learned number on this page is a `param` row whose written value is the prior. It updates from three sources, each written as an `observation` with evidence and a weight for how sure the outcome is: every listing the protocol reads on a site and what changed when it was read again (a price or rank change, a sold mark, a disappearance counted as a probable sale by age and the site's sell-through); what platforms and industries publish, gathered by the information engines; and our own users' outcomes, the most exact rows, which calibrate the rest. Learning does not wait for our users. How rows update, promote, guard and roll back is in [product §6](../product.md#real-time-weights-agent-proposal).
