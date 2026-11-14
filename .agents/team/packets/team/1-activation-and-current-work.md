# 1 — Activate coordination and share current work

Updated: November 14, 2026. Owner: Ben. Status: active. Source: [Ben's words](../../sources.md#adopting-this-setup--november-14-2026).

## One-time activation for an existing Claude/Codex session

After safely pulling, read `AGENTS.md` and `.agents/coordination.md` once. There are no automatic hooks. Read relevant packet files directly or use the optional manual checker (`node .agents/team-sync.mjs check --session TASK_ID --force`). Pulling alone does not prove the current agent loaded instructions. Keep the current task; read only relevant packets.

Create a small work packet with your human owner, agent, branch/base commit, scope/shared interfaces, and next useful handoff. Ask your human directly about conflicting human direction so teammates can discuss it in person.

Check at natural work boundaries roughly every few minutes; this is written guidance, not an enforced timer. The checker throttles repeated calls to five minutes. It reads remote packet metadata from `main`; content is retrieved on demand. It does not monitor idle agents, upload logs, merge files, or publish on your behalf.

Follow the [git rules](../../../coordination.md#git-rules).
