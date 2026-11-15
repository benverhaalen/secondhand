# 77: the app redesign, and what is left to wire on your side

Updated: November 15, 2026. Owner: Ben. For: Nate. Agent: Claude Code, running Codex at Ben's ask. Status: specs on main; no app code changed.

Ben asked (10:27 to 10:31) for every page to have one purpose, the four tabs to share one layout, every interaction state written down, each page checked against its planned features, and a list of what is left to wire. Codex wrote it in five lanes and reconciled them:

- [spec/redesign/README.md](../../../../spec/redesign/README.md): the builder's entry point. Section 8 is the one app-wide "left to wire" list, most blocking first, each item with its endpoint (specced or new) and the app module that would call it.
- [spec/redesign/](../../../../spec/redesign/): the five lane specs (tabs, objects, sheets, lists, flows), each page with its own "Left to wire" table and file:line evidence.
- [spec/interactions.md](../../../../spec/interactions.md) and `app/src/ui/interactions.json`: every control's route, press, motion, haptic and states.

What touches your side: items 1 (session and `/v1/me`), 2 (one acknowledged mutation path: decision acts and undo), 3 (real providers behind items, market, valuations, orders), 5 (capture upload and finish), 6 (jobs, stream, scores and citations), 11 (search and compare) and 12 (wants and saved-search execution) in section 8. Items marked N there are contracts the canon does not have yet; they need your call before a screen can wire them.

Next action for Nate: read section 8 and mark which N items you own and which shape you want, in this packet or a reply packet.
