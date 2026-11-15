# Search recordings

Regenerate the two in-process recordings from the repository root:

```sh
node app/src/buy/fixtures/record.ts
```

Then check the fold from `app/`:

```sh
node --test --test-concurrency=1 src/buy/reach.test.ts
npx tsc --noEmit -p .
```

Each recording contains the 202 response as `start` and the job store's ordered `frames`, plus a `recorded` provenance note. The recorder calls the real `POST /v1/search` handler and reads every frame through `jobs.framesAfter`. Fake ports supply pages from `spec/fixtures/pages/`, model answers and source failures; no network is used. Job ids, timestamps and measured durations change on each recording.

- `search-live-levi.json` is the supplied dev-server capture for `levi 501`. It shows six sources, four `no_route` failures, Poshmark and Dupe arriving, and Dupe dropping 18 duplicates. Its provenance notes that offer arrays were trimmed and Dupe rows removed; counts and timing remain the server's. The recorder leaves this file alone. The prefix tests check that source order, counts, timing and results follow only the frames already received.
- `search-late-cached.json` mirrors `app/src/edge/api/search.test.ts:464–475`. The first search reads the Poshmark fixture; the second uses its saved batch while the live refresh never resolves. The second job is recorded. It proves that `refreshing` precedes a `late` stage and settled `cached: true`, with the cached offers retained.
- `search-needs-account.json` mirrors `app/src/edge/api/search.test.ts:706–721`. Only Mercari is requested, with a harness but no linked account. It proves that `needs_account` is an arrived stage with the server's reason and no stage error.

The requested `SourceReach` shape has no standalone reason field. The account reason remains in the recorded `answer.searched`; the fold returns `outcome: 'needs_account'` and `error: null`. Exposing that reason through `Reach` needs a field in the contract.
