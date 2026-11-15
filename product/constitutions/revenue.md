# The revenue constitution

How a free app pays, and the numbers we show for it. The argument is in [business.md](../business.md) and the market in [pitch/market.md](../pitch/market.md); the per-feature numbers come from the thread "Quantify every feature with why and ROI". Reasons and numbers follow [evidence.md](evidence.md). *Agent proposal*.

## The problem

A judge will ask how a free app makes money, and whether that is honest. Sellers won't pay before they've sold, and the crosslisters they already know charge monthly. Ben's position is that free is the viable model "because of all the other business models" ([05:43](../words.md#2026-11-15-both-sides-in-the-demo-why-people-want-it-and-free-as-the-business-model)), with referral revenue when a buyer clicks through to a listing and, per Nate, anonymous market data ([words](../words.md#2026-11-14-nate-referrals-and-market-data)). The job is to show what each item costs us to run, what each revenue stream earns per item, and the return at scale, from research anyone can inspect, and to say plainly where it doesn't work.

**Success, checkably:** cost per listed item and per watched want, measured from our own logs; revenue per stream with its source; one honest scale scenario; the hurdles named.

## Rules

**R1. Free to the person.** No subscription, no fee on a sale. *Why:* A subscription asks a seller to spend before knowing whether an item will sell. Removing that charge and the sale fee lets them try selling without that deduction. Source: ([05:43](../words.md#2026-11-15-both-sides-in-the-demo-why-people-want-it-and-free-as-the-business-model)).

**R2. Every stream is named, sized and sourced.** Buy-side referral links, sized against what referral businesses like Honey earn; aggregated anonymous market data (Nate); partnerships with marketplaces only as a question. *Why:* A named revenue stream still needs a payer and a supported amount. Separating streams and their sources lets a judge test whether they can fund the service without treating a possible partnership as a deal. Source: ([08:09](../words.md#2026-11-15-quantify-everything-a-why-for-every-rule-ranked-identify-and-revenue-streams)); ([06:10](../words.md#2026-11-15-adjacent-appraisal-risk-and-why-this-price): "im not really sure to be honest").

**R3. Costs come from our logs, not guesses.** Model calls, image runs and cloud browser minutes per item, from [log/](../../log/README.md). *Why:* Retries and costly model or browser steps can erase an apparent margin. Logged resource use per item lets the judge inspect whether the free service can cover its actual work. Source: ([08:09](../words.md#2026-11-15-quantify-everything-a-why-for-every-rule-ranked-identify-and-revenue-streams): "look at our costs and estimate an roi for everything at scale").

**R4. Flattering hypotheticals, inspectable sources.** Every figure links to where it came from and carries its mark. *Why:* A scale scenario changes when its assumptions change. Inspectable sources and evidence marks let a judge distinguish a favorable scenario from revenue already earned. Source: "use hypotheticals backed in research but research that flatters us but it honest and inspectable" ([08:09](../words.md#2026-11-15-quantify-everything-a-why-for-every-rule-ranked-identify-and-revenue-streams)).

**R5. Data is sold only aggregated and anonymous.** Never a person's listings, messages or sign-ins; a person can see and clear what was learned; third-party AI providers never see credentials. *Why:* Listing activity and messages can reveal a person's behavior, and credentials grant account access. Keeping personal records out of sales and credentials out of AI calls protects the seller's control of that information. Source: ([ways out, 8](../ui-constitution.md#article-6-complete-not-minimal-every-automatic-step-has-a-way-around-it)); ([06:40](../words.md#2026-11-15-its-always-you-security-open-source-and-show-it-working-first)).

**R6. Say where it doesn't work.** Where we don't reach, what has to be true, and the hurdles. *Why:* A favorable scenario can depend on reach or access we do not have. Naming those conditions lets the judge assess viability without mistaking the scenario for a forecast. Source: "keeping it extremely honest" ([05:43](../words.md#2026-11-15-both-sides-in-the-demo-why-people-want-it-and-free-as-the-business-model); [business.md](../business.md#the-hurdles-plainly)).

**R7. Impact claims are cited or cut.** What secondhand does for the earth is said only with a cited figure. *Why:* A resale transaction alone does not measure environmental benefit. A sourced figure lets the stranger inspect what was measured before relying on that impact claim. Source: ([06:10](../words.md#2026-11-15-adjacent-appraisal-risk-and-why-this-price)).

## Open

- Cost per item and the ROI table are with the quantify thread; nothing measured is in business.md yet.
- How referral links are disclosed in the buy flow is not designed.
