# 77: the parts of an item, for the engines lead

Updated: November 15, 2026, night Central. Owner: the engines lead. From: the capture team lead (Claude Code, Opus 5.5), queue item 8 of [packet 72](72-capture-handoff.md#3-the-queue-in-order). Status: capture's side is specified ([capture engine, the parts of one item](../../../../spec/engines/capture.md#the-parts-of-one-item), fix F17) and being built; the value of the parts is yours. Capture does not edit `app/src/engines/valuation/` or `jobs/identity/`.

Nate (2026-11-15): "for technology, a userful thing when its being captured and identified, is for the system to perhaps determine the value of its individual pieces. like a desktop computer can have the system understand the ram, of course if its a custom build, I imagine that will be a clarifying question" ([words](../../../../product/words.md#2026-11-15-nate-technology-is-valued-by-its-parts-too-and-a-custom-build-is-a-clarifying-question)).

## What a part row holds

A part is inside one item (a desktop's graphics card). It is not a `piece`: pieces are separate items sold together, and a lot comp's `lot_parts[]` stays about pieces.

After finish, each known part is an attribute on the person's item, written through capture's F4 path:

| Name | Value | Kinds |
|---|---|---|
| `part.graphics`, `part.processor`, `part.board`, `part.case` | text, trademark marks and clock speed cut ("Intel Core i7-10700", "NVIDIA GeForce RTX 3060") | desktops |
| `part.memory`, `part.storage` | a listed size in GB (enum) | desktops, laptops |
| `part.power_supply` | number, W | desktops |
| `custom_build` | bool | desktops |

Each attribute carries, like every captured attribute:
- `source`: `spec` (the published specification of the identified model), `label` (read by the parser from the system screen or a part's label), or `you_said`;
- its confidence, as the capture recorded it (F16, integration's item card fix, carries it to the read side);
- evidence `ref` `<capture_id>/<step>`, `kind` `lookup`, `label_text` or `owner`.

The list of parts per kind, their order (most price-moving first) and which are asked live in `jobs/capture/process.json` `components`. Read them there; do not copy them.

## What capture guarantees

1. A part present on the item is `known` by capture's rule: a `you_said` value, or a read or lookup at or past its `capture_min_conf.part.<name>.<way>` param. A part that is only proposed is not written.
2. For a part, what the item shows outranks the published specification: a `label` read replaces a `spec` value, so an upgraded prebuilt reports its real memory.
3. A part that was not read and is not asked is absent, never guessed. Absent is not zero.
4. Same inputs, same parts: the parser and the plan are pure, and each walk is run twice with identical output.
5. The raw screen text is never stored or logged; only these values are.

## What capture needs from identity (engines' `jobs/identity/`)

An `identify` result member may carry `kind` (for example `desktops`) and `components` (`{processor, graphics, memory, storage, ...}` from the product's published specification). Capture checks each against the kind's part rows and applies it only with `action: confirm`. Until identity sends these, a prebuilt desktop is asked the build question; nothing breaks.

## Your side (queue item 8)

Each part is a product in its own right, valued like any item with its own basis and count. The answer shows the whole, and the sum of the parts less what parting out costs (a fee and a shipment per part), and says which is higher and on what evidence. Deterministic, in parity with its twin, every number guarded. Done when, on recorded comps, a desktop whose graphics card carries most of the value is reported as worth more in parts, and one where it does not is reported as worth more whole.
