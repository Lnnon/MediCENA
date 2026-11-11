from django.core.management.base import BaseCommand
from django.db import transaction
from core.medicine_catalog import MEDICINE_CATALOG
from core.models import MedicineCatalogEntry


class Command(BaseCommand):
    help = "Idempotently load 75 GAMOT catalog entries; never create or change stock."

    @transaction.atomic
    def handle(self, *args, **options):
        for item in MEDICINE_CATALOG:
            MedicineCatalogEntry.objects.update_or_create(name=item["name"], defaults={
                "category": item["category"], "reference_presentations": item["reference_presentations"],
            })
        self.stdout.write(self.style.SUCCESS("Loaded 75 GAMOT catalog entries. No inventory changed."))
