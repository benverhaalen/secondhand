# secondhand

Buy and sell used things across every marketplace from one app. You take a few guided photos and the app measures, identifies, prices and photographs the item. It then lists the item where it will sell best and handles the buyers. On the buying side, it watches every platform for the thing you want. Built by Ben and Nate at MadHacks 2026.

## Where things are

| Path | What it holds | Who writes it |
|---|---|---|
| [product/vision.md](product/vision.md) | The living vision: what is decided, proposed and still open | Both; every line names who said it |
| [product/features.md](product/features.md) | Every feature with its status and owner | Both |
| [product/decisions.md](product/decisions.md) | Dated log of what Ben and Nate agreed | Both |
| [product/pitch.md](product/pitch.md) | How secondhand is pitched: the problem in numbers, five narratives, the recommended order | Both; *agent proposal* until picked |
| [product/words.md](product/words.md) | Ben's and Nate's exact product words, the source everything else cites | Append only |
| [features/](features/) | One living page per feature | Whoever owns the feature |
| [research/](research/README.md) | Raw research: `research/<slug>/ben/` and `research/<slug>/nate/` | Each person's subfolder: only that person and their agents |
| [AGENTS.md](AGENTS.md) | How agents decide, research and build here, by situation | Both |
| [.agents/](.agents/coordination.md) | Handoffs, git rules, the skills (`skills/`) and the checks (`node .agents/check.mjs`) | Agents |

A feature has one slug everywhere. For example, `measure` is used in `features/measure/`, `research/measure/` and the packet topic `.agents/team/packets/measure/`.
