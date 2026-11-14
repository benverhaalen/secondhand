# Which open-source provenance, evidence and reproducibility projects could be ported onto Databricks, where no Databricks version exists?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: data.

Marks: *observed* = opened the source (URL, date given); *asserted* = source claims without showing, or secondary page; *inferred* = my reasoning. "Unopened" = link seen, not read. Star counts and push dates are from `gh api repos/OWNER/REPO` on 2026-11-14 and expire quickly.

## The answer in one paragraph

Databricks covers table and column lineage (automatic, queries on Databricks), 30-day history with tunable retention, change data feed and row tracking (*observed*, official docs, 2026-11-14). It has no row-to-source-row provenance, no web-page snapshot archive, no signed capture credentials, no tamper-evident log and no recompute manifest format (*observed* for lineage limits; the other absences are *not found* in the docs and skills read). Those four gaps are exactly the product's three proof levels in [../../../spec/product.md](../../../spec/product.md) (§3 attribute evidence, comp evidence with `snapshot_ref` and `fingerprint`, `citation` with `table_versions[]`). The ports that fit best are: a WACZ writer (Browsertrix output) onto Unity Catalog volumes with a Delta fingerprint index; a C2PA verify and sign step for captures; a Merkle or RFC 3161 or OpenTimestamps anchor of daily Delta table versions and snapshot digests; and an OpenLineage-shaped export of the `citation` manifest into UC external lineage. ProvSQL (semiring provenance on Postgres) is the only research-grade project aimed at "which source rows made this number", and whether it loads on Lakebase is unchecked (*inferred* risk).

## What Databricks already has (existing notes extended, not repeated)

[databricks-platform.md](databricks-platform.md) line 12, 31, 32 and 120 already cover Lakebase, synced tables, CDF and Lakebase-to-Delta history; I add the provenance side.

- UC lineage: automatic, column level for queries run on Databricks; covers tables, views, columns, ML model versions, file paths, model serving and external assets; UDFs table level only (*observed*, Databricks docs "data-governance/unity-catalog/data-lineage", fetched 2026-11-14).
- Lineage limits (*observed*, same page): no row-level mapping; RDDs not captured; lineage lost on rename; path references give no column lineage; UPDATE, DELETE, MERGE through temp tables not reflected; lineage events persist after rollback. System tables `system.access.table_lineage` and `column_lineage` keep a rolling 395-day window by default.
- External lineage: External Metadata and External Lineage APIs, SDK or Lakeflow Connect can add non-Databricks assets (*observed*, page updated 2026-10-07). The page has no mention of OpenLineage (*observed*, count 0). Whether any official OpenLineage ingest exists is *not found*.
- OpenLineage on Databricks: the Spark listener installs by cluster init script and `spark.extraListeners io.openlineage.spark.agent.OpenLineageSparkListener`; `spark.jars.packages` does not work (*observed*, OpenLineage quickstart v1.55.0). Whether that is possible on Free Edition or serverless: *inferred* unlikely. A third-party repo `rockssk/unity-catalog-external-lineage` (OpenLineage via Kafka into UC external lineage) was seen only in search (unopened).
- Row tracking (DBR 14.0+): `_metadata.row_id` and `_metadata.row_commit_version`. These are stable row ids and last-change versions, not links to source rows (*observed*, Delta row-tracking doc). Clones get different ids; row tracking is not readable in CDF; enabling upgrades the protocol and rewrites rows (*observed*).
- History and time travel: `logRetentionDuration` default 30 days, `deletedFileRetentionDuration` default 7 days; on DBR 18+ time travel is blocked beyond the deleted-file retention; docs say do not use history as an archive (*observed*, Delta history doc). CDF is computed from the log and VACUUM removes change files (*observed*).
- Volumes: managed volumes keep a 7-day retention after delete; no executor-distributed `dbutils.fs`, no RDD access, UDFs cannot reach volume paths (*observed*, volumes doc). Volume file metadata (checksums, versions) was not checked: *not found*.
- Skills (cite by name): `databricks-dbsql` (7-day retention, CDF, lineage; row tracking for materialized views; time travel not supported on materialized views), `databricks-iceberg` (row lineage on Iceberg v3, no CDF on managed Iceberg), `databricks-lakebase` (lakehouse-sync CDF beta, synced tables), `databricks-lakeflow-connect` (30-day staging volume retention), `databricks-ml-training` (feature lineage), `databricks-unity-catalog` (*observed*, grep of skill files).
- Net: nothing in the docs or skills read ties a displayed value to its source rows (*not found*). The product's `citation` and `evidence` shapes fill that.

## Project table

Port effort is *inferred*. "Mark" is has / partly / does not.

| Project | URL | What it does | Stars | Last push | Licence | Databricks equivalent (mark) | Port effort | Use here |
|---|---|---|---|---|---|---|---|---|
| OpenLineage | https://github.com/OpenLineage/OpenLineage | Open lineage event spec and Spark and other listeners | 2763 | 2026-11-13 | Apache-2.0 | partly: UC lineage native; OpenLineage ingest not found in docs | low-medium: emit custom facets to UC external lineage API | publish `citation` manifests as lineage events |
| Marquez | https://github.com/MarquezProject/marquez | Reference OpenLineage store and UI (Postgres) | 2306 | 2026-11-11 | Apache-2.0 | partly: UC lineage UI covers tables, not custom runs | medium: Postgres store maps to Lakebase; Java service | probably redundant with UC; reference schema only |
| lakeFS | https://github.com/treeverse/lakeFS | Git-like branches and commits over object storage | 5589 | 2026-11-12 | BSL 1.1 (see below) | partly: Delta time travel, shallow clone, Lakebase branching | high | branch-and-compare for experiments; overlaps Delta |
| DVC | https://github.com/treeverse/dvc | Data and model versioning with git | 15974 | 2026-11-09 | Apache-2.0 | partly: Delta versions, MLflow artifacts | medium | little; MLflow covers models |
| Nessie | https://github.com/projectnessie/nessie | Git-like catalog for Iceberg | 1531 | 2026-11-14 | Apache-2.0 | partly: UC plus Iceberg v3 support | high | little |
| Pachyderm | https://github.com/pachyderm/pachyderm | Versioned data pipelines on Kubernetes | 6311 | 2025-02-03 | Apache-2.0 (LICENSE file; API gave no SPDX) | partly: Lakeflow plus lineage | high; Kubernetes-bound | little; push date is stale (not archived) |
| Browsertrix Crawler | https://github.com/webrecorder/browsertrix-crawler | Puppeteer and CDP crawler that writes WARC and WACZ | 1197 | 2026-11-14 | AGPL-3.0 | does not (no page snapshot archive found) | medium: needs a Chrome-capable runtime; Free Edition has none | page-as-captured snapshots with fingerprint |
| WACZ and wacz-auth specs | https://github.com/webrecorder/specs | Zipped web archive format with sha256 manifest, optional signature | 145 | 2026-11-11 | none stated | does not | low: writer to a volume, index in Delta | snapshot container for comp evidence |
| warcio | https://github.com/webrecorder/warcio | Python WARC read and write | 486 | 2026-10-28 | Apache-2.0 | does not | low | write WARC from fetched HTML in a job |
| pywb | https://github.com/webrecorder/pywb | Replay of WARC and WACZ, Memento support | 1719 | 2026-11-14 | GPL-3.0 | does not | medium: web service as a Databricks App | show "the page as captured" in the item card |
| ArchiveBox | https://github.com/ArchiveBox/ArchiveBox | Self-hosted archiver: HTML, PNG, PDF, WARC, SQLite | 29028 | 2026-11-14 | MIT | does not | medium: SQLite and filesystem map to Lakebase and volumes | alternative to Browsertrix for single URLs |
| SingleFile | https://github.com/gildas-lormeau/SingleFile | One-file HTML page capture (extension, CLI) | 22914 | 2026-11-13 | AGPL-3.0 | does not | low-medium | self-contained snapshot for a cloud browser run |
| c2pa-rs | https://github.com/contentauth/c2pa-rs | Reference C2PA read, sign, verify (Rust) | 446 | 2026-11-14 | Apache-2.0 and MIT dual (LICENSE files; API said NOASSERTION) | does not | medium: Python or Node binding in a job or App | verify credentials on uploaded photos; sign server-side captures |
| c2pa-python | https://github.com/contentauth/c2pa-python | Python binding | 108 | 2026-11-12 | Apache-2.0 | does not | low | same, from a Databricks job |
| c2pa-swift | https://github.com/contentauth/c2pa-swift | iOS binding | 27 | 2026-11-14 | Apache-2.0 | does not | not a Databricks port | client-side signing at capture |
| Sigstore cosign | https://github.com/sigstore/cosign | Sign and verify artifacts, keyless with transparency log | 6439 | 2026-11-12 | Apache-2.0 | does not | medium | sign the manifest or code version; Rekor not opened |
| in-toto | https://github.com/in-toto/in-toto | Signed supply-chain step attestations | 1056 | 2026-08-27 | Apache-2.0 (LICENSE file; API said NOASSERTION) | does not | medium | attest "this number came from job X at code version Y" |
| Tessera | https://github.com/transparency-dev/tessera | Tile-based transparency log library (Go) | 260 | 2026-11-12 | Apache-2.0 | does not | high: Go; storage on volumes needs a driver | append-only log of daily table versions and snapshot digests |
| Trillian | https://github.com/google/trillian | Merkle-tree log server | 3762 | 2026-11-02 | Apache-2.0 | does not | high | same; heavier than Tessera |
| python-opentimestamps | https://github.com/opentimestamps/python-opentimestamps | Bitcoin-anchored timestamp proofs (library) | 118 | 2026-10-27 | LGPL-3.0 | does not | low: stamp a daily digest in a job | free external date proof for a published number |
| Croissant | https://github.com/mlcommons/croissant | JSON-LD dataset metadata format | 921 | 2026-11-09 | Apache-2.0 | partly: UC tags and comments, no dataset card format | low | manifest format for published numbers and datasets |
| RO-Crate (ro-crate-py) | https://github.com/ResearchObject/ro-crate-py | Package of data, code and metadata for reproducibility | 92 | 2026-10-14 | Apache-2.0 | does not | low | recompute bundle: table versions, definition, code |
| prov (W3C PROV Python) | https://github.com/trungdong/prov | PROV data model in Python | 148 | 2026-11-14 | MIT | partly: UC lineage is a narrower graph | low | serialise the evidence chain in a standard model |
| ProvSQL | https://github.com/PierreSenellart/provsql | Postgres extension for (m-)semiring provenance, probabilities, Shapley values | 76 | 2026-11-13 | MIT | does not (no row provenance in UC, observed) | unknown: needs PG 11+, C++17, Boost, `shared_preload_libraries` | which listing rows produced a price; whether Lakebase loads it is unchecked |
| OpenMetadata, DataHub, Apache Atlas | https://github.com/open-metadata/OpenMetadata, https://github.com/datahub-project/datahub, https://github.com/apache/atlas | Catalogue and lineage platforms | 15778, 12987, 2164 | 2026-11-14, 2026-11-14, 2026-11-13 | Apache-2.0 each | has: Unity Catalog | n/a | duplicate of UC; listed only to show they were checked |

Observed licence detail: lakeFS LICENSE (opened) is Business Source License 1.1, licensor Treeverse Labs, licensed work 1.87.0. The Additional Use Grant allows production use of the unmodified work for internal business purposes, with no offering to third parties and no modified versions or forks; Change Date is four years from first public release of a version; the conversion licence was not read. Pywb (GPL-3.0), Browsertrix (AGPL-3.0) and SingleFile (AGPL-3.0) are copyleft, recorded as fact only. Per brief, no project is excluded on licence.

Format facts (*observed*, WACZ spec 1.2.0 at specs.webrecorder.net): layout is `archive/data.warc.gz`, `datapackage.json` with sha256 per resource, `datapackage-digest.json`, `indexes/index.cdx`, `pages/pages.jsonl`. WACZ-auth 0.1.0 is a draft: anonymous signature, or domain certificate signature plus an RFC 3161 `timeSignature`, over the sha256 of `datapackage.json`. Browsertrix Crawler uses Puppeteer with Brave and CDP (*observed*, README).

## C2PA and phones (2026 status)

- Pixel 10 (Aug 2025): Pixel Camera attaches Content Credentials to every JPEG; Assurance Level 2 (C2PA Conformance Program); keys in Titan M2 StrongBox; one certificate per image; on-device offline time-stamp authority (*observed*, Google security blog, 2025-09-10, read via search highlights of the page).
- Samsung Galaxy S25: credentials only on images edited with Galaxy AI, not ordinary captures (*asserted*, ImgKey 2026-05-16 and couldthisbetrue 2026-05-28, secondary; Samsung page unopened).
- Apple: not a C2PA member; iOS 26 neither produces nor displays credentials (*asserted*, ImgKey 2026-05-16). Apple announced "Apple Reference Image" on 2026-09-09 with iPhone 18 Pro and iOS 27: sensor-level signing, Apple's own scheme, not C2PA, no public spec or keys yet; a developer API exists on iOS, iPadOS, macOS and Apple plans documentation next year (*asserted*, c2paviewer.com 2026-09-17 and PetaPixel 2026-10-12, secondary; Apple's own page unopened). This is the newest and least verified item here.
- Truepic mobile SDK gives C2PA capture in any iOS or Android app (*asserted*, ImgKey; unopened). Open SDK languages: Rust, Python, C++, JS (c2pa-web), Node.js, mobile libraries (*observed*, CAI open-source SDK page; mobile library page returned only 1256 characters, unread).
- *Inferred*: a seller photo from a Pixel 10 can be verified server-side by c2pa-rs or c2pa-python and the result stored as an `attribute` evidence record; an iPhone photo carries no C2PA today.

## Top five (value against port work)

All ranks are *inferred*.

1. **WACZ snapshot store (Browsertrix output + warcio + wacz spec).**
   Port: cloud-browser or fetch job writes a WARC with warcio, packs a WACZ, lands it in a UC volume; a Delta table holds `snapshot_ref`, sha256 fingerprint, `read_at`, `extractor_version`, rights tag. pywb or a small replay view could serve it from a Databricks App. Rewrite: storage layer (local disk to volume paths; UDFs cannot reach volumes, so do it in jobs, *observed*), the crawler runtime (Free Edition has no Chrome-capable compute, *inferred*). Licence facts: warcio Apache-2.0, specs none stated, Browsertrix AGPL-3.0. Engineer view: interesting, because Databricks has no web-archive primitive and this makes a volume plus Delta index a citable evidence store (*inferred*).
2. **Manifest and anchor for published numbers (RO-Crate or Croissant + OpenTimestamps or RFC 3161).**
   Port: when a number publishes, a job writes `citation` (table versions from Delta history, definition version, code version) as an RO-Crate or Croissant JSON-LD file in a volume, hashes it, and stamps the hash with OpenTimestamps (LGPL-3.0) or an RFC 3161 authority. Constraint: Delta history retention is 7 to 30 days by default, so a recompute needs the retention raised or a clone kept (*observed* defaults). Low port effort, all Python. Engineer view: reproducibility story is easy to demonstrate; the date anchor is external and free (*inferred*). RFC 3161 client library: not found.
3. **OpenLineage export of the citation graph.**
   Port: map `citation.basis_ids[]` and evidence to OpenLineage custom facets and post them to UC External Lineage API so a number appears in Catalog Explorer lineage with its external sources (page snapshots, labels). Rewrite: a small emitter; no Spark listener needed. Limit: UC lineage stays table and column granular, so row ids ride in facets, not in the graph (*observed* limit). Engineer view: speaks directly to a Databricks feature and extends it; official OpenLineage ingest status unknown (*not found*).
4. **C2PA verification (c2pa-python or c2pa-rs).**
   Port: job or App reads uploaded photo bytes from a volume, verifies the manifest, writes assertion summary and certificate chain result as evidence of kind `image_region` or `label_text` provenance. Server-side signing of derived images (studio outputs) is possible with the same SDK (*inferred*). Rewrite: nothing heavy; native wheel must install on serverless or a cluster (unchecked). Value depends on seller hardware: Pixel 10 signs, iPhone does not (*asserted*). Engineer view: novel to the track, but it is not Databricks-specific work.
5. **Transparency log (Tessera or Trillian) over daily digests.**
   Port: append each day's Delta table version list and snapshot digest root to a Merkle log; publish inclusion proofs with a number. Rewrite: Go services; Tessera storage backends would need a volume or Postgres (Lakebase) driver (*inferred*, backends not read). Highest effort in the top five, strongest tamper-evidence claim. Engineer view: impressive but off-platform; OpenTimestamps in item 2 gives a cheaper anchor.

Runner-up: ProvSQL on Lakebase for where-provenance (ProvSQL Studio highlights source cells of an output value, *observed* README). Its value is highest of all for "tie a number to its rows", but loading a custom extension on Lakebase is unchecked and Lakebase extension limits were not read here (*inferred* risk). Mentioned peers covered by other workers: `NVIDIA/auto-ontology` (provenance on every answer), `treg.to`, `withastro/flue`; not researched here.

## Not found

- Smoke (row-provenance research system): search returned nothing usable.
- An RFC 3161 timestamp client library: search returned nothing.
- Official OpenLineage ingest or export in Databricks docs: not in the pages read; may exist elsewhere.
- Databricks volume file metadata (checksum, versioning): not checked.
- Any Databricks mechanism that links a displayed value to source rows: not found.
- A primary Apple or Samsung page for their C2PA position.
- Whether ProvSQL, c2pa wheels, or Browsertrix run on Free Edition or Lakebase.

## Searched / could not reach

- Not opened or read in depth: Sigstore Rekor and sigstore-python, Memento (RFC 7089) and pywb Memento behaviour, perceptual hashing libraries, Marquez internals, Croissant and RO-Crate content beyond metadata, W3C PROV spec, DataCite and DOI practice, statistics-agency data-citation guidance, notebook provenance tools. These areas are listed in the table only from GitHub metadata or not at all; nothing is claimed about them beyond the table.
- CAI mobile library page: 1256 characters returned, unread.
- Pachyderm and authsign licence: API gave no SPDX; Pachyderm LICENSE file read, authsign not determined.
- Search snippets for phone C2PA support came from blogs; only the Google security blog is a primary source.

## Sources fetched

- Databricks docs: Unity Catalog data lineage; Delta row tracking; Delta history; Delta change data feed; Volumes; External lineage (all fetched 2026-11-14)
- https://docs.openlineage.io quickstart (v1.55.0)
- https://specs.webrecorder.net/wacz/1.2.0/ and https://specs.webrecorder.net/wacz-auth/0.1.0/
- https://github.com/PierreSenellart/provsql README; https://github.com/webrecorder/browsertrix-crawler README; ArchiveBox, pachyderm and c2pa-rs READMEs and LICENSE files; lakeFS LICENSE
- GitHub API repo metadata for every repo in the table (2026-11-14)
- https://blog.google/security/pixel-android-trusted-images-c2pa-content-credentials/ (via search highlights, 2026-11-14)
- Secondary, search highlights only: imgkey.com/c2pa-adoption-status, petapixel.com 2026/10/12 article, c2paviewer.com Apple Reference Image article, couldthisbetrue.com, c2pa.ai smartphone guide
- CAI open-source SDK page
- Repo files: ../../../spec/product.md, databricks-platform.md; official skills under dbx-skills (names above)
