# Run traces

One trace per observed run, written by `node scripts/runs.mjs record <task> --log <file>...` from log/ JSON-lines files and read back with `node scripts/runs.mjs last <task>`. A file is `<task>.md`; characters outside letters, digits, `.`, `_` and `-` in the id become `_`. A new record replaces the old trace.

A trace has the steps with time since the previous line and the total, each event's fields against `spec/events.json`, what was missing, and the contract problems the checker found. It holds event names, ids and flags only, and the text is passed through log/'s masker.
