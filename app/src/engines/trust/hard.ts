// The fixed hard rules (spec/engines/trust.md §2 "Scam: hard rules", §3 step 3). Never learned, never weighted.
// Two kinds of outcome: a thread rule blocks the thread (no draft, no one-tap commit); a locked kind stops only the agent's own act and
// the thread carries on to the score (the worked example's "share_address is locked and the agent will not give it").
import type { Site } from '../../edge/harness/protocol.ts';

export type LockedKind = 'move_off_site' | 'share_address' | 'identity_claim';
export type HardInput = {
  site: Site; checkout: boolean; orderPaid: boolean; local: boolean;
  present: ReadonlySet<string>; // the signals present: model predicates, plus payment_link and gift_crypto_wire from code
  draft?: string;               // a draft about to go out, checked for an identity claim
};
export type HardResult = {
  action: 'block' | 'ask' | 'none'; // thread-level; `ask` here is the Facebook local "check your payment app"
  draft: boolean;                   // whether a reply may be drafted at all
  locked: LockedKind[]; draftBlocked: boolean; scoreOffPlatform: boolean; reasons: string[];
};

const AUTH = /(?<!\bnot\s)(?<!\bun)\b(?:authentic|genuine|100% real|legit(?:imate)?)\b/i;

export function evaluateHard(i: HardInput): HardResult {
  const has = (s: string) => i.present.has(s);
  const reasons: string[] = [];
  let action: HardResult['action'] = 'none';
  const block = (why: string): 'block' => { reasons.push(why); return 'block'; };

  if (has('asks_code')) action = block('They asked for a code sent to your phone. That is a known scam. Do not share it.');
  if (has('overpay_or_shipping_label')) action = block('They claim an overpayment or want you to use their own label or courier.');
  if (has('payment_link')) action = block('A link that claims to be a payment, a verification or the site\'s own page. Do not open it.');
  if (has('gift_crypto_wire')) action = block('They want to be paid by gift card, crypto or wire.');
  if (has('claims_paid') && !i.orderPaid) {
    if (i.checkout) action = block('They say they paid, and the site shows no order.');
    else if (action === 'none') { action = 'ask'; reasons.push('They say they paid. Check your own payment app before you hand over the item.'); }
  }

  const locked: LockedKind[] = [];
  // The agent never moves a deal off-site or shares an address, whatever the thread decides.
  if (has('off_platform')) { locked.push('move_off_site'); reasons.push('They want to pay or talk off the site.'); }
  if (has('asks_address_phone')) { locked.push('share_address'); reasons.push('They asked for your address, email or phone. The agent will not give it.'); }
  const draftBlocked = i.draft !== undefined && AUTH.test(i.draft);
  if (draftBlocked) locked.push('identity_claim');

  return { action, draft: action !== 'block', locked, draftBlocked, scoreOffPlatform: has('off_platform'), reasons };
}
