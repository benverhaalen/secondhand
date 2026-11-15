# Workspace checks (T0-1)

Written by `python probes/workspace/run.py`; profile `Nate`, workspace id `7474651613371474`. Each row is one probe's dated verdict; a fail records what was seen and the fallback. No token, cookie or secret appears here.

| Probe | Verdict | At (Central) | What was seen | Measured |
|---|---|---|---|---|
| edition | pass | 2026-11-14T21:55:36-06:00 | looks like Free Edition (no apps, no Lakebase, no classic clusters, only open-model endpoints). answered: {'apps': 0, 'lakebase_autoscaling': 0, 'lakebase_provisioned': 0, 'serving_endpoints': 11, 'warehouses': 1, 'clusters': 0, 'secret_scopes': 0, 'vector_search': 0, 'catalogs': 3}; refused: none; endpoints only open models: True | {"features": {"apps": 0, "lakebase_autoscaling": 0, "lakebase_provisioned": 0, "serving_endpoints": 11, "warehouses": 1, "clusters": 0, "secret_scopes": 0, "vector_search": 0, "catalogs": 3}} |
| gateway_models | fail | 2026-11-14T21:55:43-06:00 | wanted ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-sonnet-5']; present []; answered none; missing ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-sonnet-5']; endpoints on workspace: ['databricks-gpt-oss-120b', 'databricks-gpt-oss-20b', 'databricks-qwen3-next-80b-a3b-instruct', 'databricks-qwen35-122b-a10b', 'databricks-gemma-3-12b', 'databricks-gte-large-en', 'databricks-bge-large-en', 'databricks-meta-llama-3-1-8b-instruct', 'databricks-meta-llama-3-3-70b-instruct', 'databricks-qwen3-embedding-0-6b', 'databricks-llama-4-maverick'] | {"answered": {}} |
| open_model_answers | pass | 2026-11-14T21:55:43-06:00 | databricks-gpt-oss-120b answered | {"ms": 718, "endpoint": "databricks-gpt-oss-120b"} |
| sql_warehouse | pass | 2026-11-14T21:55:43-06:00 | warehouse Serverless Starter Warehouse (STOPPED before) -> statement SUCCEEDED | {"first_statement_ms": 6078, "was": "STOPPED"} |
| secret_scope | fail | 2026-11-14T21:55:43-06:00 | no secondhand scope (scopes: none); create needs --allow-create |  |
| lakebase | fail | 2026-11-14T21:55:43-06:00 | no Lakebase project (projects: none); wake-from-zero and RLS need --allow-create. Fallback: the in-memory or SQL-warehouse-backed store behind the same interface |  |
| apps_front_door | fail | 2026-11-14T21:55:43-06:00 | no probe app (apps: none); the front door checks need --allow-create |  |
| hosted_browser | fail | 2026-11-14T21:55:43-06:00 | not run: a one-time serverless run needs --allow-create. If no: the own-compute host bp-1 names runs the browser pool |  |
| agent_bricks | fail | 2026-11-14T21:55:43-06:00 | no agent endpoint on the workspace; one Agent Bricks agent with an MLflow trace needs a full workspace with Agent Bricks enabled |  |
