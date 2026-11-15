# Operating the page kernel

This is the operating plan for hp-3, hp-4 and hp-5. Sources: [protocol](protocol.ts), [product vocabulary](../../../../spec/product.md#the-harness-protocol) and [engine §§3.2–3.4, 8–9](../../../../spec/engines/protocol-and-adapters.md). The three acceptance commands are `node --test --test-concurrency=2 app/src/edge/harness/{primitives,release,repair}.test.ts`, run separately with each filename.

## Execution

Read the manifest, the leased Page port, policy result and operation_id. `open` navigates once; `inspect` reads one tree; `extract` reads typed values with source refs; `network` captures once and removes credentials before returning. `click` and `fill` resolve the actual control, refuse forbidden controls and refs absent from controls[], apply policy, then act once and read back. Authoring and repair require the test account. The Page implementation owns stable ref resolution and atomic control identity through action; it must never resolve a ref to a different element between inspection and action. The caller owns lease, pace and write reconciliation.

The release gate reads the unchanged fixture and manifest. Replay the recorded capture offline in parallel with the test-account proofs. Run the live read, forbidden-control dry run and write round trip sequentially on their leased session. Check every manifest and output_schema field and type, then compare values with expected JSON. For writes require a test-account round trip with read-back and confirmed cleanup. A failed proof blocks the candidate. Nightly calls use the same gate. Canary selection is 5%; collect outcomes for one hour or twenty calls, compare the candidate Beta(1,1) posterior mean with the live version's lower 95% bound, then promote or roll back. Versions are strict semver; output changes require major, endpoint or route changes minor, selector or path changes patch. Rollback selects the previous passing semver for the same site and verb.

Repair reads the failing envelope, fixture expected JSON and a redacted mutated capture. Code handles triggers and error exclusions. An empty read checks a second input and fetch in parallel, then retries after an injected three-second delay; no rows on either engine means no repair, and challenges pause. For each of at most three rounds the author searches known expected values across DOM text, embedded JSON and network bodies, producing refs or JSON paths. It replays the candidate on both original and mutated captures, runs the full release gate, and stops at the first pass. The author is a port; the offline implementation needs no model. Conflicting or absent anchors fail explicitly. A deadline aborts the work at thirty minutes; failed rounds retain demotion and request stronger fresh recon. No repair replays a write.

Normal execution and release decisions are code. A fast decision model belongs upstream when choosing an unseen fallback tool; it has no authority to bypass policy. A language model reads recon and writes a recipe behind the Author port when deterministic anchoring cannot repair it. Neither model is called on today's offline path. Parallelism is limited to offline replay alongside one session proof sequence and independent offline mutation cases; actions within one leased session and repair rounds remain sequential. Ports receive AbortSignal; implementations must honor it.

## Likely failures and tests

| Cause | Test |
|---|---|
| Recipe names a payment, password, account-delete or unknown control | primitives: forbidden |
| Secret appears in headers, URL, nested JSON or form body | primitives: redaction |
| Policy refuses or authoring uses a live account | primitives: policy |
| Fixture field missing, mistyped or unequal | release: field gate |
| Missing live, dry-run or write cleanup proof | release: proofs |
| Canary regresses or semver crosses a schema boundary | release: rollback / semver |
| Empty or blocked result treated as breakage | repair: empty is not broken |
| Duplicate anchor silently maps the wrong field | repair: ambiguous anchors |
| Author switches the candidate to a write or another site | repair: author boundary |
| Author hangs or never produces a passing patch | repair: deadline / three rounds |
| Selector, nesting, wrapper, endpoint or pagination drift | repair: mutation drill |

## Verb recipes

Each table is a recipe outline, not permission. controls[] and policy remain mandatory; write read-back precedes lease release. `network` is optional after recon establishes a stable endpoint.

### post
| Read | Actions | Proof |
|---|---|---|
| listing, operation_id | open → inspect → fill → click | extract id; read_listings |

### revise
| Read | Actions | Proof |
| listing id, changed fields, operation_id | open → inspect → fill → click | extract changed fields; read_listings |

### end
| Read | Actions | Proof |
| listing id, operation_id | open → inspect → click | read_listings confirms ended |

### relist
| Read | Actions | Proof |
| listing id, operation_id | open → inspect → click | extract new id; read_listings |

### read_listings
| Read | Actions | Proof |
| seller's listings | open → extract | every manifest field and source |

### read_inbox
| Read | Actions | Proof |
| inbox cursor | open → extract | messages and source refs |

### send_message
| Read | Actions | Proof |
| conversation id, approved message, operation_id | open → inspect → fill → click | read_inbox confirms sent message |

### read_offers
| Read | Actions | Proof |
| offer cursor | open → extract | offers and source refs |

### answer_offer
| Read | Actions | Proof |
| offer or watcher ids, decision, operation_id | open → inspect → fill → click | read_offers confirms outcome |

### make_offer
| Read | Actions | Proof |
| listing id, buy_offer decision, operation_id | open → inspect → fill → click | read_offers confirms offer; never completes purchase |

### read_orders
| Read | Actions | Proof |
| order cursor | open → extract | orders and source refs |

### read_stats
| Read | Actions | Proof |
| listing ids | open → extract | stats and source refs |

### search
| Read | Actions | Proof |
| query, cursor | open → extract | results or legitimate empty array |

### save
| Read | Actions | Proof |
| listing id, operation_id | open → inspect → click | extract saved state |

## Capture boundary

Fixtures in fixtures/ are synthetic, masked captures, not live site proof. Page and Author are replaceable ports with in-memory implementations in the tests. Network strings that are neither JSON nor form data are discarded: a raw response can contain secrets without a named field. Captures supplied to repair must already be masked; the offline author redacts network bodies again. No tokens or page text enter the logger; call records contain only route ids, version ids, round counts and outcomes.

