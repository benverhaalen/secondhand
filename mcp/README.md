# secondhand MCP server

Gives any agent that speaks the Model Context Protocol (Claude Code, Claude Desktop, Codex, and others) the secondhand search engine: one query across Depop, eBay, Poshmark, Mercari and cross-site indexes, with the price spread and the cheapest listing on each site.

## Tools

| Tool | What it does |
|---|---|
| `search_secondhand` | `query`, optional `sources` (ids from `list_sources`, or `osint`), optional `max_results` (default 20). Returns the listings and a summary: count, price spread (p25, median, p75 in cents, in the listings' most common currency) and the cheapest listing per site. Also returns `search_job_id`. |
| `ask_market` | `question`, optional `search_job_id` from an earlier search. Returns the answer, the listings it cites and its web sources. If the host has no model key, it says so (`unavailable`, reason `not_configured`). |
| `list_sources` | The source ids, and which sites each one covers. |

All three tools are read-only. A failure comes back as a tool error that carries the server's code and message, and says when to retry: a rate limit gives `rate_limited ... Retry after 60 seconds.` The API allows each address about 30 requests a minute, and a search costs two of them (the request plus its event stream).

## Install

Requires Node 22.18 or later.

```sh
git clone https://github.com/benverhaalen/secondhand.git
cd secondhand/mcp
npm install        # also builds dist/
npm test           # optional: runs against a local fake API, no network
```

## Configure

`SECONDHAND_API_ORIGIN` chooses the API. The default is `https://secondhand-api.fly.dev`. For a local server, use for example `http://127.0.0.1:8794`. No key is needed: the server starts a visitor session on its first call.

Claude Code:

```sh
claude mcp add secondhand -- node /absolute/path/to/secondhand/mcp/dist/index.js
# against a local API
claude mcp add secondhand -e SECONDHAND_API_ORIGIN=http://127.0.0.1:8794 -- node /absolute/path/to/secondhand/mcp/dist/index.js
```

Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "secondhand": {
      "command": "node",
      "args": ["/absolute/path/to/secondhand/mcp/dist/index.js"],
      "env": { "SECONDHAND_API_ORIGIN": "https://secondhand-api.fly.dev" }
    }
  }
}
```

Codex (`~/.codex/config.toml`):

```toml
[mcp_servers.secondhand]
command = "node"
args = ["/absolute/path/to/secondhand/mcp/dist/index.js"]
env = { SECONDHAND_API_ORIGIN = "https://secondhand-api.fly.dev" }
```

On Windows, write the path as `C:/path/to/secondhand/mcp/dist/index.js` or with escaped backslashes in JSON.

## How it works

`search_secondhand` posts to `POST /v1/search`, reads the job's event stream (`GET /v1/jobs/:id/events`) until the terminal `job.state`, and summarizes `result.results`. If the stream drops, it resumes with `Last-Event-ID`. `ask_market` does the same with `POST /v1/assist` and the `assist.settled` event. The visitor id the API issues (`X-Visitor-Id`) lasts for the life of the process. That is why a `search_job_id` works in `ask_market` from the same running server.

The source list in `list_sources` is fixed in this package (`src/tools.ts`). The API still has the final say on which sources a search reads.
