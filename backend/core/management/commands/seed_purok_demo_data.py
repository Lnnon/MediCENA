import random

from django.core.management.base import BaseCommand, CommandError
from django.db import connections, transaction

from .seed_outbreak_mock_data import month_start


class Command(BaseCommand):
    help = "Add identifiable demo disease cases to every GIS purok without changing existing cases."

    def handle(self, *args, **options):
        rng = random.Random(20261107)
        inserted = 0
        with transaction.atomic(using="gis"), connections["gis"].cursor() as cursor:
            cursor.execute("SELECT fid FROM puroks ORDER BY fid")
            puroks = [row[0] for row in cursor.fetchall()]
            if not puroks:
                raise CommandError("No GIS puroks found.")
            cursor.execute("LOCK TABLE diseases, disease_cases IN EXCLUSIVE MODE")
            cursor.execute("SELECT COALESCE(MAX(id), 0) FROM diseases")
            disease_id = cursor.fetchone()[0]
            cursor.execute("SELECT COALESCE(MAX(id), 0) FROM disease_cases")
            case_id = cursor.fetchone()[0]
            for name in ("Dengue", "Diarrhea", "Common Cold", "Cough and Fever"):
                label = "[DEMO] " + name
                cursor.execute("SELECT id FROM diseases WHERE disease_name = %s", [label])
                existing = cursor.fetchone()
                if existing:
                    current_id = existing[0]
                else:
                    disease_id += 1
                    current_id = disease_id
                    cursor.execute(
                        "INSERT INTO diseases (id, disease_name, category) VALUES (%s, %s, %s)",
                        [current_id, label, "Synthetic demo data"],
                    )
                for fid in puroks:
                    # A deterministic range makes hotspots varied and repeatable.
                    baseline = rng.randint(1, 12)
                    for months_ago in range(11, -1, -1):
                        day = month_start(months_ago)
                        cases = baseline + rng.randint(0, 8)
                        cursor.execute(
                            "SELECT 1 FROM disease_cases WHERE disease_id=%s AND purok_fid=%s AND case_date=%s",
                            [current_id, fid, day],
                        )
                        if cursor.fetchone():
                            continue
                        case_id += 1
                        cursor.execute(
                            "INSERT INTO disease_cases (id, disease_id, purok_fid, case_date, total_cases) VALUES (%s,%s,%s,%s,%s)",
                            [case_id, current_id, fid, day, cases],
                        )
                        inserted += 1
        self.stdout.write(self.style.SUCCESS(
            f"Added {inserted} demo records: 4 demo conditions across {len(puroks)} puroks and 12 months. Existing records preserved."
        ))
