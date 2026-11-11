from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import Facility, Medicine, MedicineInventory, StaffProfile, User


@override_settings(ALLOWED_HOSTS=["testserver"])
class InventoryCatalogTests(TestCase):
    def setUp(self):
        self.facility = Facility.objects.create(name="Catalog CHO", facility_type="cho", address="Lucena")
        self.user = User.objects.create_user(username="catalog-pharmacist", role="pharmacist")
        StaffProfile.objects.create(user=self.user, facility=self.facility, position="Pharmacist")
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.payload = {"formulation_verified": True, "medicine_name": "Metformin", "category": "Anti-diabetics", "medicine_type": "Tablet", "dosage": "500mg", "quantity": 12, "issued_date": "2026-11-01", "expiry_date": "2028-11-01"}

    def test_save_list_duplicate_and_edit(self):
        saved = self.client.post("/api/medicine-inventory/", self.payload, format="json")
        self.assertEqual(saved.status_code, 201, saved.data)
        self.assertEqual(saved.data["medicine_detail"]["name"], "Metformin")
        self.assertEqual(saved.data["medicine_detail"]["category"], "Anti-diabetics")
        self.assertEqual(saved.data["quantity"], 12)
        listed = self.client.get("/api/medicine-inventory/")
        self.assertIn(saved.data["id"], [row["id"] for row in listed.data])
        repeated = self.client.post("/api/medicine-inventory/", self.payload, format="json")
        self.assertEqual(repeated.status_code, 400, repeated.data)
        self.assertEqual(MedicineInventory.objects.count(), 1)
        self.assertEqual(Medicine.objects.count(), 1)
        updated = self.client.patch(f'/api/medicine-inventory/{saved.data["id"]}/', {**self.payload, "quantity": 20}, format="json")
        self.assertEqual(updated.status_code, 200, updated.data)
        self.assertEqual(updated.data["quantity"], 20)

    def test_invalid_name_category_stock_and_dosage(self):
        for changes in [{"medicine_name": "Unlisted"}, {"category": "Anti-infectious"}, {"quantity": -1}, {"dosage": "invalid"}]:
            response = self.client.post("/api/medicine-inventory/", {**self.payload, **changes}, format="json")
            self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(MedicineInventory.objects.count(), 0)

    def test_old_category_alias_is_accepted(self):
        response = self.client.post("/api/medicine-inventory/", {**self.payload, "medicine_name": "Paracetamol", "category": "Analgesic"}, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["medicine_detail"]["category"], "Supportive/Other Therapy")

    def test_unchanged_legacy_medicine_can_be_edited(self):
        medicine = Medicine.objects.create(name="Legacy Medicine", category="Old Category", medicine_type="Tablet", dosage="500mg")
        inventory = MedicineInventory.objects.create(facility=self.facility, medicine=medicine, quantity=1)
        response = self.client.patch(f"/api/medicine-inventory/{inventory.pk}/", {**self.payload, "medicine_name": "Legacy Medicine", "category": "Old Category"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)


    def test_complete_catalog_seed_is_idempotent_and_preserves_stock(self):
        from django.core.management import call_command
        from .medicine_catalog import MEDICINE_CATALOG
        from .models import MedicineCatalogEntry
        from collections import Counter
        self.assertEqual(len(MEDICINE_CATALOG), 75)
        self.assertEqual(len({item["name"].lower() for item in MEDICINE_CATALOG}), 75)
        self.assertEqual(list(Counter(item["category"] for item in MEDICINE_CATALOG).values()), [21, 2, 8, 18, 3, 4, 18, 1])
        for item in MEDICINE_CATALOG:
            self.assertTrue(all(p["verified"] is False for p in item["reference_presentations"]))
        saved = self.client.post("/api/medicine-inventory/", self.payload, format="json")
        before = list(MedicineInventory.objects.values())
        call_command("seed_medicine_catalog", verbosity=0)
        call_command("seed_medicine_catalog", verbosity=0)
        self.assertEqual(MedicineCatalogEntry.objects.count(), 75)
        self.assertEqual(before, list(MedicineInventory.objects.values()))
        self.assertEqual(saved.status_code, 201)

    def test_distinct_formulations_and_verification(self):
        first = self.client.post("/api/medicine-inventory/", self.payload, format="json")
        self.assertEqual(first.status_code, 201, first.data)
        other = self.client.post("/api/medicine-inventory/", {**self.payload, "dosage": "850 mg"}, format="json")
        self.assertEqual(other.status_code, 201, other.data)
        self.assertNotEqual(first.data["medicine"], other.data["medicine"])
        rejected = self.client.post("/api/medicine-inventory/", {**self.payload, "formulation_verified": False}, format="json")
        self.assertEqual(rejected.status_code, 400)
        invalid_date = self.client.post("/api/medicine-inventory/", {**self.payload, "expiry_date": "2026-01-01"}, format="json")
        self.assertEqual(invalid_date.status_code, 400)

    def test_edit_date_preserves_other_facility_stock(self):
        first = self.client.post("/api/medicine-inventory/", self.payload, format="json")
        other = Facility.objects.create(name="Other facility", facility_type="bhc", address="Lucena")
        stock = MedicineInventory.objects.create(facility=other, medicine_id=first.data["medicine"], quantity=25)
        updated = self.client.patch(f'/api/medicine-inventory/{first.data["id"]}/', {**self.payload, "expiry_date": "2029-11-01"}, format="json")
        self.assertEqual(updated.status_code, 200, updated.data)
        stock.refresh_from_db()
        self.assertEqual(stock.quantity, 25)
        self.assertEqual(str(stock.medicine.expiry_date), "2028-11-01")
