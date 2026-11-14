# Research

`research/ben/` and `research/nate/` each belong to one person and that person's agents. Write only in your own folder, so two people or agents never edit the same file. Inside your folder, file each note under a feature slug from [features/](../features/), or under `cross-cutting/` when it spans several. To read everything about one feature: `ls research/*/measure`.

## A note

Start every note with:

```
# <question it answers>
Researched <date> by <person> (<agent/model if any>). Feature: <slug>.
```

Then:
- **Give each reference a job:** evidence, interaction, visual direction, implementation mechanism, or a weak preference signal. Say what we would take from it.
- **Mark every claim:** *observed* (you opened the source and it says so), *asserted* (the source claims it without showing it, or you're working from memory), or *inferred* (your own reasoning). Unopened links are labelled as unopened.
- **Prefer the rawest source:** docs, code, papers and the product itself, ahead of articles about them. Check the dates, since things change fast.
- **Mark the limits:** a narrow search does not prove something doesn't exist.

A finding that changes the product goes into the feature page as a one-line summary with a link back to the note, never as a copy.
