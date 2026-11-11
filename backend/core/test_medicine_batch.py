from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import Facility, Medicine, MedicineRequest, StaffActivity, StaffProfile, User
from .serializers import MedicineRequestSerializer


@override_settings(ALLOWED_HOSTS=["testserver"])
class MedicineBatchTests(TestCase):
    def setUp(self):
        self.facility = Facility.objects.create(name="Batch BHC", facility_type="bhc")
        self.user = User.objects.create_user(username="batch-bhc", role="bhc")
        StaffProfile.objects.create(user=self.user, facility=self.facility)
        self.medicines = [Medicine.objects.create(name=name) for name in ("Paracetamol", "Metformin")]
        self.items = [{"medicine": medicine.pk, "quantity": 12} for medicine in self.medicines]
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def post(self, items):
        return self.client.post("/api/medicine-requests/batch/", {"items": items}, format="json")

    def test_batch_creates_separate_pending_requests_with_account_ownership(self):
        response = self.post(self.items)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(len(response.data), 2)
        self.assertEqual(StaffActivity.objects.count(), 2)
        for item in MedicineRequest.objects.all():
            self.assertEqual(item.requested_by, self.user)
            self.assertEqual(item.source_facility, self.facility)
            self.assertEqual(item.status, "requested")
            self.assertEqual(item.quantity, 12)

    def test_invalid_quantity_or_medicine_saves_nothing(self):
        for changes in ({"quantity": 0}, {"quantity": 1001}, {"quantity": 1.5}, {"medicine": 999999}):
            response = self.post([self.items[0], {**self.items[1], **changes}])
            self.assertEqual(response.status_code, 400, response.data)
            self.assertEqual(MedicineRequest.objects.count(), 0)

    def test_empty_duplicates_and_unexpected_fields_rejected(self):
        for items in ([], [self.items[0]] * 2, [{**self.items[0], "status": "approved"}], [self.items[0]] * 101, [None]):
            self.assertEqual(self.post(items).status_code, 400)
        self.assertEqual(MedicineRequest.objects.count(), 0)

    def test_only_bhc_can_submit(self):
        for role in ("cho", "pharmacist", "patient"):
            self.user.role = role
            self.user.save()
            self.assertEqual(self.post(self.items).status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.post(self.items).status_code, 401)
        self.assertEqual(MedicineRequest.objects.count(), 0)

    def test_create_failure_rolls_back_whole_batch(self):
        original_create = MedicineRequestSerializer.create
        calls = 0

        def failing_create(serializer, data):
            nonlocal calls
            calls += 1
            if calls == 2:
                raise RuntimeError("Simulated failure")
            return original_create(serializer, data)

        with patch.object(MedicineRequestSerializer, "create", failing_create):
            with self.assertRaises(RuntimeError):
                self.post(self.items)
        self.assertEqual(MedicineRequest.objects.count(), 0)
        self.assertEqual(StaffActivity.objects.count(), 0)
