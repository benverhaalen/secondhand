"""Use the same local modules as the bundle tasks, without installing a package."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'databricks'))
sys.path.insert(0, str(ROOT / 'log'))
