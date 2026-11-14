# The secondhand UI constitution

How every interface decision in secondhand is researched, reasoned, made and checked, for the app, the web and any screen an agent builds. Asked for by Ben on 2026-11-14 at 20:17 and 20:20 ([words](words.md#2026-11-14-constitutions), [20:20](words.md#2026-11-14-extreme-intention)). It sits above [frontend-standard.md](frontend-standard.md) (how to build and audit) and [copy.md](copy.md) (what words appear). How things look and sound across every medium is in the brand thread's `brand/constitution.md`. Where the two meet, this file decides what the user can do and what text exists. The brand file decides how it looks and sounds.

It is written from Ben's thesis about working with agents. That thesis lives in his notes on his Mac (`harness-overhaul/THESIS.md`, 2026-11-13) and his global instructions. Quotes below are his words. Everything else is the agent's reading, and every article is an *agent proposal* until Ben accepts or changes it. Two articles are already his decisions: Article 1 ("everything needs to be done with extreme intention") and Article 5 ("show rather than say").

## The thesis in one paragraph

The model is smart enough. What limits the result is what it thinks through. In Ben's words: "Intelligence is not only limited by what it knows. It is limited by the representations, instruments, obligations, and control structures through which it is currently thinking." Left alone, an agent gives "the most common one instead of the right one", and text that sounds right but tells a person nothing ("Sold $36–52 · n=41"). The cure is not more rules about pixels. It is a way of thinking that starts from the person holding the phone: what they want, not what they'd say; what else they might want to do; what they already know from other apps. Every element must then earn its place with a reason a human would accept. Ben directs by reacting, so the work produces cheap things he can react to, early, and says what is unfinished.

## Scope and standing rules

Ben's decisions, in his words ([words](words.md)):

- **App first, web later.** "the app is the primary thing". A website with sign-in and the same features comes later, with photo upload in place of the camera and LiDAR (20:45). Design each screen for the phone, and keep nothing in it that only a camera can do unless that screen is the camera.
- **Build it, don't rule it out.** "this is a product demo, getting something that works for a hackathon is different from writing a production app" (21:08, [decision](decisions.md)). Research shapes how a thing is built, not whether. Raise a constraint only when it would break the demo.
- **Pay for the better API.** "if you think theres an api or multiple possibilties for it that would work better we are fine paying for api costs" (21:13). Cost is not a reason to pick the weaker option, and several APIs together are fine.

## Ends and means

Most bad UI decisions confuse a means with an end. Name which is which before deciding anything.

| End: what we are actually after | Means: tools that serve it, and get dropped when they don't |
|---|---|
| The person knows what is happening with their stuff without reading | Pills, badges, logos, photos, color, motion |
| The person does what they came to do in as few decisions as it really takes | Buttons, cards, tabs, sheets, defaults |
| The person trusts what the app did for them | Plain labels like "Automatic", undo, a "why?" timeline, sources on numbers |
| The person gets more money, or a better deal, for less effort | Pricing, crosslisting, automation, watching |
| Nothing the app shows needs inside knowledge to understand | Plain words, familiar patterns, real photos |
| Ben recognises his taste in it, and nobody can tell an AI made it | References, image ideation, critique, the brand file |

Test: if removing a thing would not hurt any end in the left column, remove it. "We already built it", "the reference had it" and "it looks designed" are not ends.

## The articles

### Article 1. Extreme intention: every element has a stated reason

Ben, 20:20: "everything needs to be done with extreme intention."

Every element on a screen has a reason written down. That covers each word, number, icon, color, gap, button and animation. A reason names the user's need it serves and what would go wrong without it. "Consistency", "it fills the space", "the template had it" and "it looks premium" are not reasons on their own.

In practice: each screen's contract (see [frontend-standard.md §6](frontend-standard.md#6-transfer-contract-template-one-row-per-borrowed-property)) has a **reason table**, with one row per element: the element, the user need, what breaks without it, and its source (Ben's words, a reference, research, or agent inference). An element with no row is deleted before review. The Today rework below is the first worked example.

Check: pick any element at random. If nobody can say in one sentence why it is there, the screen fails.

### Article 2. Start from the person, not the screen

Before any layout, write the **four screen lines** (from Ben's ui-factory skill):
- who is holding the phone
- how often they come here
- the main thing they came to do
- the task where a mistake costs the most

Then answer, in order:

1. **What do they want, not what do they think they want?** A seller opening Today does not want "3 things that need me". They want to know whether anything will be lost if they ignore the app (a sale, an offer, a deadline), and how to make it go away in one tap. Ben: "infer what I want rather than what I say", and at 20:45, "think about what they want not what they think they want" ([words](words.md#2026-11-14-app-first-and-ui-factory-after-the-brand)).

   What people ask for is a guess at a solution. What they do, complain about and give up on is the evidence. So the "wants" sentence is found by research, not by imagining the user:
   - **Seed** with sources that show behavior, not opinion: app reviews and forum complaints about the job, a product's own changelog when it moved or removed something, sellers' guides written after hundreds of sales, and our own captures. Say why each seed is worth reading.
   - **Loop.** Read one seed closely, write what it shows the person actually does or needs, then update a short frontier: what changed, the next lead, and one lead that argues the other way. Feed that frontier into the next search instead of keeping a reading list. Stop when a loop no longer changes the answer. This is the seeded, adaptive investigation in Ben's [it-already-exists](https://github.com/benverhaalen/it-already-exists/blob/main/skills/reference-driven-development/references/research-improvement.md) method.
   - **Write both sentences** in the screen's lines: "they'd say: …" and "they want: …", with the evidence for the second. If the two match, say so; the research still has to show it.
   - **Check it on the screen.** The design passes when it serves the "wants" sentence even if the user never asks for it.
2. **What else might they want to do here?** List every intent a real person could have on this screen before deciding which ones get space. Two buttons is a guess, not a design (Ben, 20:17: "there are only two decisions there like think of what if a user wanted to do something else"). Use the [function map](functions.md) and [missing-features.md](../research/cross-cutting/ben/missing-features.md) as the inventory.
3. **What do they already know?** Name the apps this person already uses for the same job (eBay Seller Hub, Depop, Marketplace, iMessage, Gmail, the iOS camera) and what those apps taught them. Familiar beats clever (Jakob's law).
4. **What will they misread?** Read every element as someone who has never seen the app, has one thumb free and is half paying attention.

### Article 3. Understand the problem before designing it

Ben: "you have been proposing architectures when really ive just wanted you to better understand the problem." Before proposing a screen:

- **State the common answer** (what most apps or an untuned model would do) and say whether it is kept or replaced, and why. The common answer is suspect but not wrong by default.
- **Find what the decision rests on.** Separate the facts you need from the ones you'd be guessing. Research the guesses at the rawest source: the product itself, its help pages and docs, real listings, people's complaints. Don't use articles about them.
- **Pick the cheapest level that settles it.** In Ben's order: plain reasoning, structured comparison, a table or diagram, a prototype or image, then a formal model. When an image or a clickable wireframe can settle it, make that instead of arguing.

### Article 4. Existing work first, then the 3%

Ben: "plenty of people are working on similar problems probably. Rather than having llms invent everything independently." Use reference-driven development (it-already-exists):
- Every reference gets a job: navigation, density, motion, recovery, wording or visual direction.
- Keep what makes it work (the invariant). Change only what our user needs (the "3%", "a creative principle, not a similarity score").
- Write the check that shows the transfer worked.
- Real shipped products outrank concept shots and AI galleries.
- Keep rejected and deferred references in the research note. Deferred is not discarded.

### Article 5. Show, don't say; and what you do say, a person must understand

Decided by Ben at 19:45 ([copy.md](copy.md)). Two parts:

1. **Show.** If a photo, logo, pill, number or position can carry it, no sentence does. Every item has its photo, because people recognise their own things by sight before they read a title. A platform is its logo.
2. **Say plainly.** Any text that remains must be understood by a first-time user without inside knowledge:
   - **No statistics notation.** No `n=41`, `p50` or "range".
   - **No unexplained internal terms.** No "floor", "comps", "handled" or "tier" unless the user set that thing up and named it themselves.
   - **No abbreviations a stranger wouldn't use.**
   - **Numbers are written the way a friend would say them.**

   | Instead of | Write |
   |---|---|
   | "Sold $36–52 · n=41 · floor $40" | "Similar jackets sold for $36 to $52 lately. You said you'd take $40 or more." |
   | "3 need you, 11 handled" | Nothing, because the cards themselves show what needs you. |

   Ben's anti-claudish skill (writing) applies to every string: `node scripts/copy-lint.mjs`.

Check: hand the screen to someone who has never heard of secondhand. Every word they ask about is a defect.

### Article 6. Complete, not minimal; and nothing extra

Minimal writing does not mean minimal capability. For every screen:

- **List the full action set.** Include every reasonable thing the user might do with this item at this moment, including "not now", "this is wrong" and "talk to the person".
- **Make the likeliest action one tap, and the others reachable.** That means one primary action, up to two visible secondary actions, and a "More" menu that names the rest. Nothing a user could reasonably want is missing; nothing a user didn't want is shown.
- **Name the escape.** Every card that asks for a decision says what happens if you ignore it ("The offer expires tomorrow at 6 pm").

### Article 7. Familiar patterns, attention on purpose

From [copy.md](copy.md) and [frontend-standard.md](frontend-standard.md):

- Each surface borrows from an app the person already knows, and says which.
- Each screen has exactly one focal point; each decision on it has one primary action (brand C4).
- Color, size, weight and position are spent only where attention should go.
- Bold and size changes follow one scale; weight is never used just to fill space. Ben, 20:17: "the bolding and font sizes feels all janky".
- No dark patterns: no fake urgency, no guilt, no streaks.

### Article 8. Ben directs by reacting; the agent proposes

Ben: "'iteration' and 'shaping' is more of the productive art form vs deeply formal & upfront planning."

- **Produce something reactable early.** A wireframe, an image or a clickable flow, not a plan.
- **Give choices with consequences, not open questions.** Recommend one and say why. Ask only where a wrong guess is costly or can't be undone.
- **Who holds what.** Ben holds taste, direction, scope, and anything public, billed or irreversible. The agent holds the research, the means and carrying the work through.
- **The agent says what it thinks.** It disagrees openly when it has a reason.
- **Say what is unfinished.** Every delivery ends with "usable" or "not usable yet", plus the unfinished list.
- **Corrections become checks.** When Ben corrects a UI choice, the correction is recorded in [words.md](words.md). Where it is checkable, it becomes a check: a lint rule, an audit item or a test. That way he never says it twice.

### Article 9. Verify what can be checked; let people judge taste

- Countable things go to scripts: tokens, contrast, target size, overflow, copy lint and transitions. See [frontend-standard.md §5](frontend-standard.md#5-audit-checklist).
- Judgment goes to a fresh critic who did not build the screen and doesn't see the builder's rationale. Taste goes to Ben.
- A passing check is not proof that a screen is good. When Ben's reaction contradicts the checks, the checks are wrong.

### Article 10. Unrecognisable as AI-made

An expert human designer should look at the result and not suspect an AI. The known tells are:
- **Words:** filler, statistics notation, hedged labels and em dashes. See copy.md C1 to C12.
- **Visuals:**
  - generic gradients or purple accents
  - icon-topped feature cards
  - pills on everything
  - uniform bold
  - fake data
  - lorem ipsum and placeholder people
- **Structure:** every card has the same two buttons, sections exist only to fill a grid, and counters nobody asked for.

The tells are treated as questions, not bans. One hit is noise; a cluster means the screen was not designed with intention (Article 1).

### Article 11. Scale with the models; retire what stops paying

Rules here exist to change decisions, not to show diligence. A rule that no longer changes any decision, or that a better model makes unnecessary, is retired with a note. Don't build "a smoke testing system hardening slopfest". "Nothing should be rushed."

## The decision path for any UI question

Answer in order. Stop as soon as the question is settled. Each step names what to produce.

1. **End or means?** Restate the question as the end it serves (see the table above). If it is only a means, check that the end is still wanted. *Produce: one sentence.*
2. **Already decided?** Check [decisions.md](decisions.md), this file, copy.md and the brand file. If decided, apply it. If the decision seems wrong for this case, say so and ask, but don't silently override it. *Produce: a link to the decision.*
3. **Who, when, what for?** Write the four screen lines. Write what they want, as distinct from what they'd say. *Produce: four lines and one "wants" sentence.*
4. **What could they want to do?** Write the full intent list (Article 6), mark the likeliest, and mark the one where a mistake costs most. *Produce: a ranked list.*
5. **What does everyone else do?** Name two or three real products that solve this job, the common answer and what each one teaches. Decide keep or change, and why (Article 4). *Produce: a reference table with jobs.*
6. **What must be researched?** List the facts the decision rests on and mark each observed, asserted or guessed. Research the guesses at the rawest source. *Produce: a research note in `research/<slug>/ben/` if it took more than a lookup.*
7. **What is the cheapest thing Ben can react to?** Make a wireframe, image directions or a clickable flow. Use more than one variant only when the choice is truly open. *Produce: the artifact.*
8. **Does every element earn its place?** Fill the reason table (Article 1). Delete what has no row. Run the plain-words test (Article 5). *Produce: the reason table.*
9. **Does it pass the checks?** Run the frontend-standard audit, the copy lint, and a fresh-critic review for anything new. *Produce: the audit result, with what was not checked.*
10. **Is it Ben's call?** Taste, direction and scope go to him as a choice with consequences and a recommendation. Everything else, the agent decides and logs. *Produce: a decision card or a decisions.md entry.*

## How research is conducted for UI

- **Start with a draft answer,** then search both for it and against it.
- **Use the rawest sources:**
  - the product itself (screens, flows, help center)
  - official docs and policies (eBay Seller Center, Depop and Poshmark help)
  - real listings and sold data
  - user complaints (Reddit, App Store reviews)
  - papers for psychology claims
- **Mark every claim** *observed*, *asserted* or *inferred*. A narrow search does not prove absence.
- **Domain knowledge counts as research when it is marked.** Ben: "im no domain expert in ebay for example. i need your knowledge to figure out what i could be missing." The agent brings what experienced resellers know (handling times, offer expiry, relisting, returns, seller ratings), marks it as asserted, and checks the parts a decision depends on.
- **File it** in `research/<slug>/ben/` in the [note format](../research/README.md), link it from the feature page in one line, and put quotes in words.md.

## Amending this constitution

- Ben amends it by saying so. His words go in words.md, and the article changes with a link.
- An agent may propose an amendment, marked *agent proposal*, with the case that caused it. It never moves to Decided on its own.
- When an article and a specific decision conflict, the specific decision wins, and the article gets a note.
