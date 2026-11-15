# Website MCP link

Owner: Ben
Recipient: Nate, MCP server workstream
Date: 2026-11-15
Base: d736e7c7

Ben requested a GitHub logo and an adjacent `mcp` button in the public website header, with the MCP destination connected when the server is ready.

The header reads `web/public/services.json` at runtime with no cache. `mcp.url` is currently null, so the button is visible but disabled. Set that field to the verified public HTTPS connection-instructions page when the MCP server is available. Do not include credentials or tokens. This is the shared integration point; no component or stylesheet edit is needed. The deployed site must serve the updated JSON file. A repository push alone does not update a site without its deployment step.

Ben chose connection instructions as the destination. Do not link the header button directly to the raw server endpoint. The instructions page should explain how to connect, which clients are supported, and any authentication requirements, with the server endpoint available there to copy. Header and mobile menu use the same value. Invalid/non-HTTPS values leave the button disabled. Verified in an isolated browser with an injected configuration: replacing null with an HTTPS URL activates the link with exactly that destination. No real endpoint has been published or tested here.

Please include the final destination and its setup/auth requirements in the MCP handoff packet and set `mcp.url` as part of that delivery. Until then, the website does not claim that MCP is available.
