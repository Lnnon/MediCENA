import json
from pathlib import Path

# Shared with the frontend selector; independent of medicine stock records.
MEDICINE_CATALOG = json.loads(Path(__file__).with_name("medicine_catalog.json").read_text(encoding="utf-8"))
MEDICINE_NAMES = frozenset(item["name"] for item in MEDICINE_CATALOG)
