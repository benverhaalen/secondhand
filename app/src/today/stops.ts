// The clearing world on a day things went wrong, for Today's edge cases (spec/edge-cases.md, Ben 05:05): a thing sold on two
// sites at once (§1), and an item stopped at each step of the auto-list tree it could not settle (§7), each stop one card
// with one question. Open it with /?world=stops. Built with the demo's own constructors, so every amount is computed.
import { decision, sale } from '../demo/build.ts';
import { inHours, inMinutes, usd } from '../demo/format.ts';
import { world } from '../demo/index.ts';
import type { Decision } from '../demo/types.ts';
import type { World } from '../demo/world.ts';
import { CANCEL_COST } from './cards.ts';

const base = world('clearing');
const it = (id: string) => base.items.find(i => i.id === id)!;
const pants = it('it_pants'), hoodie = it('it_hoodie'), sw = it('it_switch'), fleece = it('it_fleece'), lamp = it('it_lamp');

// §1: two buyers paid within the delist window. The first paid on eBay; the second on Depop two minutes later.
const first = sale({ id: 'ord_pe', item: pants, site: 'ebay', price: 4200, state: 'paid', hoursAgo: 0.7, buyer: 'workpants_jo', shipBy: 47 });
const second = sale({ id: 'ord_pd', item: pants, site: 'depop', price: 4000, state: 'paid', hoursAgo: 0.66, buyer: 'canvasfan', shipBy: 71 });
const keep = (o: typeof first) => o.price_cents - o.fees_cents - o.shipping_cents;


const stops: Decision[] = [
  decision({
    id: 'dec_double', kind: 'double_sale', item_id: pants.id, site: 'ebay', feed: 'now', group_form: 'single', deadline: inHours(2), order_id: first.id, conversation_id: 'cv_pd',
    why: `Sold on two sites. ${first.buyer} paid ${usd(first.price_cents)} first; ${second.buyer} paid ${usd(second.price_cents)} two minutes later.`,
    money: { you_keep_cents: keep(first) },
    options: [
      { id: 'first', label: 'Keep the first', does: `Keeps ${first.buyer}'s sale and cancels ${second.buyer}'s with a drafted apology through the site.` },
      { id: 'second', label: 'Keep the second', does: `Keeps ${second.buyer}'s sale and cancels ${first.buyer}'s. ${CANCEL_COST.ebay}.` },
    ],
    suggested: 'first', tier: 'locked',
  }),
  // §7 step 1, shots: the tag photo is blurred, so it asks for that one shot again.
  decision({ id: 'dec_retake', kind: 'retake', item_id: hoodie.id, site: null, feed: 'when_you_can', group_form: 'queue', group_key: 'retake', group_rank: 1, deadline: null,
    why: 'The tag photo is blurry.', options: [{ id: 'take', label: 'Retake the tag', does: 'Opens the camera on the tag shot.' }, { id: 'skip', label: 'Skip', does: 'Lists it without the tag.' }], suggested: 'take' }),
  // §7 step 4, facts a camera cannot see: one question, with "Not sure" kept in More.
  decision({ id: 'dec_fact', kind: 'clarify', item_id: sw.id, site: null, feed: 'when_you_can', group_form: 'queue', group_key: 'clarify', group_rank: 1, deadline: null,
    why: 'Do the Joy-Cons drift?', options: [{ id: 'no', label: 'No drift', does: 'Says the controllers work.' }, { id: 'yes', label: 'They drift', does: 'Says so, and prices it lower.' }, { id: 'unsure', label: 'Not sure', does: 'Leaves it out of the listing.' }], suggested: 'no' }),
  // §7 step 7, drafts: a claim nothing backs is held, never posted.
  decision({ id: 'dec_claim', kind: 'unbacked_claim', item_id: fleece.id, site: 'poshmark', feed: 'when_you_can', group_form: 'single', deadline: null,
    why: 'The draft says “never worn”. Nothing backs it.', options: [{ id: 'without', label: 'Post without it', does: 'Takes “never worn” out and posts.' }, { id: 'true', label: 'It’s true', does: 'Keeps it, as your word.' }, { id: 'edit', label: 'Edit', does: 'Opens the draft.' }], suggested: 'without' }),
  // §7 step 8, post: the site refused it, with its reason.
  decision({ id: 'dec_postfail', kind: 'failed_post', item_id: fleece.id, site: 'mercari', feed: 'now', group_form: 'single', deadline: null, error: 'The site wants a size',
    why: 'Couldn’t post here: the site wants a size.', options: [{ id: 'retry', label: 'Add size M and retry', does: 'Posts again with size M from the tag.' }, { id: 'self', label: 'Do it myself', does: 'Opens the site.' }], suggested: 'retry' }),
  // §7 step 9, check: the read-back shows something else than what was posted.
  decision({ id: 'dec_changed', kind: 'site_changed_listing', item_id: lamp.id, site: 'ebay', feed: 'when_you_can', group_form: 'single', deadline: null, created_at: inMinutes(-40),
    why: 'The site shows $44, not your $48.', money: { price_cents: 4800 },
    options: [{ id: 'mine', label: 'Put back $48', does: 'Sets $48 on the site again.' }, { id: 'site', label: 'Keep $44', does: 'Keeps the site’s price.' }], suggested: 'mine' }),
];

export const doubleSale = { first, second, keep: { first: keep(first), second: keep(second) } };

export const stopsWorld: World = {
  ...base, name: 'stops',
  orders: [...base.orders, first, second],
  // The tree stopped before the Switch was drafted, so its first post is not on the feed yet.
  decisions: [...base.decisions.filter(d => d.id !== 'dec_post' && d.id !== 'dec_reply'), ...stops],
};

// Today with one card (the state "one", .agents/ui-states.json): the clearing person on a day only the pickup waits. The
// demo's own "one" world has a single item and nothing to decide, which on Today is the empty state, so one card is drawn
// from clearing instead. Open it with /?state=one.
export const oneCardWorld: World = { ...base, name: 'one-card', decisions: base.decisions.filter(d => d.id === 'dec_addr'), notices: [], events: [] };
