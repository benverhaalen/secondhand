# 51: Buyers, messages you approve, meetups, and one place to audit every site

Updated: November 15, 2026. Owner: Ben. For: Nate. Agent: Claude Code, project thread "Map every feature and page so the build can start". Branch: `main`. Status: one decision by Ben (pickup times); the rest *agent proposal*. Source: Ben at 05:18, 05:20, 05:21 and 05:24 ([words](../../../../product/words.md#2026-11-15-who-judges-it-guarantees-the-buyer-side-messages-you-approve-meetups-audit-every-site-and-no-fixed-pickup-schedule), [05:20](../../../../product/words.md#2026-11-15-a-want-built-by-touch-that-runs-while-you-are-away), [05:21](../../../../product/words.md#2026-11-15-pickup-times-by-a-touch-picker), [05:24](../../../../product/words.md#2026-11-15-no-calendar-in-the-app-pick-days-and-times-see-who-is-coming-add-it-to-a-calendar-after)).

Where it is written: [edge cases §10 to §17](../../../../spec/edge-cases.md#10-every-variable-of-an-item-and-where-it-can-go-wrong), [ways out §6.3 and §6.16](../../../../spec/ways-out.md#63-messages), [watch](../../../../spec/features/watch.md#what-the-person-does-and-sees), and [questions](../../../../spec/questions.md) for the pitch.

## Decided by Ben: no fixed pickup windows, no calendar reading

[Decision](../../../../product/decisions.md#2026-11-15-no-fixed-pickup-windows-tap-the-days-and-times-that-work-and-approve-the-buyers-pick), [edge cases §16](../../../../spec/edge-cases.md#16-meeting-up-safely). The person taps days this week and a time span on each, and a place; the agent tells the buyer in a person's words; the buyer's pick comes back as a card showing who is coming, which the person approves; then Add to Google or Apple Calendar writes the event. The app never reads a calendar. What changes on your side:
- `limits.pickup_windows` is no longer asked at onboarding; `book_pickup` is no longer `auto inside the windows`. It confirms only a time the person approved.
- New: `POST /v1/appointments/offer {order_id, days[] {date, from, to}, spot}` drafts the message to the buyer from the tapped spans (worded by the model, checked by `claim_check`, sent per the person's reply mode).
- The buyer's pick is parsed from their reply into a `pickup_proposed` card carrying `buyer {name, photo_url, rating, review_count, member_since, site}`, the time and the place. Approve books it.
- `GET /v1/appointments/:id/calendar?kind=google|ics`: a Google Calendar add link and an `.ics` file. Writing only.
- Safe spots: `GET /v1/spots/near {lat, lng}` returns police exchange zones and public places, with the saved spot first.
- The harness saves a screenshot of the site's thread after each send and read, as `evidence.snapshot_ref` on the message, so the app can show the site's own view.

## Messages you approve

- `answer_fact` moves from `auto` to `ask`, promotable per question kind after 3 unedited sends. That is a change to product §5, so it is yours to accept or reshape.
- `user.auto_reply` per site: `drafts` (default), `answer`, `off`.
- A reply draft carries `facts[] {attribute, value, source}` so the queue can show what it used.
- `conversation.taken_over` (bool) stops automatic replies in that thread. The agent sets it itself, with `reason`, on: anger, an off-site or payment request, a return or claim, a question about an unconfirmed fact, or a price outside the plan.
- Each message carries `authored_by`: `user`, `auto`, `user_approved_draft`.

## One place to audit every site

`GET /v1/accounts/:id/activity` per site: what we last read there (listings with price and state, open offers, message count, orders) with `read_at`; our actions there with their read-backs; and `external_changes[]`, what changed on the site that we did not do, from reconcile. Mismatches first. Each line carries the site URL to open.

## Buyer side

- A want's price is a range: `price_low_cents` (ranks and flags too-cheap) and `max_total_cents` (the alert ceiling, unchanged).
- `fit.handover`: `ship`, `pickup`, `both`, with `radius_miles` for pickup; `fit.colour[]`.
- On a saved match: the price change since it was found, and the listing's photos and text stored at find time as evidence for a not-as-described case.
- The seller-not-replying path: when a `buy_offer` expires, offer the next match.

## Notifications

[spec/notifications.md](../../../../spec/notifications.md) (Ben, 05:23). The triggers your side raises:
- Each decision kind and event carries `notify {level: now | later | silent, time_sensitive}` from one table in code, with the level per default set by the item's `plan_choice` and the want, and overridable per kind in `user.notification_pref`.
- Digests at 9:00, 13:00 and 19:00 local, moved toward the person's usual open times; one notification per digest with a count and the top line.
- Quiet hours `user.quiet_hours {from, to}` default 22:00 to 08:00; a deadline inside them is pushed before they start.
- Fatigue: a kind pushed 3 times and never opened moves to the digest, and the next digest says so with Undo.
- Grouping keys: one thread per item (`thread_id = item_id`), and one per batch action.
- Lock-screen actions call `POST /v1/decisions/:id/act` with the card version; Accept, Approve and Counter require device authentication.
- The push payload `{kind, decision_id?, item_id?, path}` from packet 47, plus `title`, `body`, `actions[]` rendered on the server from the copy table so web and phone say the same thing.

## Smaller asks

- Poshmark end: "not for sale" by default, delete only on the person's ask (delete loses the likes).
- No proxy alone moves an item to sold; only an order read back does ([edge cases §12](../../../../spec/edge-cases.md#12-how-a-sale-is-seen-and-what-stands-in-for-it)). Please confirm that is how your watchers behave.
- Per-site returns line on the plan ("Poshmark: no returns unless not as described").

## Next action

Nate: change `book_pickup` and the onboarding pickup step to the decision, say yes or reshape the `answer_fact` change, and add the rest to the examples. Reply here.
