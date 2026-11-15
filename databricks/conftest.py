"""Use the same local modules as the bundle tasks, without installing a package."""
import sys
import builtins
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'databricks'))
sys.path.insert(0, str(ROOT / 'log'))


@pytest.fixture
def serverless_entrypoint(monkeypatch):
    """Execute the workspace script without __file__, stopping at the Spark boundary."""
    class SparkReached(Exception):
        pass

    original_import = builtins.__import__

    def execute(relative, args, spark=True):
        namespace = {'__name__': '__main__'}
        monkeypatch.setattr(sys, 'argv', [relative, *args])
        monkeypatch.setattr(sys, 'path', sys.path.copy())

        def import_module(name, *args, **kwargs):
            if spark and name == 'pyspark.sql':
                raise SparkReached()
            return original_import(name, *args, **kwargs)

        monkeypatch.setattr(builtins, '__import__', import_module)
        code = compile((ROOT / relative).read_text(), relative, 'exec')
        if spark:
            with pytest.raises(SparkReached):
                exec(code, namespace)
        else:
            exec(code, namespace)
        return namespace

    return execute
