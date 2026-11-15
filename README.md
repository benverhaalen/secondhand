# secondhand

Buy and sell used things across every marketplace from one app. You take a few guided photos and the app measures, identifies, prices and photographs the item. It then lists the item where it will sell best and handles the buyers. On the buying side, it watches every platform for the thing you want. Built by Ben and Nate at MadHacks 2026.

## Where things are

| Path | What it holds | Who writes it |
|---|---|---|
| [product/vision.md](product/vision.md) | The living vision: what is decided, proposed and still open | Both; every line names who said it |
| [product/features.md](product/features.md) | Every feature with its status and owner | Both |
| [product/decisions.md](product/decisions.md) | Dated log of what Ben and Nate agreed | Both |
| [product/pitch.md](product/pitch.md) | How secondhand is pitched: the problem in numbers, five narratives, the recommended order | Both; *agent proposal* until picked |
| [product/pitch-constitution.md](product/pitch-constitution.md) | How secondhand is told: the ends, the three ideas, how we think, the one-jacket example each judge's field recognizes, and the rules | Agents; *agent proposal* |
| [product/qa.md](product/qa.md) | The hard questions judges and users ask, the answers, and the honesty gate before saying any of them; [faq.md](product/faq.md) is the website's version | Agents; *agent proposal* until said |
| [product/business.md](product/business.md) | Why people want it, why it's free and how that pays, where we reach and don't, the hurdles | Agents; *agent proposal* |
| [product/showcase.md](product/showcase.md) | What each audience looks for, how we use Databricks with the status of each piece, the full demo script for buying and selling, pricing anything, and what "hot" means | Agents; *agent proposal* |
| [product/demo-reel.md](product/demo-reel.md) | The feature clips and the basement demos, how to show how it works, and faster demo loops for the website and app | Agents; *agent proposal* |
| [product/theme.md](product/theme.md) | The MadHacks theme "Let's dig in": its likely source, each way to read it, where secondhand fits, and the lines to say | Agents; *agent proposal* |
| [product/unique.md](product/unique.md) | What we did that we haven't seen elsewhere, ranked, with what others do and how to show each in five seconds | Agents; *agent proposal* |
| [product/proof-without-sales.md](product/proof-without-sales.md) | How to prove it works with no sales yet: a sale broken into parts, each with its proof, ranked by what can run before 1 pm | Agents; *agent proposal* |
| [product/devpost.md](product/devpost.md) | The Devpost write-up draft | Agents; *agent proposal* |
| [product/pitch-video.md](product/pitch-video.md) | The submission video: script, shot list, how to make it fast | Agents |
| [product/words.md](product/words.md) | Ben's and Nate's exact product words, the source everything else cites | Append only |
| [features/](features/) | One living page per feature | Whoever owns the feature |
| [spec/](spec/README.md) | The canon, one spec per feature, the engines, the method cards, the build plans, and the checked model of an item's life | Agents propose; Ben and Nate decide |
| [docs/how-it-works/](docs/how-it-works/README.md) | The system explained for people: how we price, market, prove and compare | Agents |
| [app/](app/README.md) | The Expo app and its server routes | Screens Ben, routes Nate |
| [ideas/](ideas/README.md) | Ideas for after the product works, one file each, sorted | Both |
| [research/](research/README.md) | Raw research: `research/<slug>/ben/` and `research/<slug>/nate/` | Each person's subfolder: only that person and their agents |
| [log/](log/README.md) | The logger every program writes through, the steps to wire each one, and how to read a log | Agents |
| [AGENTS.md](AGENTS.md) | How agents decide, research and build here, by situation | Both |
| [.agents/](.agents/coordination.md) | Handoffs, git rules, the skills (`skills/`) and the checks (`node .agents/check.mjs`) | Agents |

A feature has one slug everywhere. For example, `measure` is used in `features/measure/`, `research/measure/` and the packet topic `.agents/team/packets/measure/`.
