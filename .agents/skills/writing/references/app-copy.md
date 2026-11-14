# Words inside an app or site

Every entry C1 to C12 has a rule in `scripts/lint.py --surface product`. Sources: `codex #n` is a message the owner sent to Codex. The other entries come from practitioner guides, GOV.UK, Nielsen Norman Group and one count of 239 landing pages. No study counts these in AI copy against human copy, so a single hit means little. Fix clusters first.

The rule above all others: never invent a number, customer, quote or claim. If a line needs a real fact you do not have, ask the owner or leave a clearly marked empty slot.

## C1. Stock outcome verbs
**Tell:** "Unlock your team's potential", "Streamline your workflow", "Built for modern teams". The line fits any product.
**Fix:** say who it is for, what it does, and the result, with real nouns.
was: *Unlock your team's potential.* now: *Shared calendars for student clubs.*
**Earned when:** the word is literal (unlock a door, a permission).

## C2. Empty adjectives
**Tell:** powerful, seamless, robust, intuitive, cutting-edge, AI-powered. More than two on one screen.
**Fix:** replace each with something the reader can check.
was: *Powerful, seamless analytics.* now: *Sales by week and by store.*

## C3. Proof nobody supplied
**Tell:** "Trusted by 10,000 teams", "Increase conversions 312%", a testimonial from a "VP of Growth".
**Fix:** delete, or ask the owner for the real figure and its source. A number with no source is a defect.

## C4. Cute or empty system messages
**Tell:** "Oops! Something went wrong", "An error occurred", "Uh oh".
**Fix:** say what failed and the next step. Show the real cause if you have it.
was: *Oops! Something went wrong.* now: *Payment not taken: card expired. Enter a different card.*
**Earned when:** the owner has chosen a playful voice for this product.

## C5. Emoji or sparkle on headings, buttons and list items
**Fix:** remove. In the page count above, 2% of real hero sections had one.

## C6. Buttons that promise nothing
**Tell:** "Get Started Today", "Learn More", "Submit", "Click here".
**Fix:** a verb and its object, naming what happens next: *Send message*, *Create invoice*.
**Earned when:** "Get started" on a plain sign-up.

## C7. Chatter the screen does not need
**Tell:** greetings, taglines, motivational lines, status chatter, text that explains what the app is.
**His words (in a prompt he sent, codex #999):** "NO filler or generic AI copy. Banned examples: "Welcome back, Ben", "Good morning", "Your semester in one place", "Here's what's on your plate", "All 5 classes connected", "Magic Canvas can make mistakes", taglines, marketing lines, motivational text, status chatter, explanations of what the app is." And: "Labels of 1–3 words. No paragraphs." "Show real student content only".
**Fix:** delete the line. Show the user's real content in its place. A feeling is carried by the design, never stated in words.

## C8. Reframes and sweeps
**Tell:** "It's not just X, it's Y", "More than just", "Whether you're a student, a teacher or a parent", "In today's fast-paced world".
**Fix:** state Y. Name the one real audience.

## C9. Trusted-partner abstractions
**Tell:** "Your trusted partner", "Tailored to your unique needs", "Measurable results".
**Fix:** how it works, the first step, how long it takes. Or cut.

## C10. Success and loading filler
**Tell:** "Success! Your changes have been saved successfully.", "Working our magic...", "Hang tight".
**Fix:** *Saved.* For loading, say what is loading.

## C11. Empty state as a cheer
**Tell:** "Nothing here yet! Start your journey."
**Fix:** why it is empty and the one action that fills it: *No invoices yet.* plus a *Create invoice* button. The owner asked for "a small message" on a day with no events (codex #1365).

## C12. Stale boilerplate
**Tell:** a hard-coded copyright year, placeholder logos, lorem ipsum.
**Fix:** compute the year at build time. Remove placeholders or mark them as empty slots.

## Always
No em dashes: "never use any em dashes in the ui ever." (codex #1365).

## Not covered here
How a page looks (purple gradients, three icon cards, soft shadows) belongs to the UI loop, not to this skill.
