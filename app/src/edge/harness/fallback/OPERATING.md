# Fallback: how it operates

`withFallback({primary, jev, agent, fileRepair})` in fallback.ts wraps a deterministic command. Only `page_changed` falls back. `blocked`, `auth_expired`, `rate_limited`, `not_found` and `policy_refused` return as they are, so no rung solves or routes around a check.

1. **Jev typed steps** (`jevRung`). Code finds every array of listing-shaped objects in the page state and writes each as one text line (path, size, sample fields). One Jev decision picks the result set. Code maps the fields and validates the rows with classifyRead. An invalid or missing answer leaves the code default, the largest list.
2. **The agent** (port `Agent`): a browser-use-shaped loop over the primitives, reading text only.

Each rung files a repair candidate (`RepairCandidate`), so repair.ts can make the next call deterministic again.

### post
| Falls back when | Jev decides | Agent does | Never |
|---|---|---|---|
| the write page changed before anything was sent | which form or control is the post one, from the allowed controls | fills and submits through the primitives, then the read-back | replays a write with an unknown outcome; that goes to reconcile |

### revise
| Falls back when | Jev decides | Agent does | Never |
|---|---|---|---|
| the write page changed before anything was sent | which form or control is the revise one, from the allowed controls | fills and submits through the primitives, then the read-back | replays a write with an unknown outcome; that goes to reconcile |

### end
| Falls back when | Jev decides | Agent does | Never |
|---|---|---|---|
| the write page changed before anything was sent | which form or control is the end one, from the allowed controls | fills and submits through the primitives, then the read-back | replays a write with an unknown outcome; that goes to reconcile |

### relist
| Falls back when | Jev decides | Agent does | Never |
|---|---|---|---|
| the write page changed before anything was sent | which form or control is the relist one, from the allowed controls | fills and submits through the primitives, then the read-back | replays a write with an unknown outcome; that goes to reconcile |

### read_listings
| Falls back when | Jev decides | Agent does | Never |
|---|---|---|---|
| the read answered page_changed | which listing-shaped array is the result set | reads the page through the primitives | treats an empty list as broken |

### read_inbox
| Falls back when | Jev decides | Agent does | Never |
|---|---|---|---|
| the read answered page_changed | which listing-shaped array is the result set | reads the page through the primitives | treats an empty list as broken |

### send_message
| Falls back when | Jev decides | Agent does | Never |
|---|---|---|---|
| the write page changed before anything was sent | which form or control is the send_message one, from the allowed controls | fills and submits through the primitives, then the read-back | replays a write with an unknown outcome; that goes to reconcile |

### read_offers
| Falls back when | Jev decides | Agent does | Never |
|---|---|---|---|
| the read answered page_changed | which listing-shaped array is the result set | reads the page through the primitives | treats an empty list as broken |

### answer_offer
| Falls back when | Jev decides | Agent does | Never |
|---|---|---|---|
| the write page changed before anything was sent | which form or control is the answer_offer one, from the allowed controls | fills and submits through the primitives, then the read-back | replays a write with an unknown outcome; that goes to reconcile |

### make_offer
| Falls back when | Jev decides | Agent does | Never |
|---|---|---|---|
| the write page changed before anything was sent | which form or control is the make_offer one, from the allowed controls | fills and submits through the primitives, then the read-back | replays a write with an unknown outcome; that goes to reconcile |

### read_orders
| Falls back when | Jev decides | Agent does | Never |
|---|---|---|---|
| the read answered page_changed | which listing-shaped array is the result set | reads the page through the primitives | treats an empty list as broken |

### read_stats
| Falls back when | Jev decides | Agent does | Never |
|---|---|---|---|
| the read answered page_changed | which listing-shaped array is the result set | reads the page through the primitives | treats an empty list as broken |

### read_storefront
| Falls back when | Jev decides | Agent does | Never |
|---|---|---|---|
| the read answered page_changed | which listing-shaped array is the result set | reads the page through the primitives | treats an empty list as broken |

### search
| Falls back when | Jev decides | Agent does | Never |
|---|---|---|---|
| the read answered page_changed | which listing-shaped array is the result set | reads the page through the primitives | treats an empty list as broken |

### save
| Falls back when | Jev decides | Agent does | Never |
|---|---|---|---|
| the write page changed before anything was sent | which form or control is the save one, from the allowed controls | fills and submits through the primitives, then the read-back | replays a write with an unknown outcome; that goes to reconcile |
