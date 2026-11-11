from datetime import timedelta
from types import SimpleNamespace

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from .medicine_catalog import MEDICINE_CATALOG, MEDICINE_NAMES
from .models import Facility, PatientProfile, User
from .serializers import PatientMedicineRequestSerializer, PatientProfileSerializer


@override_settings(ALLOWED_HOSTS=["testserver"])
class PatientFormTests(TestCase):
    def test_philhealth_number_limit_applies_to_patient_and_dependent(self):
        serializer = PatientProfileSerializer()
        for value in ["", "123456789012", "12345"]:
            self.assertEqual(serializer.validate_philhealth_id(value), value)
            self.assertEqual(serializer.validate_dependent_information({"phic_id": value})["phic_id"], value)
        for value in ["1234567890123", "123-456", "abc"]:
            with self.assertRaises(ValidationError):
                serializer.validate_philhealth_id(value)
            with self.assertRaises(ValidationError):
                serializer.validate_dependent_information({"phic_id": value})

    def test_contact_number_allows_at_most_11_digits(self):
        serializer = PatientProfileSerializer()
        for value in ["", "09123456789", "12345"]:
            self.assertEqual(serializer.validate_contact_number(value), value)
        for value in ["091234567890", "09123abc", "+639123456789"]:
            with self.assertRaises(ValidationError):
                serializer.validate_contact_number(value)

    def setUp(self):
        self.facility = Facility.objects.create(name="Patient Form CHO", facility_type="cho", address="Lucena")
        self.admin = User.objects.create_user(username="forms-admin", role="cho")
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def test_dependent_saved_separately_and_preserved_when_status_changes(self):
        response = self.client.post("/api/patient-profiles/", {
            "first_name": "Primary", "last_name": "Patient", "philhealth_status": "Dependent",
            "primary_facility": self.facility.pk,
            "dependent_information": {"first_name": "Dependent", "last_name": "Person", "suffix": "Jr.",
                                      "date_of_birth": "2015-01-02", "member_type": "Dependent", "sex": "Female"},
        }, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        patient = PatientProfile.objects.get(pk=response.data["id"])
        self.assertEqual(patient.user.first_name, "Primary")
        self.assertEqual(patient.dependent_information["first_name"], "Dependent")
        self.assertEqual(patient.dependent_information["date_of_birth"], "2015-01-02")
        updated = self.client.patch(f"/api/patient-profiles/{patient.pk}/", {"philhealth_status": "Member"}, format="json")
        self.assertEqual(updated.status_code, 200, updated.data)
        patient.refresh_from_db()
        self.assertEqual(patient.dependent_information["first_name"], "Dependent")

    def test_dependent_rejects_future_birth_date_and_invalid_sex(self):
        serializer = PatientProfileSerializer()
        for data in [{"sex": "Invalid"}, {"date_of_birth": (timezone.localdate() + timedelta(days=1)).isoformat()}]:
            with self.assertRaises(ValidationError):
                serializer.validate_dependent_information(data)

    def test_catalog_has_exactly_75_unique_medicines(self):
        self.assertEqual(len(MEDICINE_CATALOG), 75)
        self.assertEqual(len(MEDICINE_NAMES), 75)
        self.assertEqual(len({item["category"] for item in MEDICINE_CATALOG}), 8)

    def test_new_patient_request_restricts_medicine_names(self):
        request = SimpleNamespace(method="POST", user=SimpleNamespace(role="patient", is_authenticated=True))
        serializer = PatientMedicineRequestSerializer(context={"request": request})
        for medicine in ["Unlisted Medicine", ""]:
            with self.assertRaises(ValidationError):
                serializer.validate({"medicine_name": medicine, "prescription": object()})
        valid = serializer.validate({"medicine_name": "Paracetamol", "prescription": object()})
        self.assertEqual(valid["medicine_name"], "Paracetamol")

    def test_existing_walk_in_request_does_not_require_a_medicine_selection(self):
        request = SimpleNamespace(method="POST", user=SimpleNamespace(role="bhc", is_authenticated=True))
        serializer = PatientMedicineRequestSerializer(context={"request": request})
        self.assertEqual(serializer.validate({}), {})
