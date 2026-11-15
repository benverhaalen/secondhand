"""The Delta and volume half of delete_user: remove a person's rows from every table in the schema with a user_id column, then their captures."""
import re
import sys

user_id, catalog, schema = sys.argv[1], sys.argv[2], sys.argv[3]
if not re.fullmatch(r"usr_[A-Za-z0-9]+", user_id):
    raise SystemExit(f"refused: {user_id!r} is not a user id")

from pyspark.sql import SparkSession  # noqa: E402

spark = SparkSession.builder.getOrCreate()
left = {}
for t in spark.sql(f"show tables in `{catalog}`.`{schema}`").collect():
    name = f"`{catalog}`.`{schema}`.`{t.tableName}`"
    if "user_id" in [c.name for c in spark.table(name).schema]:
        spark.sql(f"delete from {name} where user_id = :u", args={"u": user_id})
        left[t.tableName] = spark.sql(f"select count(*) n from {name} where user_id = :u", args={"u": user_id}).first().n
path = f"/Volumes/{catalog}/{schema}/captures/{user_id}"
try:
    from databricks.sdk import WorkspaceClient

    w = WorkspaceClient()
    stack = [path]
    while stack:  # delete files depth first, then directories
        d = stack.pop()
        for e in w.files.list_directory_contents(d):
            (stack.append(e.path) if e.is_directory else w.files.delete(e.path))
        w.files.delete_directory(d) if d != path else None
except Exception as e:  # noqa: BLE001 - a missing folder means nothing was captured
    print(f"captures: {type(e).__name__}")
print({"user_id": user_id, "rows_left": left, "zero": all(v == 0 for v in left.values())})
if any(left.values()):
    raise SystemExit("rows remain after delete")
