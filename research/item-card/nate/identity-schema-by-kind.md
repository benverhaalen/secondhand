# What identifies each kind of used item exactly, what decides its resale value, and what a capture must record, look up or ask?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: item-card.

## How to read this note
- Evidence marks: *observed* (page opened, URL and source date given), *asserted* (from memory or a source claim not shown), *inferred* (my reasoning). Every table at the end of a kind is *inferred*.
- Where this extends existing work: the record parts (`item`, `product`, `attribute`, `photo`, `listing`) and the attribute shape are in [item-card spec](../../../spec/features/item-card.md) lines 17-24; pins are lines 45-51. The per-category shot list idea (top, pants, shoes, bag, electronics, furniture, other) is in [guided-shot-list](../../capture/ben/guided-shot-list.md) line 17. The rules "never claim authentic or works", "ask only when the answer changes identity, value, safety or fulfilment" and the condition scale are in [identify spec](../../../spec/features/identify.md) (condition and flaws near lines 55-59, never-claims near lines 61-67) and [build-plan](../../identify/ben/build-plan.md) (section 4.6). This note adds, per kind, the identifier locations, the market's own condition vocabulary, and a field-by-field source table. It contradicts none of them.
- Capture roles used below are the existing ones: front, back, tag, care_label, fabric, flaw, detail, side, inside, sole.
- Source-form definitions differ by market. The condition words below are each market's own, quoted; mapping to the internal 6-level scale is not redone here.

## Cross-kind findings
1. Condition vocabularies are different per market, and some are split in two: vinyl and books grade the item and its cover separately (*observed*, Discogs https://support.discogs.com/hc/en-us/articles/360001566193-How-To-Grade-Items, 2026-07-22; AbeBooks https://www.abebooks.com/books/rarebooks/collecting-guide/understanding-rare-books/guide-book-conditions.shtml, 2021-06-03). Cards add a third axis, a typed defect list (TCGplayer, below). One `condition` attribute does not carry that.
2. Completeness changes the price class itself in games, watches, sneakers and LEGO: PriceCharting prices Loose, Complete (CIB), New and Graded as four separate values (*observed*, https://www.pricecharting.com/faq); BrickLink separates Sealed, Complete and Incomplete sets (*observed*, https://www.bricklink.com/help.asp?helpID=102); Chrono24 asks for delivery contents and warns not to present a service card as original papers (*observed*, https://update.chrono24.com/how-to-create-listings-that-sell-on-chrono24/, 2026-06-02).
3. A date code or serial number is read from the object but does not prove authenticity (*observed*, Fashionphile https://www.fashionphile.com/blogs/academy/louis-vuitton-date-codes, 2021-03-19). That fits the existing rule never to claim "authentic".
4. Some kinds carry a legal flag that blocks sale, not only lowers price: recalled products are illegal to sell, and pre-June-2011 cribs and drop-side cribs must be destroyed (*observed*, CPSC https://www.cpsc.gov/s3fs-public/254_ResellersGuide_2-5-25.pdf, guide dated 2-5-25 in its filename).
5. Several decisive facts are not on the object at all: phone battery health is read from Settings, not seen (*observed*, Swappa below); function; smell; hidden damage.

## 1. Tops, bottoms, dresses, outerwear

**Identifiers and where they are.**
- Legal label: a US textile garment must carry fibre content (percentages by weight, in order), the country of origin, and a company name or an RN number (*observed*, eCFR 16 CFR 303.16 https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-303/section-303.16; FTC guide https://www.govinfo.gov/content/pkg/GOVPUB-FT-PURL-LPS86207/pdf/GOVPUB-FT-PURL-LPS86207.pdf, both undated in the fetch). Garments with a neck carry the country-of-origin label at the inside centre of the neck; fibre content and RN may be on another label inside or outside (*observed*, eCFR part 303 same URL). The care label (16 CFR 423) can carry the same information (*observed*, 303.16(a)). RNs are not issued to businesses outside the US (*observed*, FTC guide), so an imported brand may show a name instead.
- Size tag, style number and date code position vary by brand. Style code and season code on a tag or sewn-in label: *asserted*. Whether the build plan records brand date codes was not re-checked.
- The RN lookup is a public FTC database with no API (carried from earlier work, *asserted* here, not re-opened).

**Variant-defining attributes.** Size (tag size and measured), colourway, fibre blend, fit name, season or year. Size labels do not equal measurements, so measurements are separate (*inferred*).

**Condition scale.** eBay clothing: New with tags, New without tags, New with imperfections, Pre-owned Excellent, Good, Fair (*observed*, https://pages.ebay.com/preownedfashionconditionguidance/ and https://www.ebay.com.au/sellercentre/conditions-grading, AU rollout 22 July 2025). Named elements eBay asks sellers to disclose: broken or missing fasteners, discolouration, visible wear such as pilling and thinning, holes or tears, stains, loose stitching, pet hair, odour (*observed*, same pages). Mercari (New, Like New, Good, Fair, Poor) and Depop (Brand new, Used - Excellent, Good, Fair, Poor) are as listed in the build plan.

**Completeness.** Hangtag, spare buttons, belt, hood or lining liner, original hanger or garment bag (*inferred*).

**Cannot be known from a capture.** Smell (smoke, mildew, perfume), fabric feel and pilling under light, odour is named by eBay as a disclosure element. Cheapest check: one yes/no owner question on smoke or pets. Authenticity for designer: *inferred* only by tag details; never claimed.

**Measurements buyers expect.** Pit to pit, length, shoulder, sleeve for tops and outerwear; waist, rise, inseam, hip for bottoms; bust, waist, length for dresses (*asserted*, common reseller practice; see also the measure notes under research/measure, unopened here).

**Safety or legal.** Flammability labels on children's sleepwear (*asserted*). Fur and down labelling (*asserted*).

**Shipping class.** Light parcel; polybag for most, a box or heavier tier for coats (*inferred*).

| Item-record field | How obtained | Capture view |
|---|---|---|
| brand | read from tag, neck label | tag |
| size label | read from tag | tag |
| fibre content | read from care label (OCR) | care_label |
| country of origin | read from neck label | tag |
| RN or company | read from care_label | care_label |
| style/season code | read from tag, then looked up | tag |
| colour | seen | front |
| measurements | measured (flat lay with reference) | front, back |
| model/line name | looked up after identification | front |
| condition grade | seen, flaws listed | front, back, flaw |
| flaws (stain, hole, pilling) | seen, owner confirms | flaw, fabric |
| hangtag/NWT | seen | detail |
| smoke/pet home | asked | none |
| cost/where bought | asked | none |

Fewest questions: any flaws the photos may miss? smoke-free and pet-free home? bought new, worn how often? (*inferred*)

## 2. Shoes and sneakers

**Identifiers.** Style code or SKU: GOAT lists by "SKU or name" and wants a photo of the size tag on the box (*observed*, Business Insider https://www.businessinsider.com/how-to-sell-shoes-on-goat-vs-poshmark-and-stockx-2023-2, 2023-04-10). The tag inside the tongue or shoe carries the style code, size and production date (*asserted*). StockX B-Grade is typically stamped on the tag inside the shoe or on the box (*observed*, https://stockx.com/help/articles/what-is-the-condition-of-items-sold-on-stockx, undated).

**Variant-defining attributes.** Style code, colourway name, size and width, gender sizing (men, women, GS), release year (*asserted*). Left and right size can differ (*inferred*).

**Condition scale.** eBay shoes: New with box, New without box, New with defects, Pre-owned Excellent, Good, Fair (*observed*, eBay item conditions page https://www.ebay.com/help/selling/listings/creating-managing-listings/item-conditions-category?id=4765). StockX Listings: New, New - Other, Used; Verified Marketplace needs brand new with the original box; pairs may pass after being unlaced or tried on, with minor box damage or age discolouration acceptable; sneakers five years or older may have structural weakness regardless of storage (*observed*, https://stockx.com/help/articles/What-kinds-of-sneakers-are-sold-on-StockX, undated). Slang (deadstock, VNDS) is not platform-defined (*observed*, https://www.canyoukicksit.com/blog/how-to-grade-sneaker-condition/, 2026-08-28; blog, points to sources only).

**Named defects.** Yellowing, sole separation, tread and star loss, heel drag, creasing, midsole paint cracks, stains, insole logo rubbed off, odour (*observed*, same CYKI page).

**Completeness.** Original box with correct label, tissue, spare laces, hangtags, inserts; matters most for limited releases (*observed*, CYKI).

**Cannot be known from a capture.** Odour, structural integrity (sole glue), authenticity. Cheapest check: yes/no worn outdoors and any sole separation; authentication is a marketplace service (GOAT authenticates used shoes, *observed*, Business Insider).

**Measurements.** Size label and, for non-standard fits, insole length (*asserted*).

**Safety or legal.** None specific; counterfeit risk is marketplace-side.

**Shipping class.** Box, about 1 to 2 kg with box (*inferred*).

| Item-record field | How obtained | Capture view |
|---|---|---|
| brand, model | read from tongue/tag, looked up | tag, side |
| style code/SKU | read from inside tag or box label | tag |
| size, width | read from tag | tag |
| colourway | looked up after style code | side |
| condition | seen | front, side, sole |
| sole wear | seen | sole |
| midsole yellowing/separation | seen | side, detail |
| insole condition | seen | inside |
| box, laces, extras | seen | detail |
| odour | asked | none |
| worn count | asked | none |
| where bought, receipt | asked | none |

Fewest questions: original box included? worn outdoors, how often? any sole separation or odour? (*inferred*)

## 3. Bags and accessories

**Identifiers.** Louis Vuitton: modern date code is two letters (factory) plus four digits (first and third digits are the week, second and fourth the year), stamped on an interior leather tab, under a D-ring tab, on the lining, under the hanging pocket (Speedy, Neverfull), or on a wallet's side seam (*observed*, Fashionphile https://www.fashionphile.com/blogs/academy/louis-vuitton-date-codes, 2021-03-19). Other brands use serial plates or stamps; locations vary by brand and model (*asserted*).

**Variant attributes.** Model, size (PM, MM, GM), colour, material (leather type, coated canvas), hardware colour, year or season.

**Condition scale.** Fashionphile has seven: Giftable, New, Excellent, Very Good, Good, Fair, Flawed. Named wear: slightly worn corners, creases in leather, tarnished hardware (Very Good); surface scratches, darkening in handles (Good). Ineligible: exposed piping, melted glazing, severe interior staining, tears at corners or handles (*observed*, https://www.fashionphile.com/blogs/academy/fashionphile-condition-ratings, 2024-03-08).

**Completeness.** Original box, dust bag, case, retail tags, authenticity card, receipt; Fashionphile lists a "Comes With" section per item (*observed*, https://www.fashionphile.com/pages/authenticity, undated).

**Cannot be known from a capture.** Authenticity, interior odour, hidden structural wear. Fashionphile's own check covers stamping, stitching, hardware, date codes and serial numbers (*observed*, same page). A capture records the stamps; it does not verdict them.

**Measurements.** Width, height, depth, strap or handle drop (*asserted*).

**Safety or legal.** Restricted materials (exotic skins, CITES) (*asserted*).

**Shipping class.** Box, 1 to 3 kg (*inferred*).

| Item-record field | How obtained | Capture view |
|---|---|---|
| brand, model | read from logo/stamp, looked up | front, detail |
| date code/serial | read from interior tab | inside |
| material, hardware colour | seen | detail |
| size/dimensions | measured | front, side |
| condition | seen | corners, base, handles, inside |
| flaws (corner wear, odour, scratches) | seen, asked | flaw |
| dust bag, box, card, receipt | seen | detail |
| authenticity | not claimed; stamps recorded | detail |
| purchase source, receipt | asked | none |

Fewest questions: where and when bought, with receipt? dust bag and box and card included? any odour or interior marks? (*inferred*)

## 4. Jewellery and watches

**Jewellery identifiers.** Purity stamp (10K, 14K or 585, 18K or 750, 925 sterling, PT950) on the inside of a ring band, near or on a chain or bracelet clasp, on an earring post, on the back or bail of a pendant (*observed*, Jewelers Mutual https://www.jewelersmutual.com/resources/individuals/how-buy/your-guide-gold-markings-and-stamps-jewelry, 2023-09-05; XGOUD https://www.xgoud.nl/en/knowledge/guides/guide-jewellery-hallmarks, 2026-07-01). A maker's mark (Tiffany, T & Co., HW) means signed pieces tend to be worth more (*observed*, Jewelers Mutual). UK hallmarks have four or five stamps: maker, standard, assay office, date letter, sometimes duty (*observed*, https://www.jewelrycarats.com/complete-guide-to-jewelry-marks-identification/, 2026-01-17). A stamp is no guarantee; false stamping happens and a dealer tests with acid or X-ray (*observed*, XGOUD).

**Jewellery value drivers.** Metal and karat, weight in grams, stones (type, carat, cut, colour, clarity, certificate if any), signed or not (*asserted* for stones and weight). Weight needs a scale: a phone cannot measure it.

**Watch identifiers.** Reference number: on the case back, between the lugs or inscribed on the dial, depending on maker; also in documents and the invoice (*observed*, Chrono24 FAQ https://www.chrono24.com/info/faqs.htm). Include any suffix, for example 126710BLNR not 126710 (*observed*, Chrono24 listing guide 2026-06-02). The serial number is separate (*observed*, FAQ). Stolen-watch databases are checked by serial (*observed*, FAQ).

**Watch condition scale (Chrono24, updated 2024-07-10).** New; Like new; Very good (minor signs of wear); Good (moderate); Fair (major); Incomplete (missing parts, not functional, for repair or spares). Polishing is named: Very good may have been professionally polished without affecting contours; the listing form asks for polishing state as Unpolished, Polished or Unknown (*observed*, https://update.chrono24.com/indicating-item-condition/ and listing guide). Components graded: case, bezel, crystal, dial and hands, bracelet or strap, caseback (*observed*, listing guide).

**Watch completeness.** Original box, original papers, extra links or straps, service records; a service card is not original papers (*observed*, listing guide).

**Cannot be known from a capture.** Movement function, water resistance, service history, whether parts are original or aftermarket, stone authenticity, true karat. Cheapest check: owner states ticking and date change work, last service year, and whether box and papers are original; test or appraisal for metal and stones.

**Safety or legal.** Children's metal jewellery must be tested for compliance (*observed*, CPSC reseller guide). Hallmarking law varies by country (*asserted*).

**Shipping class.** Small insured parcel; tracked and signed (*inferred*).

| Item-record field | How obtained | Capture view |
|---|---|---|
| brand, maker's mark | read from stamp or dial | detail |
| metal purity stamp | read (loupe-level close-up) | detail |
| weight (g) | measured with scale, asked | none |
| watch reference | read from case back, lugs or dial, looked up | back, detail |
| watch serial | read from case, or asked | back |
| movement type, size | looked up from reference | none |
| stones | seen, asked for certificate | detail |
| ring/bracelet size | measured | detail |
| case/crystal/bracelet wear | seen | front, side, back |
| polished or not | asked | none |
| box, papers | seen | detail |
| runs, keeps time, service date | asked | none |

Fewest questions: does it run and when was it last serviced? box and papers original? has it been polished or repaired? any certificate for the stone or metal? (*inferred*)

## 5. Furniture (case goods, seating, tables)

**Identifiers.** Maker's mark, label or stamp: inside a drawer, on the underside of a seat or table, on the back panel, on a metal plate; maker, model name and date are sometimes there (*asserted*, no source opened for furniture). Mass retailers use a model sticker or QR label (IKEA article number on a sticker) (*asserted*).

**Variant attributes.** Maker, model, material (solid wood species, veneer, laminate), finish, dimensions, number of pieces in a set, year or era.

**Condition scale.** eBay general conditions (New, Open box, Used, For parts) where the clothing scale does not apply; the exact eBay condition list for furniture was not opened (*not-found* for furniture specifically; the eBay item conditions page above governs). Named defects: scratches, water rings, veneer lift, wobble, sagging cushions, stains, pet damage, smoke odour (*asserted*).

**Completeness.** Hardware bag, keys for locks, shelves, glass, leaves for extending tables, cushion count, assembly instructions (*inferred*).

**Cannot be known from a capture.** Structural soundness (wobble), woodworm, odour, whether it comes apart for transport, whether parts are replacements. Owner question: does it come apart and does it fit through a door.

**Measurements.** Width, depth, height, seat height, leaf size, door clearance (*asserted*).

**Safety or legal.** Painted furniture and lead limits (*observed*, CPSC reseller guide: resellers cannot knowingly sell painted furniture that does not comply with lead limits). Flammability on upholstery (*asserted*).

**Shipping class.** Local pickup, freight, or flat-pack; oversized (*inferred*).

| Item-record field | How obtained | Capture view |
|---|---|---|
| maker/brand, model | read from label or stamp, looked up | inside, detail |
| material, finish | seen, asked | front, detail |
| dimensions, weight | measured, asked | front, side |
| era/year | looked up, asked | detail |
| condition | seen | front, side, inside |
| flaws | seen | flaw |
| completeness (keys, leaves) | seen, asked | detail |
| odour/smoke | asked | none |
| disassembles | asked | none |
| pickup address area | asked | none |

Fewest questions: exact dimensions? does it come apart? smoke or pet home? (*inferred*)

## 6. Lighting and home goods

**Identifiers.** Maker stamp or base mark on pottery and glass, backstamp on china, a UL or CE rating label on lamps with a model number and wattage (*asserted*). Patterns have names (Corelle, Pyrex pattern name) (*asserted*).

**Variant attributes.** Maker, pattern or line, size, colour, material, set count, era.

**Condition.** General used grades; chips, cracks, crazing, scratches, missing shade, frayed cord, replaced parts (*asserted*). For a lamp, the electrical condition is not visible.

**Completeness.** Shade, finial, harp, bulbs, set count, lids, boxes (*inferred*).

**Cannot be known.** Whether it works, wiring safety, hairline cracks. Owner question: turned on and working.

**Measurements.** Height, width, base size, shade diameter, set count (*asserted*).

**Safety or legal.** Recalled lamps, heaters, and small electricals are illegal to sell (*observed*, CPSC reseller guide). Lead in some ceramics (*asserted*).

**Shipping class.** Fragile box, double-boxed; glass and ceramics need cushioning (*inferred*).

| Item-record field | How obtained | Capture view |
|---|---|---|
| maker, pattern | read from backstamp or base, looked up | detail, inside |
| dimensions | measured | front, side |
| material | seen | front |
| set count | seen, asked | front |
| condition, chips/cracks | seen | flaw, detail |
| works (lighting) | asked | none |
| shade/bulb included | seen | front |
| recall status | looked up on model | tag |

Fewest questions: works when plugged in? any chips or cracks you know of? how many in the set? (*inferred*)

## 7. Phones, laptops, tablets, cameras, audio, game consoles

**Identifiers (Apple).** Settings > General > About shows serial number, IMEI/MEID, EID; iPhone 6s through 13 mini and later with a tray: IMEI on the SIM tray; iPad: serial on the back, IMEI on cellular models; the model number is visible in Settings, on the back of older devices, in the SIM tray slot or on the connector (*observed*, Apple Support https://support.apple.com/en-us/108037, 2026-05-12, and https://support.apple.com/en-us/106343, 2025-12-09). Non-Apple models carry a model number on a back label (*asserted*). Cameras carry the serial on the body and a lens serial; shutter count is stored in the camera (*asserted*).

**Variant attributes.** Model, storage, RAM and CPU for laptops, colour, carrier-locked or unlocked, year, screen size; for cameras, body-only versus kit and lens mount.

**Condition scale.** Swappa: New, Mint, Good, Fair, cosmetic only; to sell the device must be fully functional with no cracks or water damage, clean IMEI/ESN, no activation lock, not financed; the charger is not required for phones (*observed*, https://swappa.com/about/conditions and https://swappa.com/blog/guide-used-electronics-condition-grades/, 2026-06-17). KEH cameras: New, Like New, LN-, EX+, EX, BGN, UG, AS-IS; LN- 97-99%, EX+ 90-96%, EX 80-90%, BGN 70-79% of original condition (*observed*, https://www.keh.com/grading-system and https://www.keh.com/shop/faq). Named camera defects: lens dust, haze or fungus, finish loss and brassing, ring tension (*observed*, KEH blog 2019-09-09). Price ladder shown in that 2019 post for a Canon 5D Mk III: New $2,799, LN- $1,799, EX+ $1,599, EX $1,429, BGN $999 (*observed*; dated 2019, so a magnitude, not a current price).

**Battery.** Swappa sets no minimum percent; iPhone sellers must disclose battery health below 80% when the service message shows; the value is read at Settings > Battery > Battery Health (*observed*, https://swappa.com/blog/battery-health-used-electronics/, 2026-06-17).

**Completeness.** Box, charger and cable, accessories, lens cap, strap, controllers for consoles, original packaging (*inferred*). Accessories are usually not included on KEH (*observed*).

**Cannot be known from a capture.** Function, battery health, activation lock or account lock, carrier lock, IMEI blacklist status, shutter count, sensor dust, dead pixels. Cheapest checks: owner reads About and Battery Health screens (a screenshot capture of Settings is cheaper than asking); sign-out of account confirmed by owner; IMEI check via a blacklist service (not opened).

**Measurements.** Screen size and weight from the model; no measuring needed (*inferred*).

**Safety or legal.** Recalled batteries, chargers, power banks (*observed*, CPSC resale rule); data wiped and accounts removed (*asserted*); IMEI should be clean (*observed*, Swappa).

**Shipping class.** Small insured box, 0.5 to 3 kg (laptop heavier); consoles 3 to 6 kg (*inferred*).

| Item-record field | How obtained | Capture view |
|---|---|---|
| brand, model, model number | read from back label or Settings screenshot, looked up | back, screen (About) |
| storage, RAM, CPU | read from Settings or spec, looked up | screen |
| serial, IMEI | read from Settings, SIM tray, back; stored privately | screen |
| colour | seen | front, back |
| carrier lock | asked | none |
| battery health % | read from Settings screenshot | screen |
| cosmetic grade | seen | front, back, side |
| screen cracks | seen | flaw |
| power on, functions work | asked | none |
| activation/account lock off | asked | none |
| accessories included | seen | detail |
| camera shutter count | read from software, asked | none |
| lens haze/fungus | seen with light, asked | detail |

Fewest questions: does everything work? battery health percentage? unlocked and signed out of the account? charger and box included? (*inferred*)

## 8. Small appliances and tools

**Identifiers.** Rating plate or data label with model number, serial number, voltage and date of manufacture, usually on the base or back (*asserted*). Power tools: model and serial on the housing, battery platform and voltage (*asserted*).

**Variant attributes.** Model, voltage and platform (18V, 20V), corded or cordless, size and capacity, colour, year.

**Condition.** General used grades; wear on cords, cracked housings, chuck or blade wear, missing accessories (*asserted*).

**Completeness.** Batteries and charger (often decide value for cordless tools), case, blades, attachments, manual, original box.

**Cannot be known.** Function under load, motor condition, battery capacity. Owner question: powers on and runs.

**Measurements.** Capacity, dimensions, weight (*inferred*).

**Safety or legal.** Recalled appliances and tools cannot be sold (*observed*, CPSC https://www.cpsc.gov/Business--Manufacturing/Business-Education/ResaleThrift-Stores-Information-Center/Stop-Online-Sale-of-Recalled-Products); the CPSC example list names a leaf blower and a bassinet. Check cpsc.gov/recalls before listing (*observed*, same page).

**Shipping class.** Boxed, 1 to 15 kg; heavy tools on freight (*inferred*).

| Item-record field | How obtained | Capture view |
|---|---|---|
| brand, model, serial | read from rating plate, looked up | tag (plate) |
| voltage/platform | read from plate | tag |
| capacity/size | looked up | none |
| condition, wear | seen | front, side, detail |
| cord/housing damage | seen | flaw |
| battery and charger included | seen | detail |
| runs | asked | none |
| recall status | looked up on model | tag |
| accessories | seen | detail |

Fewest questions: does it power on and run? batteries and charger included? any recall repair done? (*inferred*)

## 9. Books, vinyl, games and media

**Books.** ISBN is on the back cover barcode and the copyright page (*asserted*). Same title exists in many editions; ISBN pins the edition (*observed*, https://www.savetheblog.com/blog/abebooks-shopping-guide-2026, 2026-06-24; a blog). For collectables the ISBN is not enough: first printing is read from points such as the number line, publisher statement, jacket price and binding (*observed*, same page); signed copies command a premium. Condition (AbeBooks guide, 2021-06-03): As New, Fine, Near Fine, Very Good, Good, Fair, Poor (Reading Copy), As Described; "+" and "-" modifiers; jacket graded separately; named: price clipped, shelf wear, chipped, ex-library (*observed*, https://www.abebooks.com/books/rarebooks/collecting-guide/understanding-rare-books/guide-book-conditions.shtml). Completeness: dust jacket.

**Vinyl.** Identifiers are the catalogue number on the spine and label, and the matrix or runout etching in the dead wax (*asserted*, Discogs practice, not opened here); these distinguish pressings. Discogs uses Goldmine grades, also for CD and cassette; sleeve and media are graded separately; VG+ is about 50% of NM value, VG about 25%, G and G+ about 10 to 15% (*observed*, https://support.discogs.com/hc/en-us/articles/360001566193-How-To-Grade-Items, 2026-07-22; the page fetch was truncated, so the Fair and Poor definitions were not read).

**Games.** PriceCharting conditions: Loose, Complete (CIB), Brand New (sealed), Graded; Box Only; Manual Only; listing defects are objective flags such as writing, stickers, scratched cover (*observed*, https://www.pricecharting.com/faq and https://www.pricecharting.com/page/methodology). Region and platform are part of identity (*asserted*).

**Cannot be known.** Whether the disc plays, record surface noise, pressing authenticity, hidden water damage. Cheapest check: owner states plays through; for vinyl, owner states visible scratches and plays without skipping.

**Measurements.** Format and page count only.

**Safety or legal.** Bootleg or reproduction pressings and games cannot be sold as originals (*observed*, PriceCharting says reproductions and fakes cannot be sold, FAQ).

**Shipping class.** Media mail or small parcel; vinyl needs a stiff mailer (*inferred*).

| Item-record field | How obtained | Capture view |
|---|---|---|
| ISBN/barcode | read from barcode | back |
| title, author/artist | read from cover, looked up | front |
| edition, printing | read from copyright page, number line | inside |
| catalogue no., matrix etching | read from label and runout | detail |
| format, platform, region | read from cover/spine | front, back |
| condition (item) | seen | front, back, inside |
| condition (jacket or sleeve) | seen | front, flaw |
| ex-library, writing, signed | seen | inside, flaw |
| disc/record plays | asked | none |
| complete (case, manual, inserts) | seen | detail |

Fewest questions: does it play through without skipping? which edition or printing? is the jacket or sleeve original? (*inferred*)

## 10. Trading cards and collectibles

**Identifiers.** Pokemon: card number in the bottom left or right corner as "36/114"; the first number is the card, the second is the set size; a higher first number marks a secret rare; the set is read from the set logo above the lower border (Base Set has none); "1st Edition" logo near the artwork corner; variants are standard, holo and reverse holo (*observed*, PriceCharting blog https://blog.pricecharting.com/2021/01, 2021-01). Magic and other games use a set code and collector number (*asserted*).

**Raw card scale.** TCGplayer: Near Mint, Lightly Played, Moderately Played, Heavily Played, Damaged, plus Foil variants; imperfections are typed by Type and Severity; Mint and Gem Mint are not sold there (*observed*, https://help.tcgplayer.com/hc/en-us/articles/221430307-How-can-I-tell-what-condition-my-card-is-in, undated).

**Graded.** PSA 10 Gem Mint: four sharp corners, centering about 55/45 front and 75/25 back, no staining; qualifier MK (marks); no-grade reasons: trimming, restoration, recoloration, questionable authenticity, altered stock (*observed*, https://www.psacard.com/gradingstandards, truncated fetch; grades 9 to 1 not read). PriceCharting prices Ungraded, Grade 7, 8, 9, 9.5, PSA 10 and BGS 10 separately (*observed*, https://www.pricecharting.com/page/methodology). The gap is large: base-set Charizard 1st Edition about $300,000 at PSA 10 versus $6,500 ungraded in 2021 (*observed*, blog 2021-01).

**Completeness.** Sleeve or slab, grading certificate number, sealed packaging for sealed product.

**Cannot be known.** Authenticity and the grade a grader would give (centering, surface, corners under magnification). Owner question: graded? by whom and cert number?

**Measurements.** None; edge and corner close-ups instead.

**Safety or legal.** None specific; fakes are a platform concern.

**Shipping class.** Letter with a sleeve, top loader and bubble mailer; slabs boxed (*inferred*).

| Item-record field | How obtained | Capture view |
|---|---|---|
| game, set, name | read from card, set logo | front |
| card number | read from corner | detail |
| edition (1st, shadowless) | read from card | front |
| holo/reverse/foil | seen | front (tilt) |
| language | read from text | front |
| grade (raw) | seen, as NM...Damaged | corners, edges, surface |
| grade (graded) | read from slab label | front, back |
| cert number | read from slab | detail |
| defects typed | seen | flaw |

Fewest questions: graded or raw? 1st edition or not? any bends or creases you can feel? (*inferred*)

## 11. Toys and LEGO

**LEGO identifiers.** Set number is on the box and on the instruction booklet cover; BrickLink catalogue lists sets by item number (*observed*, https://www.bricklink.com/catalogList.asp?catType=S, unopened; the exact printed location of the number on the box is *asserted*). Minifigure identity is separate.

**LEGO condition.** BrickLink: Sealed (unopened factory seals), Complete (all contents, extra parts, stickers, instructions, box), Incomplete (missing contents, must say what), Used (opened or built; excessive wear, discolouration or scratches noted); minifigures New or Used, displayed ones must be Used; incomplete minifigures are not listed as figures (*observed*, https://www.bricklink.com/help.asp?helpID=102, undated).

**Other toys.** Maker, line, year, character, scale, articulation, accessories; complete with accessories and packaging drives collector value (*asserted*). Condition terms: carded or boxed, loose, play wear, paint chips, yellowing plastic (*asserted*).

**Cannot be known.** Whether all pieces are present without counting; electronics work; small parts missing. Owner question: counted against the inventory, and box and instructions present.

**Safety or legal.** Children's products: recalled items are illegal to sell; small parts and lead limits; cannot knowingly sell a children's product that fails lead limits (*observed*, CPSC reseller guide).

**Measurements.** Box size, set piece count from the catalogue (*inferred*).

**Shipping class.** Boxed, 0.5 to 8 kg; large sets bulky (*inferred*).

| Item-record field | How obtained | Capture view |
|---|---|---|
| set/item number | read from box or manual | front, back |
| theme, name, year, piece count | looked up | none |
| sealed/opened | seen | front, detail |
| box, manual, stickers | seen | detail |
| minifigures count | seen | detail |
| parts complete | asked | none |
| built, displayed | asked | none |
| wear/yellowing | seen | flaw |
| recall status (children's) | looked up | tag |

Fewest questions: sealed or opened? all pieces, manual and box present? built and displayed or stored? (*inferred*)

## 12. Bikes and sports gear

**Identifiers.** Bike serial number is engraved beneath the bottom bracket in most cases; also on the head tube (Rad Power, some Schwinn), rear dropout (some BMX), underside of the crank, rear stays; some bikes carry several serial groups (*observed*, Bike Index https://bikeindex.org/serials and Yale https://your.yale.edu/work-yale/campus-services/getting-around-yale/bike/locate-your-bikes-serial-number, both undated). Bike Index matches look-alike characters (0 and O, S and 5) (*observed*, same Bike Index page). Frame size is on a sticker or tube; model year is on the frame decal or from the serial (*asserted*).

**Variant attributes.** Brand, model, year, frame size, wheel size, frame material, groupset, e-bike motor and battery.

**Condition.** General used grades; named: frame dents, rust, worn drivetrain, tire wear, brake pad wear, scratched paint (*asserted*). E-bike battery health is not visible (*inferred*).

**Completeness.** Pedals, saddle, charger (e-bike), lock keys, manual (*inferred*).

**Cannot be known.** Frame cracks, drivetrain wear percentage, e-bike battery capacity, whether the bike is stolen. Cheapest check: serial against a stolen register (Bike Index exists for that, *observed*).

**Measurements.** Frame size, wheel size, weight (*asserted*).

**Safety or legal.** Recalled bikes, helmets and e-bikes with batteries (*observed*, CPSC recalls apply; no bike-specific page opened). Lithium battery shipping restrictions (*asserted*).

**Shipping class.** Oversized, local pickup or a bike box; helmets and small gear boxed (*inferred*).

| Item-record field | How obtained | Capture view |
|---|---|---|
| brand, model, year | read from frame decals, looked up | side |
| serial number | read from under bottom bracket; kept private | detail |
| frame size | read from sticker, asked | detail |
| wheel size | read from tire sidewall | detail |
| groupset | read from drivetrain, looked up | detail |
| condition | seen | side, detail |
| frame damage | seen | flaw |
| e-bike battery | asked | none |
| accessories | seen | detail |
| stolen-register check | looked up by serial | none |

Fewest questions: frame size and rider height? e-bike battery age and range? ever crashed? (*inferred*)

## 13. Baby gear (safety recalls)

**Identifiers.** Manufacturer name, model number and date of manufacture on a label; CPSC requires durable infant products to carry these permanently affixed (*observed*, CPSC reseller guide https://www.cpsc.gov/s3fs-public/254_ResellersGuide_2-5-25.pdf). Cribs must carry a permanent date stamp (*observed*, same guide). Car seats carry an expiration or date of manufacture on the label on the side or base; generally six years after manufacture (*observed*, Colorado DOT https://www.codot.gov/news/2018/may/parents-beware-what-you-need-to-know-before-buying-or-selling-a-used-car-seat, 2018-05-23; the six-year figure varies by maker). The recall lookup needs make, model, model number and date of manufacture (*observed*, same page).

**Rules that block or restrict sale.**
- It is illegal to sell any recalled product; Section 19 of the CPSA, 15 U.S.C. 2068 (*observed*, CPSC https://www.cpsc.gov/Business--Manufacturing/Business-Education/ResaleThrift-Stores-Information-Center/Stop-Online-Sale-of-Recalled-Products).
- Cribs made or sold before 28 June 2011 are very likely noncompliant and illegal to sell; drop-side cribs cannot meet the standard (*observed*, same CPSC page and reseller guide).
- Do not sell nursery furniture or durable infant products that are broken, wobbly, unstable or missing parts, even if not recalled (*observed*, reseller guide).
- Hand-held carriers need locking handles and two warning labels; NHTSA expiry date should be checked (*observed*, reseller guide).
- Crash history disqualifies a car seat after a moderate or severe crash even with no visible damage; original manual and all parts should be present (*observed*, Colorado DOT).

**Condition scale.** General used grades; stains, frayed straps, cracked plastic (*asserted*).

**Completeness.** Manual, harness and tether, base, all hardware and screws, mattress for cribs (*observed* for hardware and manual, CPSC and Colorado DOT).

**Cannot be known.** Crash history, storage conditions, hidden recall repair status. Owner question: was it in a crash, and the date on the label.

**Measurements.** Dimensions and weight for shipping, age and weight range from the label.

**Shipping class.** Bulky; car seats and strollers oversized, local pickup is common (*inferred*).

| Item-record field | How obtained | Capture view |
|---|---|---|
| brand, model, model number | read from label, looked up | tag |
| date of manufacture/expiry | read from label | tag |
| recall status | looked up on model and date | none |
| standard/certification labels | read from label | tag |
| condition | seen | front, side, flaw |
| all parts and manual | seen, asked | detail |
| crash history | asked | none |
| harness/strap wear | seen | detail |
| age and weight range | read from label | tag |

Fewest questions: any crash? date on the label? all parts and manual present? (*inferred*)

## Searched / could not reach
- Direct curl of PSA, TCGplayer, Discogs, KEH, Swappa, Chrono24, CPSC returned 403 or 000; Goldmine, Rebag, FTC and PriceCharting pages returned 404 from direct curl. All values above came from Exa page text, which truncates long pages.
- Not read: PSA grades 9 to 1; Discogs Fair and Poor definitions; StockX help (script shell); eBay item-conditions help in Exa (timed out; eBay values are from the eBay pages cited and the seller centre page).
- Not found or not opened: any furniture-specific condition scale; GOAT's own condition definitions; Rebag grades; Magic collector-number conventions; vinyl matrix guidance (Discogs page not opened); LEGO box set-number position; bike-specific recall page; LEGO and toy shipping weights; quantitative shipping classes (all *inferred*).
- Several identifier locations (sneaker size tag contents, appliance rating plates, furniture marks, bag brands other than Louis Vuitton, clothing style codes) are *asserted* from memory.
- A narrow search does not prove an unfound item does not exist.

## Sources fetched
All *observed* via Exa text, dates as shown by the source:
- https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-303 and .../part-303/section-303.16 ; https://www.govinfo.gov/content/pkg/GOVPUB-FT-PURL-LPS86207/pdf/GOVPUB-FT-PURL-LPS86207.pdf
- https://pages.ebay.com/preownedfashionconditionguidance/ ; https://www.ebay.com.au/sellercentre/conditions-grading ; https://www.ebay.com/help/selling/listings/creating-managing-listings/item-conditions-category?id=4765
- https://stockx.com/help/articles/What-kinds-of-sneakers-are-sold-on-StockX ; https://stockx.com/help/articles/what-is-the-condition-of-items-sold-on-stockx
- https://www.canyoukicksit.com/blog/how-to-grade-sneaker-condition/ (2026-08-28) ; https://www.businessinsider.com/how-to-sell-shoes-on-goat-vs-poshmark-and-stockx-2023-2 (2023-04-10)
- https://www.fashionphile.com/blogs/academy/fashionphile-condition-ratings (2024-03-08) ; https://www.fashionphile.com/blogs/academy/louis-vuitton-date-codes (2021-03-19) ; https://www.fashionphile.com/pages/authenticity
- https://update.chrono24.com/indicating-item-condition/ (2024-07-10) ; https://update.chrono24.com/how-to-create-listings-that-sell-on-chrono24/ (2026-06-02) ; https://www.chrono24.com/info/faqs.htm
- https://www.jewelersmutual.com/resources/individuals/how-buy/your-guide-gold-markings-and-stamps-jewelry (2023-09-05) ; https://www.xgoud.nl/en/knowledge/guides/guide-jewellery-hallmarks (2026-07-01) ; https://www.jewelrycarats.com/complete-guide-to-jewelry-marks-identification/ (2026-01-17)
- https://support.apple.com/en-us/108037 (2026-05-12) ; https://support.apple.com/en-us/106343 (2025-12-09)
- https://swappa.com/about/conditions ; https://swappa.com/blog/guide-used-electronics-condition-grades/ (2026-06-17) ; https://swappa.com/blog/battery-health-used-electronics/ (2026-06-17)
- https://www.keh.com/shop/faq ; https://www.keh.com/grading-system ; https://www.keh.com/expert-advice/photography/education/does-camera-grade-affect-image-quality/ (2019-09-09)
- https://www.abebooks.com/books/rarebooks/collecting-guide/understanding-rare-books/guide-book-conditions.shtml (2021-06-03) ; https://www.savetheblog.com/blog/abebooks-shopping-guide-2026 (2026-06-24)
- https://support.discogs.com/hc/en-us/articles/360001566193-How-To-Grade-Items (2026-07-22)
- https://www.pricecharting.com/faq ; https://www.pricecharting.com/page/methodology ; https://blog.pricecharting.com/2021/01
- https://www.psacard.com/gradingstandards ; https://help.tcgplayer.com/hc/en-us/articles/221430307-How-can-I-tell-what-condition-my-card-is-in
- https://www.bricklink.com/help.asp?helpID=102 
- https://bikeindex.org/serials ; https://your.yale.edu/work-yale/campus-services/getting-around-yale/bike/locate-your-bikes-serial-number
- https://www.cpsc.gov/Business--Manufacturing/Business-Education/ResaleThrift-Stores-Information-Center/Stop-Online-Sale-of-Recalled-Products ; https://www.cpsc.gov/FAQ/ResaleThrift-Stores ; https://www.cpsc.gov/s3fs-public/254_ResellersGuide_2-5-25.pdf ; https://www.codot.gov/news/2018/may/parents-beware-what-you-need-to-know-before-buying-or-selling-a-used-car-seat (2018-05-23)
