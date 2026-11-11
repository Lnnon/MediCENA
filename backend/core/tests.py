from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import (User, Facility, StaffProfile, PatientProfile, Referral, Consultation,
                     Medicine, MedicineInventory, MedicineRequest, PatientMedicineRequest,
                     PatientMedicineDistribution, StaffActivity, SystemNotification)


@override_settings(ALLOWED_HOSTS=["testserver"])
class RoleWorkflowTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.cho_facility = Facility.objects.create(name="Lucena City Health Office", facility_type="cho", address="Lucena")
        cls.bhc_facility = Facility.objects.create(name="Barangay One BHC", facility_type="bhc", address="Lucena")
        cls.other_facility = Facility.objects.create(name="Barangay Two BHC", facility_type="bhc", address="Lucena")
        cls.users = {}
        for role in ("cho", "opd", "pharmacist", "doctor", "bhc", "patient"):
            user = User.objects.create_user(username=role, password="Workflow-test-934!", role=role, email=f"{role}@example.test")
            cls.users[role] = user
            if role != "patient":
                StaffProfile.objects.create(user=user, facility=cls.bhc_facility if role == "bhc" else cls.cho_facility,
                                            position={"cho": "CHO Administrator", "opd": "OPD Personnel", "pharmacist": "Pharmacist", "doctor": "Doctor", "bhc": "Barangay Health Worker"}[role],
                                            barangay_designation="One" if role == "bhc" else "")
        cls.patient = PatientProfile.objects.create(user=cls.users["patient"], primary_facility=cls.bhc_facility, barangay="One", address="One")
        cls.other_user = User.objects.create_user(username="other-patient", role="patient")
        cls.other_patient = PatientProfile.objects.create(user=cls.other_user, primary_facility=cls.other_facility, barangay="Two", address="Two")
        cls.referral = Referral.objects.create(patient=cls.patient, referred_by=cls.users["bhc"], source_facility=cls.bhc_facility, destination_facility=cls.cho_facility, reason="Review")
        cls.other_referral = Referral.objects.create(patient=cls.other_patient, referred_by=cls.users["bhc"], source_facility=cls.other_facility, destination_facility=cls.cho_facility, reason="Other")
        cls.medicine = Medicine.objects.create(name="Test medicine", medicine_type="Tablet", dosage="500mg")
        cls.stock = MedicineInventory.objects.create(facility=cls.cho_facility, medicine=cls.medicine, quantity=100)
        cls.supply = MedicineRequest.objects.create(requested_by=cls.users["bhc"], source_facility=cls.bhc_facility, medicine=cls.medicine, quantity=20)
        cls.prescription = PatientMedicineRequest.objects.create(patient=cls.patient, requested_by=cls.users["patient"], bhc_facility=cls.bhc_facility)

    def client_for(self, role):
        client = APIClient()
        client.force_authenticate(self.users[role])
        return client

    def test_patient_and_pharmacist_cannot_access_other_clinical_records(self):
        patient = self.client_for("patient")
        self.assertEqual([item["id"] for item in patient.get("/api/patient-profiles/").data], [self.patient.id])
        self.assertEqual(patient.get(f"/api/patient-profiles/{self.other_patient.id}/").status_code, 404)
        self.assertEqual(patient.get("/api/staff-profiles/").status_code, 403)
        self.assertEqual(patient.patch(f"/api/referrals/{self.referral.id}/", {"status": "completed"}).status_code, 403)
        pharmacy = self.client_for("pharmacist")
        self.assertEqual(pharmacy.get("/api/referrals/").status_code, 403)
        self.assertEqual(pharmacy.get("/api/patient-profiles/").status_code, 403)
        self.assertEqual(self.client_for("opd").get("/api/medicine-inventory/").status_code, 403)

    def test_cho_monitors_referrals_and_medicines_without_operational_access(self):
        admin = self.client_for("cho")
        for endpoint in ("referrals", "medicines", "medicine-inventory", "medicine-requests", "patient-medicine-distributions"):
            self.assertEqual(admin.get(f"/api/{endpoint}/").status_code, 200)
            self.assertEqual(admin.post(f"/api/{endpoint}/", {}).status_code, 403)
        for endpoint, record in (("referrals", self.referral), ("medicines", self.medicine), ("medicine-inventory", self.stock), ("medicine-requests", self.supply)):
            self.assertEqual(admin.patch(f"/api/{endpoint}/{record.pk}/", {}).status_code, 403)
            self.assertEqual(admin.delete(f"/api/{endpoint}/{record.pk}/").status_code, 403)
        self.assertEqual(admin.get("/api/medicine-inventory/?scope=citywide").status_code, 200)

    def test_cho_creates_new_roles_and_controls_staff_access(self):
        admin = self.client_for("cho")
        for position, role in (("OPD Personnel", "opd"), ("Pharmacist", "pharmacist")):
            response = admin.post("/api/staff-profiles/", {"username": f"new-{role}", "email": f"new-{role}@example.test", "password": "New-account-723!", "position": position})
            self.assertEqual(response.status_code, 201, response.data)
            self.assertEqual(response.data["user"]["role"], role)
            self.assertEqual(response.data["facility"], self.cho_facility.id)
        profile = self.users["opd"].staff_profile
        self.assertEqual(admin.patch(f"/api/staff-profiles/{profile.id}/", {"is_active": False}).status_code, 200)
        self.users["opd"].refresh_from_db()
        self.assertFalse(self.users["opd"].is_active)
        self.assertEqual(self.client_for("patient").post("/api/staff-profiles/", {}).status_code, 403)

    def test_opd_assigns_doctor_and_doctor_records_consultation(self):
        opd = self.client_for("opd")
        response = opd.patch(f"/api/referrals/{self.referral.id}/", {"assigned_doctor": self.users["doctor"].id})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(SystemNotification.objects.filter(recipient=self.users["doctor"], object_id=self.referral.id).exists())
        doctor = self.client_for("doctor")
        self.assertEqual(doctor.get(f"/api/referrals/{self.other_referral.id}/").status_code, 404)
        self.assertEqual(doctor.patch(f"/api/referrals/{self.referral.id}/", {"status": "accepted"}).status_code, 200)
        response = doctor.post("/api/consultations/", {"referral": self.referral.id, "diagnosis": "Test diagnosis", "treatment_plan": "Test plan"})
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(doctor.patch(f"/api/referrals/{self.referral.id}/", {"status": "completed"}).status_code, 200)
        self.assertEqual(doctor.post("/api/consultations/", {"referral": self.other_referral.id, "diagnosis": "No", "treatment_plan": "No"}).status_code, 400)
        self.assertEqual(self.client_for("patient").get("/api/consultations/").data[0]["diagnosis"], "Test diagnosis")

    def test_dispatch_receipt_and_stock_cannot_be_repeated(self):
        pharmacy = self.client_for("pharmacist")
        bhc = self.client_for("bhc")
        url = f"/api/medicine-requests/{self.supply.id}/"
        self.assertEqual(bhc.patch(url, {"status": "approved"}).status_code, 400)
        self.assertEqual(pharmacy.patch(url, {"status": "approved"}).status_code, 200)
        self.assertEqual(pharmacy.patch(url, {"status": "dispatched"}).status_code, 200)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.quantity, 80)
        self.assertEqual(pharmacy.patch(url, {"status": "dispatched"}).status_code, 200)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.quantity, 80)
        self.assertEqual(pharmacy.patch(url, {"status": "released"}).status_code, 400)
        self.assertEqual(bhc.patch(url, {"status": "released"}).status_code, 200)
        self.assertEqual(bhc.patch(url, {"status": "released"}).status_code, 200)
        self.assertEqual(MedicineInventory.objects.get(facility=self.bhc_facility, medicine=self.medicine).quantity, 20)
        self.assertEqual(pharmacy.patch(url, {"status": "approved"}).status_code, 400)
        self.supply.refresh_from_db()
        self.assertIsNotNone(self.supply.dispatched_at)
        self.assertIsNotNone(self.supply.received_at)
        self.assertEqual(self.supply.dispatched_by, self.users["pharmacist"])
        self.assertEqual(self.supply.received_by, self.users["bhc"])

    def test_insufficient_stock_rolls_back_dispatch(self):
        self.supply.status = "approved"
        self.supply.quantity = 200
        self.supply.save()
        response = self.client_for("pharmacist").patch(f"/api/medicine-requests/{self.supply.id}/", {"status": "dispatched"})
        self.assertEqual(response.status_code, 400)
        self.stock.refresh_from_db(); self.supply.refresh_from_db()
        self.assertEqual(self.stock.quantity, 100)
        self.assertEqual(self.supply.status, "approved")

    def test_bhc_receives_patient_requests_and_patient_cannot_change_status(self):
        bhc = self.client_for("bhc")
        response = bhc.get("/api/patient-medicine-requests/")
        self.assertIn(self.prescription.id, [item["id"] for item in response.data])
        self.assertEqual(bhc.patch(f"/api/patient-medicine-requests/{self.prescription.id}/", {"status": "seen"}).status_code, 200)
        self.assertEqual(self.client_for("patient").patch(f"/api/patient-medicine-requests/{self.prescription.id}/", {"status": "ready_to_get"}).status_code, 400)
        self.assertEqual(bhc.get(f"/api/patient-profiles/{self.other_patient.id}/").status_code, 404)

    def test_linked_patient_distribution_completes_request(self):
        MedicineInventory.objects.create(facility=self.bhc_facility, medicine=self.medicine, quantity=10)
        response = self.client_for("bhc").post("/api/patient-medicine-distributions/", {"patient": self.patient.id, "medicine": self.medicine.id, "quantity": 2, "request": self.prescription.id})
        self.assertEqual(response.status_code, 201, response.data)
        self.prescription.refresh_from_db()
        self.assertEqual(self.prescription.status, "received")
        self.assertEqual(self.client_for("patient").get("/api/patient-medicine-distributions/").data[0]["request"], self.prescription.id)
        repeated = self.client_for("bhc").post("/api/patient-medicine-distributions/", {"patient": self.patient.id, "medicine": self.medicine.id, "quantity": 2, "request": self.prescription.id})
        self.assertEqual(repeated.status_code, 400)
        self.assertEqual(MedicineInventory.objects.get(facility=self.bhc_facility, medicine=self.medicine).quantity, 8)

    def test_all_roles_login_directly_without_email(self):
        from .models import EmailVerificationCode
        for role, user in self.users.items():
            with self.subTest(role=role):
                user.email = ""
                user.save(update_fields=["email"])
                response = APIClient().post("/api/auth/login/", {"username": user.username, "password": "Workflow-test-934!"})
                self.assertEqual(response.status_code, 200, response.data)
                self.assertIn("access", response.data)
                self.assertIn("refresh", response.data)
                self.assertEqual(response.data["user"]["role"], role)
                self.assertNotIn("verification_required", response.data)
        self.assertFalse(EmailVerificationCode.objects.exists())

    def test_login_rejects_wrong_password_and_inactive_accounts(self):
        public = APIClient()
        self.assertEqual(public.post("/api/auth/login/", {"username": "opd", "password": "wrong"}).status_code, 400)
        self.users["opd"].is_active = False
        self.users["opd"].save(update_fields=["is_active"])
        self.assertEqual(public.post("/api/auth/login/", {"username": "opd", "password": "Workflow-test-934!"}).status_code, 400)

    def test_verification_routes_are_removed(self):
        self.assertEqual(APIClient().post("/api/auth/resend-code/", {}).status_code, 404)
        self.assertEqual(APIClient().post("/api/auth/verify-email/", {}).status_code, 404)

    def test_distribution_is_atomic_and_rejects_overdraw(self):
        inventory = MedicineInventory.objects.create(facility=self.bhc_facility, medicine=self.medicine, quantity=10)
        bhc = self.client_for("bhc")
        payload = {"patient": self.patient.id, "medicine": self.medicine.id, "quantity": 7}
        self.assertEqual(bhc.post("/api/patient-medicine-distributions/", payload).status_code, 201)
        self.assertEqual(bhc.post("/api/patient-medicine-distributions/", payload).status_code, 400)
        inventory.refresh_from_db()
        self.assertEqual(inventory.quantity, 3)
        self.assertEqual(PatientMedicineDistribution.objects.count(), 1)
        with patch("core.serializers.PatientMedicineDistribution.objects.create", side_effect=RuntimeError("Simulated failure")):
            with self.assertRaises(RuntimeError):
                bhc.post("/api/patient-medicine-distributions/", {**payload, "quantity": 2})
        inventory.refresh_from_db()
        self.assertEqual(inventory.quantity, 3)

    def test_activity_feed_is_admin_only_and_has_no_clinical_payload(self):
        self.client_for("opd").patch(f"/api/referrals/{self.referral.id}/", {"status": "seen"})
        self.assertTrue(StaffActivity.objects.filter(actor=self.users["opd"], resource="referral").exists())
        self.assertEqual(self.client_for("opd").get("/api/staff-activities/").status_code, 403)
        self.assertEqual(self.client_for("cho").get("/api/staff-activities/").status_code, 200)

    def test_doctor_can_update_own_consultation_only(self):
        self.referral.assigned_doctor = self.users["doctor"]
        self.referral.status = "completed"
        self.referral.save()
        record = Consultation.objects.create(referral=self.referral, doctor=self.users["doctor"], diagnosis="Initial", treatment_plan="Initial plan")
        response = self.client_for("doctor").patch(f"/api/consultations/{record.pk}/", {"diagnosis": "Revised", "treatment_plan": "Revised plan"})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.client_for("opd").patch(f"/api/consultations/{record.pk}/", {"diagnosis": "Wrong"}).status_code, 403)
        details = self.client_for("opd").get(f"/api/referrals/{self.referral.pk}/").data["consultation_details"]
        self.assertEqual(details[0]["diagnosis"], "Revised")

    def test_bhc_and_opd_can_create_patient_and_referral(self):
        bhc = self.client_for("bhc")
        response = bhc.post("/api/patient-profiles/", {"first_name": "Test", "last_name": "Patient", "barangay": "Two"})
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["barangay"], "One")
        referral = bhc.post("/api/referrals/", {"patient": response.data["id"], "reason": "Assessment", "destination_facility": self.cho_facility.pk})
        self.assertEqual(referral.status_code, 201, referral.data)
        self.assertTrue(SystemNotification.objects.filter(recipient=self.users["opd"], object_id=referral.data["id"], object_type="referral").exists())
        self.assertEqual(bhc.post("/api/referrals/", {"patient": self.other_patient.pk, "reason": "Not allowed"}).status_code, 400)

    def test_clinical_lists_prefetch_recent_distributions_per_patient(self):
        histories = {}
        for patient in (self.patient, self.other_patient):
            records = [PatientMedicineDistribution.objects.create(
                patient=patient, medicine=self.medicine, facility=patient.primary_facility,
                distributed_by=self.users["bhc"], quantity=quantity,
            ) for quantity in range(1, 13)]
            histories[patient.pk] = [record.pk for record in reversed(records[-10:])]

        client = self.client_for("cho")
        with self.assertNumQueries(2):
            profiles = client.get("/api/patient-profiles/").data
        with self.assertNumQueries(3):
            referrals = client.get("/api/referrals/").data
        for profile in [*profiles, *(referral["patient_detail"] for referral in referrals)]:
            self.assertEqual([row["id"] for row in profile["medicine_distributions"]], histories[profile["id"]])

    def test_unassigned_bhc_account_cannot_request_unscoped_geography(self):
        client = APIClient()
        client.force_authenticate(User.objects.create_user(username="unassigned-bhc", role=User.Role.BHC))
        self.assertEqual(client.get("/api/gis/purok-disease-map/").status_code, 403)
        self.assertEqual(client.get("/api/gis/puroks/?barangay=Other").status_code, 403)

