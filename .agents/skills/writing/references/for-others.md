# Writing for other people

For technical prose that goes out to other people (README, PR text, docs, posts), the fuller catalogue is the declauding register: https://github.com/oaustegard/claude-skills, MIT licensed. Its entries are not copied here. Read its register when the text matters.

## Starter tells

Run `python3 scripts/lint.py --surface prose FILE`. Each hit is a candidate.

- **P1, "it's not X, it's Y" or "not just X but Y."** State what the thing is. Drop the denied alternative unless the reader held it.
- **P2, three adjectives or three parallel phrases.** Keep the ones that carry a fact. Usually that is one.
- **P3, hedging stacks ("arguably", "in many ways", "it's worth noting").** Say it, or say how sure you are once, with the reason.
- **P4, summary closers ("In conclusion", "Ultimately", "At the end of the day").** End on the last useful sentence.
- **P5, chatbot residue ("I hope this", "As an AI", "Certainly!").** Delete it. The text starts at the content.
- **P6, title-case verdict headers with a colon.** Use a plain heading that names the topic.

The lint also applies O3 (wording), O5 (flattery) and O13 (dashes) to prose.

## Two rules

- Never add a fact that was not in the source.
- Ask before rewriting someone else's finished writing.
