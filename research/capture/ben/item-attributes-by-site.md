# For any item a person photographs, what must the app learn, in what order, to fill every site's listing form well?
Researched 2026-11-15 by Ben (Claude Code, Fable agent for the thread "Roll the UI system out everywhere"). Feature: capture.

Marks: *observed* (I opened the source on 2026-11-15 and it says so; the source code, such as E10, is in [Sources](#sources) with its URL), *asserted* (a source says it without showing it, an earlier note in this repo says it and I did not reopen its source, or it is my memory), *inferred* (my reasoning). Pages were read through a fetch summarizer, so quoted words are its excerpts. Every design line in sections 3 and 4 is an *agent proposal*.

Ben's ask, verbatim: "think of all the sub things each item needs and the whole decision tree ... think through all the possibilities and see if there is like a list or something of categories we can extract from each website ... the categories that each item needs to be sorted into. some are same some are different. like picking one color vs multiple and what the options are it depends for each one. the brands that each has available. if this isnt publicly available, soon you need to end up driving my actual accounts to explore this for each site and how the listing process works. specifics. like character limits. hashtag limits. photo number limits. optimal photos. do recursive seeded research if you havent already. how the measuring will work. the different stages."

**The decision this feeds.** Which `requirement` rows capture loads for an item, in what order it settles them, and what each site's adapter needs before it can post. It extends, and does not redo, [listing fields by platform](../../list/nate/listing-fields-by-platform.md) (fields per site), [fields by kind](../../../spec/determinations/fields-by-kind.md) (the field registry and fill ladder), [capture shots](../../../spec/determinations/capture-shots.md#default-plans-by-kind) (which frames each kind takes) and [measure](../../../spec/features/measure.md). Grailed and OfferUp are future sites and are not covered here; their notes are in [platforms](../../list/ben/platforms/grailed.md).

**Draft from memory, and what changed.**

| Draft | Found |
|---|---|
| eBay's category tree and item specifics need a seller login | An application token is enough for the whole tree, every category's aspects and the condition policies. Only refurbished conditions need a user token. *observed* E3, E4 |
| eBay size is free text | Since 2026-08-26 eBay checks Size on clothing and shoes against its supported values and can hide a listing that fails. The API can still report the aspect as free text. *observed* E10 |
| A US Depop seller can set a shipping price | "From October 28, 2026, 'Other' is no longer available for new listings." New US listings use Depop Shipping (USPS, buyer pays), so a parcel size is now part of the item record. *observed* D6 |
| Poshmark's condition values are not published | Four values with a one-line definition each are on Poshmark's own browse pages. *observed* P1 |
| Poshmark's Home department takes furniture | Home has 13 categories and none is furniture. *observed* P5 |
| The colour lists differ a lot | Poshmark's 15 colours are all inside Depop's 19. Depop adds burgundy, navy, khaki and multi. *observed* D2, P1 |
| Meta's partner Item API is a US posting route | Its country field lists 30 European countries and no other. *observed* F1 |

## 0. Short answer

1. **Kind first, because it picks everything after it**: the shots, the field set, the measurements and the condition scale (*inferred* from the registry in fields by kind).
2. **Then the label and the product match.** One tag or model plate fills brand, size, material and codes, and a confirmed product fills most of what is left by lookup (*inferred*, same source).
3. **Then department and category per site.** Category is the switch that decides which attributes each site asks. Department (men's, women's, kids) is needed by four of the five sites and a photo often cannot settle it (*inferred* from sections 1.2 to 1.5).
4. **Then the attributes that category asks**, each mapped to the site's own list: one colour or two, a size from that site's chart, a brand from that site's list.
5. **Then measurements**, which no site takes as a required field for clothes but every site's own advice asks for in the text (*observed* E10, M5, D7).
6. **Then condition, flaws, what is included and whether it works.** The camera proposes flaws; the grade, function and what is in the box are the person's (*asserted*, [capture spec](../../../spec/features/capture.md#follow-up-inputs-by-type)).
7. **Then the package**: weight is typed or looked up, never seen; box size comes from the measurements (*asserted*, [measure](../../../spec/features/measure.md#how-measurements-feed-the-rest)).
8. **A person confirms before anything posts.**

## 1. Per site: the category tree and the attributes asked

### 1.1 Trees at a glance

| Site | Top level | Depth | How to pull the whole tree | Mark |
|---|---|---|---|---|
| eBay (US) | Root id 0, then level 1 nodes such as Collectibles (1), Cell Phones & Accessories (15032), Gift Cards & Coupons (172008). The shopper page groups them into 18 headings (Electronics, Collectibles & Art, Home & Garden, Clothing, Shoes & Accessories, Toys & Hobbies, Sporting Goods, Books, Movies & Music, Health & Beauty, Business & Industrial, Jewelry & Watches, Baby Essentials, Pet Supplies, eBay Motors and five more) | Varies by branch. Examples: Cell Phones & Smartphones (9355) sits at level 2; Other Coca-Cola Ads (38) is a leaf at level 5. A listing must sit in a leaf | `GET /commerce/taxonomy/v1/category_tree/0` with an application token (tree id 0, version 117 in eBay's example). `getCategorySuggestions?q=` returns the best leaves for a phrase. `fetch_item_aspects` returns every leaf's aspects in one gzipped file ("over 100 MB, compressed"). `categoryTreeVersion` says when to refresh | *observed* E1, E2, E3, E4, E5. A count of categories and a maximum depth: not found |
| Depop | 4 departments: `womenswear`, `menswear`, `kidswear`, `everything-else` | 3: department, group, product type. A listing sends department and product type; the group is for display | `https://api.depop.com/api/v3/attributes/` with header `User-agent: Partner`. Keys: `department`, `group`, `generic_attributes`, `category_size_mapping`, `size_sets`, `brand`. Depop says it has bot protection, "so you may need to download the data through a browser". It needs no sign-in | *observed* D1. The endpoint refused my fetch (D9), so the list of product types is not in this note |
| Poshmark | 6 departments: Women, Men, Kids, Home, Pets, Electronics | 3: department, category, subcategory. Nothing sits under a subcategory | No API. The public browse pages show it: `poshmark.com/category/Women`, `/category/Women-Tops`, one page per category | *observed* P1 to P7 |
| Mercari | Level 1 such as Women (id 1) | 3: example Women (1), Women's Handbags (21), Shoulder Bags (217) | No API for sellers. The tree is at `mercari.com/us/browse-categories/`, drawn by script, so a plain fetch returns nothing. A scraper listing says "3,183+ categories" | Example and count *asserted* (a third party, M7). Level 1 list: not reached |
| Facebook Marketplace | The seller form's list (Home and Garden, Clothing and Accessories, Electronics, Family, Hobbies, Entertainment, Classifieds) | Not confirmed | The seller form has no public source. Meta's catalog side publishes a Facebook product category list as `facebook.com/products/categories/en_US.csv` and accepts a Google product category | Form list *asserted* ([Ben's note](../../list/ben/platforms/facebook-marketplace.md)); catalog list *observed* to exist F1, F2, file not opened (robots) |

### 1.2 eBay

How it works: every leaf category has its own aspect list. Each aspect carries `aspectRequired`, a usage (recommended or optional), a mode (free text or pick from a list), a cardinality (one value or several, "Up to 30 values" when several) and its allowed values, and a value can depend on another aspect (*observed* E1, E3). The seller form labels them Required, Required Soon, Recommended and Additional, and a listing "will only appear in those filtered search results if you've added the matching item specific" (*observed* E6). So the list for an item is read per leaf at listing time, never hard-coded.

| Kind | Leaf examples | Asked (R required, r recommended) | One or many | Values | Mark |
|---|---|---|---|---|---|
| Clothing | Men's T-Shirts (15687), Women's Dresses (63861), Men's Pants (57989) | R Brand, Size Type, Size, Style (since 2011); Color added 2019; then per leaf: Dress Length, Skirt Length, Sleeve Length, Inseam. Department and material names are in the live list | Size Type and Size are a pair, one each. Others per the leaf | Size must be a value from the leaf's list or the form's dropdown; Size values depend on Size Type; EU Size and UK Size are extra fields that the check ignores | *observed* E8, E7a, E10. Today's exact required set per leaf: pull it |
| Shoes | Men's Athletic Shoes (15709), Women's Boots (53557), kids' shoes | Brand, size by region (US Shoe Size), Color; per leaf Style, Upper Material, Heel Height | one each | as clothing | *observed* E7a, E10 |
| Bags | Women's Bags & Handbags | Brand, colour, material, style from the live list | per leaf | per leaf | Names *asserted* (memory); eBay's handbag page names none E15 |
| Electronics | Cell Phones & Smartphones (9355) | R Brand, Model, Storage Capacity, Color, plus Condition. r Network, Lock Status, Screen Size, Operating System, Camera Resolution, Processor, Connectivity, RAM, SIM Card Slot, Contract, Features. Other leaves add their own (TVs: Display Technology, Maximum Resolution; lenses: Focal Length, Maximum Aperture; video games: Game Name) | Brand is one value | Brand is free text in 9355 | *observed* E11, E7c, E9 |
| Furniture | Sofas (38208), Tables (38204), Dressers (114397) | Brand, Type, Material, Color; Item Height, Item Length, Item Width; Number of Drawers or Shelves where it applies | per leaf | per leaf | *observed* E7b (2019 list) |
| Home | Lamps (112581), Vases (101415), Mirrors (20580) | Brand, Type; Material on a few | per leaf | per leaf | *observed* E7b |
| Collectibles | Trading card singles; antiques; coins; comics | Cards: graded needs Grader and Grade, with the certification number recommended; ungraded needs a card condition of Near Mint or Better, Excellent, Very Good or Poor. Antiques: Time Period. Coins: Circulated/Uncirculated, Certification. Comics and non-sport cards: Character, Franchise | one each | fixed lists for card condition and graders | *observed* E12, E7d |

- **Brand** is an aspect. In the one category eBay shows in full (9355) it is required, free text, one value (*observed* E9). Whether a category's Brand is free text or pick-only, and how long its suggested list is, comes from that category's aspect call. "Unbranded" as the value for no brand is *asserted* (memory).
- **Product codes** (UPC, EAN, ISBN, MPN, ePID) fill title, aspects and a stock image from eBay's catalog when they match (*asserted*, Nate's reading of the Inventory spec).
- **Condition** is not an aspect. Its allowed values come per category from `getItemConditionPolicies` (*observed* E4). The names are in section 3.2.

### 1.3 Depop

| Attribute | Required | One or many | Values, or where the list lives | Mark |
|---|---|---|---|---|
| `department` | yes | one | womenswear, menswear, kidswear, everything-else | *observed* D2 |
| `product_type` | yes | one | From the attributes endpoint. Seen in Depop's examples: `tshirts`, `jeans`, `suits`, `swimsuit-one-piece` | *observed* D1, D3. Full list: not reached |
| `brand_name` | yes | one | Matched against Depop's brand list. No brand is `unbranded`, shown as "Other". "If no match is found, it defaults to 'unbranded'", silently | *observed* D2. List size: not reached |
| `size_set_id` + `size_id` | when the product type has a size set | one | A size set per department and product type, split by region (US, GB, EU keyed as IT). A size id means something only inside its set. Example: menswear suits, set 93, id 4 is M (UK). Accessories have no sizes | *observed* D1 |
| `condition` | yes | one | brand_new, used_like_new, used_excellent, used_good, used_fair | *observed* D2. Depop's wording for each: not found |
| `colour` | no | up to 2 | black, grey, white, brown, tan, cream, yellow, red, burgundy, orange, pink, purple, blue, navy, green, khaki, multi, silver, gold | *observed* D2 |
| `style` | no | up to 3 | 32 values (streetwear, sportswear, goth, retro, boho, western, y2_k, gorpcore and others) | *observed* D2 |
| `age` | no | 1 | modern, y2k, 90s, 80s, 70s, 60s, 50s, antique | *observed* D2 |
| `source` | no | up to 2 | vintage, preloved, reworked, custom, handmade, deadstock, designer, repaired | *observed* D2 |
| `attributes` | per product type | each has `max_selection` | Each product type lists its attribute ids (material, body-fit, occasion, sleeve-length, dress-type) and each attribute says `is_mandatory` | *observed* D1, D3. Which are mandatory per type: not reached |
| Shipping | yes | one | New US listings: Depop Shipping only, with a parcel size. The API field is `depop_shipping` with `parcel_size_id` (example "SMALL") | *observed* D6, D2. Parcel size names, weights and prices: not found |

By kind: clothing and shoes go under one of the three wear departments and need a size. Bags and accessories need no size. Furniture, home, electronics and collectibles go under `everything-else`, whose product types I could not read. Depop restricts electronics ([Ben's note](../../list/ben/platforms/depop.md), *asserted* here).

### 1.4 Poshmark

Everything here is *observed* on Poshmark's public pages (P1 to P7) unless marked.

| Attribute | Required | One or many | Values | Mark |
|---|---|---|---|---|
| Department | yes | one | Women, Men, Kids, Home, Pets, Electronics | P1 |
| Category | yes | one | Women has 20 (Accessories, Bags, Dresses, Jackets & Coats, Jeans, Jewelry, Pants & Jumpsuits, Shoes, Shorts, Skirts, Sweaters, Swim, Tops and others). Men 15. Kids 13. Home 13 (Accents, Art, Bath, Bedding, Design, Dining, Games, Holiday, Kitchen, Office, Party Supplies, Storage & Organization, Wall Decor). Electronics 12 (Cell Phones & Accessories, Computers, Cameras, Headphones, Video Games & Consoles, Media and others) | P1 to P6 |
| Subcategory | recommended | one | Women > Tops has 12 (Blouses, Bodysuits, Button Down Shirts, Camisoles, Crop Tops, Jerseys, Muscle Tees, Sweatshirts & Hoodies, Tank Tops, Tees - Long Sleeve, Tees - Short Sleeve, Tunics). Women > Shoes 17. Men > Jeans 6 | P7; "recommended" from P9 |
| Size | yes | one | A chart per category, in groups. Women's tops: Standard (00 to 12, XXS to XL), Plus, Petite, Juniors, Maternity. Women's shoes: 5 to 13 in half sizes. Men's jeans: waist 28 to 41, Big & Tall 36 to 60. Electronics show "One Size". A custom size can be typed but is left out of the My Size filter | P7; custom size *asserted* (Nate's note) |
| Brand | no | one | Picked from Poshmark's list or typed. The Women filter alone lists about 290 names, with None, Handmade, Vintage and Source Unknown among them | Filter *observed* P1; "or typed" *asserted* (Nate's note). The seller-side list and its size: not reached |
| Colour | no | up to 2 ("the two most prevalent colors") | 15: Red, Pink, Orange, Yellow, Green, Blue, Purple, Gold, Silver, Black, Gray, White, Cream, Brown, Tan | P1, P9 |
| Condition | reported as required | one | New With Tags, Like New, Good, Fair | P1; required *asserted* (a seller quoted in P8) |
| Style tags | no | several | "a pre-populated list or create your own". No count given | P10. Ben's "3" stays *asserted* |
| Original price | asked ("if you know it") | one | whole dollars | P9; whole dollars *asserted* |

By kind: clothing, shoes and bags fit fully. Electronics has its own department. Home takes decor and kitchen, and has no furniture category. Collectibles have no department; the nearest are Kids > Toys, Home > Games and Electronics > Media. Trading cards appear in none of the lists I read (Pets not read).

### 1.5 Mercari

| Attribute | Required | One or many | Values | Mark |
|---|---|---|---|---|
| Category | yes | one | three levels | *asserted* M7 |
| Brand | no; "improves visibility" | one | Picked from a list. The public page "All brands available on Mercari" runs A to Z; the text I got back held roughly 2,000 names and may be cut short | *observed* M1, M6 |
| Condition | yes | one | New, Like New, Good, Fair, Poor, with separate wording for clothing, shoes, electronics and furniture | *observed* M2 |
| Size | for clothes and shoes | not confirmed | not found | *asserted* ([Ben's note](../../list/ben/platforms/mercari.md)) |
| Colour | optional | not confirmed | not found | *asserted* (same note) |
| Hashtags | no | 3 | free words | *observed* M4, M5 (Mercari's blog, 2022 and undated). The live form's count: not confirmed |
| Weight | yes for a Mercari label | one | Label steps of 0.25, 0.5, 0.75 lb, then whole pounds | *observed* M1, M3 |
| Box size | for the Best rate | one | length, width, height | *observed* M3 |

By kind: Mercari grades each kind in its own words. Electronics are graded on battery health: 98% or more for New and Like New, 80% or more for Good, 50 to 79% for Fair, under 50% for Poor. Shoes are New only with the original box. Furniture is "unused, unbuilt" for New, and "Motorized items, furniture, bicycles, and major appliances" get no national shipping label (*observed* M2, M3).

### 1.6 Facebook Marketplace

The seller form is not public. Meta's category file refused automated reading today (*observed* F6), and the earlier run found the same for `facebook.com/help` (*asserted*, [facebook-marketplace.md](../../list/ben/platforms/facebook-marketplace.md)). What a builder can rely on today:

| Attribute | Seller form | Meta's documented models | Mark |
|---|---|---|---|
| Category | required, one | Catalog: `fb_product_category` optional, a Google product category recommended, "the most specific category possible" | Form *asserted*; catalog *observed* F2 |
| Condition | New; Used - Like New; Used - Good; Used - Fair | Partner feed `condition`: new, refurbished, used, used_like_new, used_good, used_fair, cpo, open_box_new, with a finer `partner_product_condition` list (new_with_tags, new_with_box, graded, ungraded, for_parts_or_not_working and 27 more) | Form *asserted*; feed *observed* F1 |
| Brand | optional, shown by category | Feed: required string, "N/A" if none | Form *asserted*; feed *observed* F1 |
| Size, colour, material | optional, shown by category | Catalog, clothing: `material`, `size`, `pattern` recommended, then `inseam`, `sleeve_length`, `chest_size`, `size_system`, `shoe_width`, `heel_height`. Furniture: `height`, `length`, `width`, `material`, `finish`, `decor_style`, then `number_of_seats`, `seat_height`, `is_assembly_required`. Phones: `color`, `brand`, `model`, `operating_system`, `storage_capacity`, screen size. "The recommended category-specific fields are all optional" | Form *asserted*; catalog *observed* F2, F3 |
| Tags | optional, up to 20 | none | *asserted* |

The partner Item API is not a route for US listings: `partner_item_country` allows 30 European country codes and nothing else (*observed* F1). Its attribute keys (about 100, among them `size`, `us_shoe_size`, `waist_size`, `inseam`, `sleeve_length`, `material`, `color`, `storage_capacity`, `screen_size`, `item_height`, `item_length`, `item_width`, `item_weight`, `year`, `set`, `character`) are still a fair guide to what the form shows by category (*inferred*).

## 2. Limits per site

| Limit | eBay | Facebook | Depop | Poshmark | Mercari |
|---|---|---|---|---|---|
| Title | 80 characters (*asserted*, [Ben's eBay note](../../list/ben/platforms/ebay.md)) | 99, 100 or 150, sources disagree (*asserted*) | no title; the first line of the description stands in (*asserted*, Nate) | 80 (*asserted*) | 80: "summarize the item in 80 characters" (*observed* M4, 2022) |
| Description | HTML; mobile summary 800 (*asserted*, Nate) | not confirmed | 1,000 characters, no email addresses (*observed* D2) | 1,500 (*asserted*) | 1,000 (*observed* M4, 2022) |
| Hashtags or tags | none | tags field, up to 20 (*asserted*) | up to 5 in the description, "including up to two brand hashtags" (*observed* D2, D4) | none found | 3 (*observed* M4, M5) |
| Photos | 1 to 24 (*observed* E19) | up to 10 (*asserted*) | 1 to 8 by API (*observed* D2); the app help still says "up to four photos and one video" (*observed* D4, undated) | up to 16 (*observed* P11) | up to 12 (*observed* M1) |
| Photo file | at least 500 x 500 px, about 1600 x 1600 advised, 12 MB, JPEG PNG GIF TIFF BMP WEBP HEIC AVIF; 1:1 or 16:9 "look best" (*observed* E19) | not confirmed for the form. Partner feed: JPEG or PNG, at least 500 x 500, up to 8 MB (*observed* F1) | JPEG; served at 1280 x 1280 (*asserted*, Ben's Depop note) | cover shown 3:4 since 2026-03-25 (*asserted*, Nate) | not stated on the page (*observed* M1) |
| Video | 1; up to 150 MB; "one minute or less" advised; MP4 or MOV; uploads up to 1080p; none on listings with variations; shown after the first photo; review usually within 48 hours (*observed* E21, E22) | not confirmed | 1 in the app (*observed* D4); no field in the API (*asserted*) | 1 (*observed* P9, P10); length not stated | not on the help page (*observed* M1) |
| Price | from $0.99 fixed price (*asserted*) | whole dollars, 0 is free (*asserted*) | at least 1.00, no maximum stated (*observed* D2) | whole dollars, $3 minimum (*asserted*) | $1 to $2,000; to $5,000 for Authenticate-eligible designer shoes, handbags and wallets (*observed* M1) |
| Shipping and size inputs | package weight and size for calculated shipping (*asserted*, Nate) | pickup, shipping or both; label weight rule not found | a parcel size under Depop Shipping (*observed* D6) | none; one label to 5 lb, 15 lb cap (*asserted*, Ben's Poshmark note) | weight first, then box size; labels to 100 lb, longest side 30 in, girth 130 in; Best rate inside 1 cubic foot and 22 in (*observed* M3, page dated 10/23/2026). The older listing guide still says 50 lb and 34 in (*observed* M1) |
| Quantity | 1 or more (*asserted*) | single or in stock (*asserted*) | at least 1 (*observed* D2) | optional, with sizes (*observed* P9) | 1 per listing (*asserted* M8) |

**What each site says makes a good photo.**

| Site | Its own words or advice | Mark |
|---|---|---|
| eBay | Main photo shows the whole item face-on. Neutral backdrop, white "generally best", darker for shiny items. No flash. A coin or ruler when size is unclear. Close-ups of every flaw. No text, logos or watermarks. No stock photo on a used item. Clothing: "Show every angle", front, back, labels, close-ups; light background for dark clothes and dark for light. Sneakers: size tag, both outer and inner sides, top, sole, front, back, box. Cards: front, back, blemishes, grading label | *observed* E19, E20, E13, E14, E12. E19 says to avoid overhead light and E20 says to use it; both say no flash |
| Facebook | Nothing from Meta reached. Meta AI describes whatever is in the frame, so the frame should hold only the item | *asserted* ([Ben's note](../../list/ben/platforms/facebook-marketplace.md)) |
| Depop | Natural light near a window. A model shot, a flat lay and two close-ups; photograph the tags on branded items. Stock photos are removed | *observed* D7, D8 (undated, written when four photos was the cap) |
| Poshmark | Centre the item, fill the frame with a small margin, bright even light, clean background; the cover is cropped to 3:4 | *asserted* (Nate's and Ben's notes, Poshmark's 2026-03-25 post) |
| Mercari | "Use natural lighting and a plain background", every side, every flaw; the first photo is what shoppers see. For clothes: front, back, close-ups, the size tag, and a worn shot | *observed* M1, M5 |

## 3. The union: one item record that fills every site

### 3.1 The mapping

Field names are from the [field registry](../../../spec/determinations/fields-by-kind.md#2-the-field-registry-is-the-requirement-row). "Filled by": **seen** (in a frame), **label** (read from a tag, plate or screen), **lookup** (from the matched product), **measured**, **person**. The table is *inferred* from sections 1 and 2; each cell's evidence is there.

| Our field | Filled by | eBay | Facebook | Depop | Poshmark | Mercari |
|---|---|---|---|---|---|---|
| `kind` and site category | seen, lookup | leaf category id | category | `product_type` | category, subcategory | 3 levels |
| `department` (new, see 3.5) | label, lookup, person | Department aspect | inside the category name | `department` | department | level 1 |
| `brand` | label, lookup | Brand aspect, free text | optional text | `brand_name`, matched to a list or "unbranded" | list or typed, optional | list, optional |
| `model`, `gtin`, `mpn` | label, lookup | Model, MPN, UPC, ePID | description | description | title | title |
| `size_label`, `size_system` | label | Size Type + Size from the leaf's values | optional | `size_set_id` + `size_id` | the category's chart | size field |
| `measurements` | measured | optional aspects (Inseam, Sleeve Length, Item Height, Width, Length) and the description | description | description | description | description |
| `colour` | seen | Color aspect | optional | up to 2 of 19 | up to 2 of 15 | optional |
| `material` | label, seen | Material and its variants | optional | per-type attribute | description | description |
| `style`, `era` | seen, lookup | Style aspect; Time Period (antiques) | tags | `style` up to 3, `age` 1, `source` up to 2 | style tags | hashtags |
| kind attributes | label, lookup, seen | the leaf's aspects | category fields | `attributes` per type | none | none |
| `condition` | seen, then person | condition id per category | 4 values | 5 values | 4 values | 5 values |
| `flaw.<n>` | seen, person confirms | condition description and photos | description | description | description | description |
| `completeness`, `function` | person | condition, aspects, description | description | description | description | condition wording |
| `package` | measured, person (weight) | weight and size | weight if shipped | parcel size | none | weight, then size |
| `retail_price` | lookup, person | optional | none | none | original price | none |
| title | built | 80 | yes | first line | 80 | 80 |
| description | built | yes | yes | 1,000, with 5 hashtags | yes | 1,000, with 3 hashtags |
| photos | seen | up to 24 | up to 10 | up to 8 | up to 16 | up to 12 |

### 3.2 Condition scales

Each site's words decide its grade ([card 14](../../../spec/determinations/seeing-the-item.md#14-condition-on-each-markets-own-scale)). The site values are *observed* (E16, E17, E18, D2, P1, M2) except Facebook's (*asserted*). The alignment across a row is *inferred* and is the part a person should check.

| Our reading | eBay clothing, shoes | eBay electronics, home | Facebook | Depop | Poshmark | Mercari |
|---|---|---|---|---|---|---|
| Unused, tags or box | New with tags (1000); shoes: New with box | New (1000) | New | brand_new | New With Tags | New |
| Unused, no tags or box | New without tags (1500); shoes: New without box | Open box (1500) | Used - Like New | used_like_new | Like New ("new without tags or like new") | Like New |
| Unused with a defect | New with imperfections (1750) | none | none | none | none | none |
| Worn, little to no wear | Pre-owned - Excellent (2990) | Used (3000) | Used - Like New | used_excellent | Like New | Like New |
| Gently used, light wear | Pre-owned - Good (3000) | Used (3000) | Used - Good | used_good | Good ("gently used with minimal signs of wear") | Good |
| Visible flaws | Pre-owned - Fair (3010) | Used (3000) | Used - Fair | used_fair | Fair ("clearly used with visible wear") | Fair |
| Heavy wear or broken | Pre-owned - Fair (3010) | For parts or not working (7000) | Used - Fair | used_fair | Fair | Poor |

Three things do not fit one scale and need their own inputs: trading cards (Graded or Ungraded, then grader and grade, or one of four card conditions, E12), books and media (Brand new, Like new, Very good, Good, Acceptable, E16) and phones on Mercari (a battery health percent, M2).

### 3.3 Size systems

| Site | What it stores | Where values come from | Mark |
|---|---|---|---|
| eBay | Size Type plus Size; EU Size and UK Size beside them | The leaf's aspect values or the form's dropdown. "Medium" becomes "M"; a size eBay cannot match can hide the listing. The tagged size and measurements go in the title, description or optional specifics | *observed* E10 |
| Depop | a size id inside a size set, per region | attributes endpoint | *observed* D1 |
| Poshmark | one value from the category's chart, in a group (Standard, Plus, Petite, Juniors, Maternity, Big & Tall) | the public category page; men's jeans are sized by waist number | *observed* P7 |
| Mercari | a size field | not found | *asserted* |
| Facebook | optional text | not confirmed | *asserted* |

So the record keeps the tag's size as read, its system, and the department, and each adapter converts ([card 7](../../../spec/determinations/seeing-the-item.md#7-size)). Our measurements never set the size; they sit beside it (*asserted*, card 7).

### 3.4 Colour, brand and tags

| Field | eBay | Facebook | Depop | Poshmark | Mercari |
|---|---|---|---|---|---|
| Colour: how many | per leaf (the aspect's cardinality) | not confirmed | up to 2 | up to 2 | not confirmed |
| Colour: list | per leaf | not confirmed | 19 | 15, all inside Depop's 19 | not found |
| Brand: list or text | free text with suggestions in the category eBay shows (9355) | text | fixed list; no match becomes "unbranded" without an error | list or typed | list, about 2,000 names in what I could read |
| Tags | none | up to 20 (*asserted*) | 5 hashtags, at most 2 of them brands | style tags | 3 hashtags |

The record therefore holds colour as the name we saw plus up to two site colours, with the first one the main colour (Poshmark: "list the main color first", P9). A Depop brand must be checked against Depop's list before posting, because a miss is silent (*inferred* from D2).

### 3.5 What this adds to the registry

- `department` as a root field for wearables: four sites need it (eBay as an aspect, the others as the top of the tree), and a unisex tee has none on its tag (*inferred*).
- `package.parcel_size` for Depop, now that a US listing cannot set its own shipping price (*inferred* from D6).
- `colour` as an ordered list of up to two, with a per-site mapped value (*inferred* from D2, P9).

## 4. The decision tree, from the first photo to a postable listing

*Agent proposal* throughout. The order is the order in which each answer narrows the next question. The shots that answer them are still taken up front in the kind's process ([capture spec](../../../spec/features/capture.md#the-process-for-each-type)), so the person sees one short flow and the questions below resolve behind it. The stage name is the label on the camera screen; "still blank" is what the screen shows as open; the instruction is the one line it gives, and it shows only when that step needs the person.

| # | Stage | What is learned | Answered by | Still blank | The one instruction |
|---|---|---|---|---|---|
| 1 | Kind | Which of the 13 families it is | camera suggests, person taps | everything | Tap what it is |
| 2 | Photos | Colour, shape, visible flaws, the frames for the listing | camera (seen) | brand, size, condition | Clothes: Lay it flat. Rigid items: Walk around it |
| 3 | Label | Brand, size as printed, material, model, codes | camera (label) | size, brand | Closer on the tag |
| 4 | Match | Which product it is, and from it model, colour name, retail price, specs | lookup; person picks when 2 to 4 remain | model | Pick yours |
| 5 | Category | Department, then each site's category | lookup and the category map; person when the label and match give no department | department | Pick a department |
| 6 | Details | The attributes that category asks and nothing has filled: sleeve length, storage, carrier lock, number of drawers | lookup, camera; else one input each, at most 3 | the named fields | The field's name over its choices |
| 7 | Size | The tag size mapped to each site's list | label, then rule; person when no tag | size | Show the size tag |
| 8 | Measure | The kind's measurements (table below) | measure; person drags one point when two paths disagree | the primary lines | Clothes: Smooth it flat. If no scale: Lay a card beside it |
| 9 | Condition | Each flaw, the grade, whether it works | camera proposes flaws; person confirms, grades and states function | condition | Check each flaw |
| 10 | Included | Box, tags, charger, papers, all parts | camera when seen in a frame; else person | what comes with it | Tick what comes with it |
| 11 | Package | Weight and box | measured size plus padding; weight from the product or typed | weight | Type the weight |
| 12 | Review | Every value, with its source word | person | nothing | Looks right |

Rules that keep it short (*agent proposal*, each resting on a spec line):
- A step with nothing blank does not appear. A tee with a readable tag skips 5 to 7 unseen ([fields by kind](../../../spec/determinations/fields-by-kind.md#3-the-fill-ladder): rungs 1 to 3 cost the person nothing).
- At most 3 typed or tapped inputs per item across steps 5 to 11 ([capture spec](../../../spec/features/capture.md#follow-up-inputs-by-type)).
- A site whose required field stays blank does not post, and the other sites go ahead (fields by kind, F4).
- Function, authenticity and what is in the box are never preselected from a photo ([identify](../../../spec/features/identify.md#what-it-never-claims)).

### 4.1 What each kind adds, and who can answer it

| Kind | Camera answers (seen or label) | Measured, and how | Only the person |
|---|---|---|---|
| Clothing | colour, pattern, brand, tag size, fibre, style code, flaws on front and back | Pit to pit and length, or waist and inseam, from the flat front still: floor plane or LiDAR for scale, the mask and points for the ends, the brand's size chart as the cross-check, a card only when those disagree | department when the tag is silent; smell, smoke, pets; wear the photos missed |
| Shoes | brand, model code and size from the tongue label, sole wear | Outsole length and width from the scan; the tag size stands when depth is weak | box included; worn or unworn |
| Bags | brand, date code tab, hardware colour, corner wear | Width, height, depth from the scan; strap drop by two taps | dust bag, card; nothing here says authentic |
| Electronics | model, storage and battery health from the About screen; screen and body wear | Screen size from the product, body size from one LiDAR frame | works, erased and signed out, carrier lock when no lookup, charger included |
| Furniture | material, colour, seat count, named defects | Width, depth, height and seat height from the walk-around scan; two taps on the floor plane without LiDAR | pickup or delivery, assembly, smoke and pets |
| Home | maker mark, material, defects | Length, width, height from the scan; a card under 10 cm | works, for powered items |
| Collectibles | set, number, year, grader, grade and cert from the slab label; corner and edge wear on a raw card | Centring from the borders of the front still | the card condition word on a raw card; sealed or complete on a set |

How measuring runs is unchanged from [measure](../../../spec/features/measure.md#what-it-reads-and-writes) and [the measuring node](capture-coaching-and-frames.md#7-measuring-inside-the-flow-item-4): the front flat still doubles as the measuring still, lines draw on the live picture while the gates hold, the backend's checked values replace the phone's, and a value is stated as measured only when two scale paths agree or the person drags or types. What this note adds is where each number lands:

| Measurement | Lands in |
|---|---|
| Pit to pit, length, shoulder, sleeve | Every site's description. eBay's Sleeve Length where the leaf has it (E7a). eBay's own advice: put "the tagged or brand size, fit notes, and measurements in the title, description, photos, or optional item specifics" (E10) |
| Waist, inseam | eBay Inseam (E7a); Poshmark men's jeans size, which is the waist number (P7), as a check on the tag; every description |
| Shoe length | Description only; the size field takes the tag |
| Furniture and home sizes | eBay Item Height, Item Length, Item Width (E7b); Facebook's description, where a local buyer needs it most |
| Box size and weight | Mercari weight then size (M1, M3); eBay package fields; Depop parcel size; a check against Poshmark's 5 lb label |

## 5. Not public: what only a real listing form can tell us

Two groups. The first needs no account, only something this session did not have. The second needs Ben signed in.

**No account needed (approve the keys or the browser, not an account).**
1. **eBay, with our own developer keys.** One application token, then: `getCategoryTree(0)` once; `getCategorySuggestions` for each of our kinds; `getItemAspectsForCategory` for the chosen leaves, or `fetchItemAspects(0)` for all of them; `getItemConditionPolicies`. This yields the exact required and recommended aspects, one or many, the value lists and the brand mode per leaf (E3, E4).
2. **Depop's attributes endpoint, from a real browser.** Open `https://api.depop.com/api/v3/attributes/` and save the JSON. This yields every product type, the attributes each one takes and which are mandatory, every size set, and the brand list (D1).
3. **Mercari's category tree, from a real browser.** Open `mercari.com/us/browse-categories/` and save the rendered list.

**Needs Ben's account.** Each walk is read-only: open the sell form, fill nothing that is not needed to reveal the next field, never press the final post button, discard the draft at the end, send no message, change no setting. For each of seven test kinds (a tee, sneakers, a handbag, a phone, a sofa, a lamp, a trading card) record every field's label, whether it is marked required, its type, its option list and any counter. Ben's notes say eBay's User Agreement leaves the API as our only allowed route and Mercari's conduct page bans automation ([eBay](../../list/ben/platforms/ebay.md), [Mercari](../../list/ben/platforms/mercari.md), *asserted* here), so the safest form of this is Ben clicking while the session reads the page.

| Site | What only the form shows | Steps in Ben's account |
|---|---|---|
| eBay | The Size dropdown per Size Type, which eBay calls "the source of truth" over the API (E10); the condition names shown per category; the title counter; the package fields | Sell, List an item, type the kind, accept the suggested category, read each section top to bottom, open the Size Type and Size dropdowns, open Condition, then leave without saving |
| Facebook Marketplace | The whole form: category list and depth, the fields each category reveals (brand, size, colour, material), which are required, condition options, title and description counters, photo and video slots, tag count, SKU, delivery and weight inputs | Marketplace, Create new listing, Item for sale. Add one photo and note what Meta AI fills. Pick each test category in turn and record the fields that appear. Open delivery method. Close and discard |
| Depop | Photo and video slots in the app against the website (4 or 8); video length; parcel size names, weights and prices under Depop Shipping; the wording of the five conditions; whether a brand off the list can be typed; the group level labels | Sell, add one photo, open each picker (category, brand, condition, size, colour, style, source, age), open shipping and read every parcel size, then delete the draft |
| Poshmark | Title and description counters; video length; whether Condition and Original price are required; the style tag cap; the seller-side brand list and custom brand; the size chart and custom size per category; the minimum price | Sell, add one photo, pick each test department, category and subcategory, open Size, Brand, Color, Style Tags and Condition, type into Title and Description to find the counters, then discard |
| Mercari | Size lists per category; the colour list and whether more than one can be picked; the hashtag count today; title and description counters; a brand off the list; the weight steps and box fields; video | Sell, add one photo, note what Mercari prefills, pick each test category through all three levels, open Brand, Condition, Color and Size, type into Title, Description and Hashtags to find the counters, open Shipping, then delete the draft |

Proposed output of each walk: one JSON file per site and kind (field, required, type, options, limit, date read), filed beside the platform notes, which then replaces the *asserted* cells in sections 1 to 3.

## 6. Where this confirms, extends or contradicts existing notes

- **Extends [listing fields](../../list/nate/listing-fields-by-platform.md)**: Poshmark's condition values and wording, its colour list, its category lists and size charts; eBay's condition names by category group, its phone and furniture specifics, its video limits; Mercari's label limits and brand directory; Depop's brand matching rule.
- **Contradicts it on Depop shipping**: the note lists `national_shipping_cost` or `depop_shipping`; for a new US listing only the second is left (D6). Whether the partner API still accepts the first for US sellers is not known.
- **Changes [card 7, size](../../../spec/determinations/seeing-the-item.md#7-size)**: eBay now enforces its size values, so "convert to each site's size system" must use eBay's returned list, and a size it cannot map blocks eBay alone.
- **Unblocks part of [card 14](../../../spec/determinations/seeing-the-item.md#14-condition-on-each-markets-own-scale)**: Poshmark's and Mercari's grade wording is now on file (P1, M2). Depop's is still missing.
- **Confirms [Ben's Poshmark note](../../list/ben/platforms/poshmark.md)**: no furniture; six departments.
- **Confirms the video figures in [Ben's eBay note](../../list/ben/platforms/ebay.md)** that were from memory: one video, 150 MB, MP4 or MOV.
- **Narrows the Facebook routes**: the partner Item API covers European catalogs only (F1), so the seller form is the only US route to describe.

## Limits

- **Read through a summarizer.** Every *observed* line is the fetch tool's reading of the page, not the raw HTML. Lists (Poshmark sizes, Depop colours, eBay specifics) should be re-read from the page before they are coded.
- **Refused or empty**: `api.depop.com/api/v3/attributes/` (client error); `partnerapi.depop.com/api-docs/openapi.yaml` (returned as binary; the Reference page was read in its place); `mercari.com/us/category/...`, `mercari.com/sitemap.xml` and two older Mercari help URLs (client error); `mercari.com/us/browse-categories/` (no category data without scripts); `facebook.com/products/categories/en_US.txt` (robots); `poshmark.com/brands` and `depop.com/category/` (client error); two Depop help articles (client error). eBay's developer reference pages are script shells, so the OpenAPI file and the static guides were used; the Inventory spec's schema section did not load, so eBay's title, subtitle, description and aspect length limits stay *asserted*.
- **Old or undated sources.** eBay's per-category specifics come from its 2019 and 2020 lists (E7), which name what each release added, not today's full required set. Mercari's 80, 1,000 and three are from a 2022 blog post. Depop's blog posts and its listing help are undated and still describe four photos.
- **Not found**: a count of eBay categories; Depop's product types, mandatory attributes, size sets, brand list, parcel sizes and condition wording; Mercari's level 1 list, size and colour lists; Poshmark's title and description limits, style tag cap and the Pets department; anything from Meta on the seller form. A narrow search does not show these do not exist.
- **Search returned titles and links only**, so no claim here rests on a search snippet.
- **Not covered**: Grailed, OfferUp, vehicles, housing, non-US sites, and pricing fields beyond what a form requires.

## Sources

All opened 2026-11-15. Job: what we take from it.

| Code | Source | Job |
|---|---|---|
| E1 | https://www.developer.ebay.com/api-docs/sell/static/metadata/sell-categories.html | mechanism: tree levels, aspect constraints, value dependencies |
| E2 | https://developer.ebay.com/api-docs/buy/buy-categories.html | evidence: tree id 0, version 117, about 20 marketplaces |
| E3 | https://developer.ebay.com/api-docs/commerce/taxonomy/openapi/3/commerce_taxonomy_v1_oas3.json | mechanism: the calls, the token, the 30-value cap, the size of the aspects file |
| E4 | https://developer.ebay.com/develop/guides/listing-metadata-guide.md | mechanism: leaf rule, suggestions, version check, condition policies |
| E5 | https://www.ebay.com/n/all-categories | evidence: the 18 shopper headings |
| E6 | https://www.ebay.com/sellercenter/listings/item-specifics | evidence: the four labels, the filter rule |
| E7 | https://www.ebay.com/sellercenter/listings/item-specifics-requirements and its files: (a) https://ir.ebaystatic.com/pictures/aw/pics/sc/listing/fashion_item_specifics.pdf (b) https://ir.ebaystatic.com/pictures/aw/pics/sc/listing/hg_item_specifics.pdf (c) https://ir.ebaystatic.com/pictures/aw/pics/sc/listing/Electronics-3-31.pdf (d) https://ir.ebaystatic.com/pictures/aw/pics/sc/listing/collectibles_media_gift_cards_item_specifics.pdf | evidence: specifics by leaf, with category ids (2019, 2020) |
| E8 | https://pages.ebay.com/sellerinformation/sellingresources/csalookup.html | evidence: Brand, Style, Size Type, Size required since 2011-07-20 |
| E9 | https://www.developer.ebay.com/cms/files/connect/all-in-for-aspects.pdf (2019-06-25) and https://developer.ebay.com/api-docs/user-guides/static/trading-user-guide/item-specifics-requirements.html | evidence: Brand in 9355 is required, free text, one value; "clothing categories typically require Brand and Color" |
| E10 | https://pages.ebay.com/listing-sizes/index_app.html (modified 2026-09-29) | evidence: the size rule and its dates |
| E11 | https://www.ebay.com/sellercenter/listings/perfect-cell-phone-listing | evidence: phone specifics |
| E12 | https://www.ebay.com/sellercenter/selling/selling-trading-cards | evidence: card grading fields and the four conditions |
| E13, E14, E15 | https://www.ebay.com/sellercenter/selling/selling-clothes, .../selling-sneakers, .../selling-luxury-bags-and-accessories | visual direction: shot lists by kind |
| E16 | https://www.ebay.com/help/selling/listings/creating-managing-listings/item-conditions-category?id=4765 | evidence: condition names by category group |
| E17 | https://www.ebay.com/sellercenter/resources/seller-updates/2025-january/new-item-conditions | evidence: the three pre-owned grades |
| E18 | https://developer.ebay.com/api-docs/sell/static/metadata/condition-id-values.html | mechanism: condition ids |
| E19, E20 | https://www.ebay.com/help/selling/listings/adding-pictures-listings?id=4148 and https://www.ebay.com/sellercenter/listings/photo-tips | evidence: photo limits and advice |
| E21, E22 | https://www.ebay.com/help/selling/listings/creating-managing-listings/add-video-to-listing?id=5272 and https://www.ebay.com/sellercenter/listings/seller-uploaded-videos | evidence: video limits |
| D1 | https://partnerapi.depop.com/api-docs/concepts/taxonomy/ | mechanism: the three levels, size sets, the attributes endpoint |
| D2 | https://partnerapi.depop.com/api-docs/reference/ | mechanism: every listing field and its limits |
| D3 | https://partnerapi.depop.com/api-docs/getting-started/your-first-listing/ | mechanism: a worked listing |
| D4, D5 | https://depophelp.zendesk.com/hc/en-gb/articles/360032716413-Listing-on-Depop and .../16523051318033-How-to-ship-US (undated) | evidence: app photo count, hashtag rule, USPS |
| D6 | https://www.valueaddedresource.net/depop-ends-independent-shipping-us-au/ (2026-11-05; quotes Depop's notice) | evidence: the shipping change |
| D7, D8 | https://blog.depop.com/articles/top-10-listing-tips and https://blog.depop.com/articles/list-like-a-pro (undated) | visual direction, old |
| D9 | https://api.depop.com/api/v3/attributes/ | refused |
| P1 to P7 | https://poshmark.com/category/Women (P1, with the colour, condition and brand filters), /Men (P2), /Kids (P3), /Home (P5), /Electronics (P6), and /Women-Tops, /Women-Shoes, /Men-Jeans (P7). P4 is not used | evidence: departments, categories, subcategories, sizes, colours, conditions |
| P8 | https://www.valueaddedresource.net/poshmark-photo-aspect-ratio-item-condition-updates/ (2025-11-14) | evidence, secondary: when the condition field appeared |
| P9 | https://blog.poshmark.com/2024/03/25/posh-tip-how-to-list-on-poshmark/ | evidence: the form's fields |
| P10 | https://blog.poshmark.com/new-listing-features-to-make-sales/ (2026-03-25) | evidence: video and style tags |
| P11 | https://poshmark.com/posh_guide/how_to_list_item | evidence: 16 photos |
| M1 | https://www.mercari.com/us/help_center/topics/listing/guides/creating-a-listing/ | evidence: photos, price range, weight first |
| M2 | https://www.mercari.com/us/help_center/article/39/ | evidence: condition wording by kind |
| M3 | https://www.mercari.com/us/help_center/article/169/ (updated 10/23/2026) | evidence: label limits |
| M4 | https://blog.mercari.com/us/6-ways-to-optimize-your-listings-for-more-mercari-sales (2022-03-31) | evidence, old: 80, 1,000, three |
| M5 | https://blog.mercari.com/us/boost-your-sales-10-top-tips-for-selling-clothes-on-mercari (undated) | visual direction: clothing shots and measurements |
| M6 | https://www.mercari.com/us/brand/ | evidence: a public brand list |
| M7 | https://apify.com/morkerr/mercari-category-url (a third-party scraper's listing) | weak pointer: three levels, ids, count |
| M8 | https://docs.nifty.ai/marketplace-guides/selling-on-mercari (a crosslister, undated) | weak pointer: one per listing |
| F1 | https://developers.facebook.com/docs/marketplace/partnerships/itemAPI/ | mechanism: partner feed fields, enums, countries |
| F2 | https://developers.facebook.com/docs/commerce-platform/catalog/categories | mechanism: the two category fields |
| F3 | https://developers.facebook.com/docs/commerce-platform/catalog/categories/cloth-access, .../home and .../electronics/ | mechanism: category fields in Meta's catalog |
| F4 | https://about.fb.com/news/2026/03/facebook-marketplace-new-meta-ai-tools-make-selling-faster-and-easier/ (2026-03-12) | evidence: Meta AI drafts the listing |
| F6 | https://www.facebook.com/products/categories/en_US.txt | refused (robots) |

**Seed log.** Loop 1 (seeds: the five sites' developer and help pages named in the existing notes). Changed: eBay needs only an application token; Depop's tree is one endpoint behind bot protection. Loop 2 (seeds: eBay's item specifics pages and their linked files, the size guidance page, the per-kind seller pages; Poshmark's public category pages). Changed: eBay enforces sizes; Poshmark's tree, sizes, colours and conditions are public. Loop 3 (seeds: Depop help and news, Mercari fee and blog pages, Meta's catalog pages). Changed: Depop ended seller-set shipping for new US listings; Meta's partner feed is Europe only. Contrary lead followed: is any of this reachable without an account? Yes for eBay, Depop and Mercari with keys or a browser; no for Facebook. Stopped when the remaining gaps were all behind a sign-in or bot protection.
