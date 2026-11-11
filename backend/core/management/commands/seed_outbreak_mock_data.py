import math
import random
from datetime import date

from django.core.management.base import BaseCommand
from django.db import connections
from django.utils import timezone


OUTBREAK_PATTERNS = {
    "Dengue": {
        "base": 5,
        "peak_months": {6, 7, 8, 9, 10},
        "peak_multiplier": 4.2,
        "trend": 1.12,
    },
    "Leptospirosis": {
        "base": 2,
        "peak_months": {7, 8, 9, 10},
        "peak_multiplier": 3.4,
        "trend": 1.08,
    },
    "Measles": {
        "base": 1,
        "peak_months": {1, 2, 3, 4},
        "peak_multiplier": 2.6,
        "trend": 0.95,
    },
    "Cholera": {
        "base": 1,
        "peak_months": {6, 7, 8, 9},
        "peak_multiplier": 2.8,
        "trend": 1.04,
    },
    "Typhoid Fever": {
        "base": 2,
        "peak_months": {5, 6, 7, 8, 9},
        "peak_multiplier": 2.4,
        "trend": 1.03,
    },
    "Influenza-like Illness": {
        "base": 4,
        "peak_months": {6, 7, 12, 1, 2},
        "peak_multiplier": 2.7,
        "trend": 1.06,
    },
    "COVID-19": {
        "base": 2,
        "peak_months": {1, 6, 7, 12},
        "peak_multiplier": 2.1,
        "trend": 0.9,
    },
    "Hand, Foot and Mouth Disease": {
        "base": 2,
        "peak_months": {3, 4, 5, 9, 10},
        "peak_multiplier": 2.3,
        "trend": 1.05,
    },
}

DISEASE_ALIASES = {
    "Influenza-like Illness": ["Influenza-like Illness", "Influenza"],
}

DISEASE_CATEGORIES = {
    "Cholera": "Waterborne disease",
    "Hand, Foot and Mouth Disease": "Communicable disease",
    "Influenza-like Illness": "Respiratory disease",
}


def month_start(months_ago):
    today = timezone.localdate()
    month_index = today.year * 12 + today.month - 1 - months_ago
    year = month_index // 12
    month = month_index % 12 + 1
    return date(year, month, 1)


class Command(BaseCommand):
    help = "Seed 36 months of mock outbreak disease cases for GIS analytics and medicine demand forecasting."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete existing GIS disease_cases before seeding mock outbreak data.",
        )

    def handle(self, *args, **options):
        random.seed(20260617)

        with connections["gis"].cursor() as cursor:
            if options["reset"]:
                cursor.execute("DELETE FROM disease_cases")

            cursor.execute("SELECT id, disease_name FROM diseases")
            existing_diseases = {name.lower(): disease_id for disease_id, name in cursor.fetchall()}
            cursor.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM diseases")
            next_disease_id = cursor.fetchone()[0]
            disease_lookup = {}

            for disease_name in OUTBREAK_PATTERNS:
                aliases = DISEASE_ALIASES.get(disease_name, [disease_name])
                matched_id = next((existing_diseases.get(alias.lower()) for alias in aliases if existing_diseases.get(alias.lower())), None)

                if matched_id:
                    disease_lookup[disease_name] = matched_id
                    continue

                cursor.execute(
                    """
                    INSERT INTO diseases (id, disease_name, category)
                    VALUES (%s, %s, %s)
                    """,
                    [next_disease_id, disease_name, DISEASE_CATEGORIES.get(disease_name, "Communicable disease")],
                )
                existing_diseases[disease_name.lower()] = next_disease_id
                disease_lookup[disease_name] = next_disease_id
                next_disease_id += 1

            cursor.execute(
                """
                SELECT fid, barangay, purok_name
                FROM puroks
                ORDER BY barangay, purok_name
                LIMIT 18
                """
            )
            puroks = cursor.fetchall()

            if not disease_lookup:
                self.stderr.write("No outbreak diseases found in GIS diseases table.")
                return

            if not puroks:
                self.stderr.write("No puroks found in GIS puroks table.")
                return

            cursor.execute("SELECT COALESCE(MAX(id), 0) FROM disease_cases")
            next_id = cursor.fetchone()[0] + 1
            inserted = 0
            updated = 0

            for disease_name, pattern in OUTBREAK_PATTERNS.items():
                disease_id = disease_lookup.get(disease_name)
                if not disease_id:
                    continue

                for months_ago in range(35, -1, -1):
                    case_date = month_start(months_ago)
                    year_offset = 2 - (months_ago // 12)
                    seasonal_multiplier = pattern["peak_multiplier"] if case_date.month in pattern["peak_months"] else 1
                    trend_multiplier = pattern["trend"] ** year_offset

                    for purok_index, (purok_fid, _barangay, _purok_name) in enumerate(puroks):
                        hotspot_multiplier = 1.35 if purok_index % 5 == 0 else 1
                        noise = random.uniform(0.55, 1.45)
                        cases = int(
                            math.ceil(
                                pattern["base"]
                                * seasonal_multiplier
                                * trend_multiplier
                                * hotspot_multiplier
                                * noise
                            )
                        )

                        if cases <= 0:
                            continue

                        cursor.execute(
                            """
                            SELECT id
                            FROM disease_cases
                            WHERE disease_id = %s
                              AND purok_fid = %s
                              AND case_date = %s
                            LIMIT 1
                            """,
                            [disease_id, purok_fid, case_date],
                        )
                        existing = cursor.fetchone()

                        if existing:
                            cursor.execute(
                                """
                                UPDATE disease_cases
                                SET total_cases = %s
                                WHERE id = %s
                                """,
                                [cases, existing[0]],
                            )
                            updated += 1
                        else:
                            cursor.execute(
                                """
                                INSERT INTO disease_cases (id, disease_id, purok_fid, case_date, total_cases)
                                VALUES (%s, %s, %s, %s, %s)
                                """,
                                [next_id, disease_id, purok_fid, case_date, cases],
                            )
                            next_id += 1
                            inserted += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded outbreak mock data: {inserted} inserted, {updated} updated across 36 months."
            )
        )
