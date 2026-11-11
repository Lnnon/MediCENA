from datetime import date, timedelta
from io import BytesIO
from unittest.mock import patch, MagicMock
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs

from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from . import tests as role_tests
from .forecast_service import monthly_forecast, shift_month, build_forecast_analysis
from .models import User, NotificationPreference, SystemNotification, SMSDelivery, SMSAttempt, MedicineInventory, PatientMedicineDistribution
from .notification_service import create_notification
from .sms_service import process_delivery, refresh_delivery, provider_request, SMS_BODY


class ForecastCalculationTests(SimpleTestCase):
    def test_independent_moving_average_and_holdout_errors(self):
        observations = {date(2026, month, 1): month * 3 for month in range(1, 7)}
        result = monthly_forecast(observations, date(2026, 1, 1), date(2026, 6, 30), 3)
        self.assertEqual(result["status"], "ready")
        # Independently: (12+15+18)/3=15; (15+18+15)/3=16; (18+15+16)/3=49/3.
        self.assertEqual([item["predicted"] for item in result["forecasts"]], [15, 16, 16.3333])
        # Holdout predictions for April, May, June: 6,9,12 against 12,15,18 => errors 6,6,6.
        self.assertEqual(result["evaluation"]["mae"], 6)
        self.assertEqual(result["evaluation"]["rmse"], 6)
        self.assertEqual(result["evaluation"]["test_months"], 3)

    def test_no_prediction_for_insufficient_stale_or_missing_records(self):
        complete = {date(2026, month, 1): month for month in range(1, 8)}
        for observations, cutoff, expected in [
            ({date(2026, 6, 1): 10}, date(2026, 6, 30), "insufficient_data"),
            (complete, date(2026, 9, 30), "stale_data"),
            ({key: value for key, value in complete.items() if key.month != 4}, date(2026, 7, 31), "missing_periods"),
        ]:
            with self.subTest(expected=expected):
                result = monthly_forecast(observations, date(2026, 1, 1), cutoff)
                self.assertEqual(result["status"], expected)
                self.assertEqual(result["forecasts"], [])

    def test_partial_month_and_invalid_values_do_not_enter_forecast(self):
        observations = {date(2026, month, 1): 10 for month in range(1, 8)}
        observations[date(2026, 7, 1)] = 1000
        result = monthly_forecast(observations, date(2026, 1, 1), date(2026, 7, 15), 1)
        self.assertEqual(result["forecast_origin"], "2026-06-01")
        self.assertEqual(result["forecasts"][0]["predicted"], 10)
        observations[date(2026, 2, 1)] = -10
        result = monthly_forecast(observations, date(2026, 1, 1), date(2026, 7, 31))
        self.assertEqual(result["status"], "missing_periods")
        self.assertEqual(shift_month(date(2026, 12, 1), 1), date(2027, 1, 1))


@override_settings(ALLOWED_HOSTS=["testserver"], SMS_PROVIDER="twilio", TWILIO_ACCOUNT_SID="AC" + "a" * 32, TWILIO_AUTH_TOKEN="test-token", TWILIO_FROM_NUMBER="+15005550006")
class PanelWorkflowTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        role_tests.RoleWorkflowTests.setUpTestData.__func__(cls)

    def client_for(self, role):
        client = APIClient(); client.force_authenticate(self.users[role]); return client

    def notification(self, user=None, **options):
        return create_notification(user or self.users["patient"], notification_type="referral", title="Account update", message="Sensitive test diagnosis should not be sent by SMS", target_page="currentReferral", object_type="referral", object_id=self.referral.pk, **options)

    def opt_in(self, user=None):
        return NotificationPreference.objects.create(user=user or self.users["patient"], sms_enabled=True, phone_number="+639171234567", consent_at=timezone.now())

    def test_deduplication_and_consent_fallback(self):
        first, second = self.notification(), self.notification()
        self.assertEqual(first.pk, second.pk)
        self.assertEqual(SMSDelivery.objects.count(), 1)
        self.assertEqual(first.sms_delivery.status, "skipped")
        self.assertEqual(first.sms_delivery.error_code, "not_opted_in")
        self.assertTrue(SystemNotification.objects.filter(pk=first.pk).exists())

    def test_disabled_gateway_does_not_claim_delivery(self):
        self.opt_in()
        with override_settings(SMS_PROVIDER="disabled"):
            record = self.notification().sms_delivery
            self.assertEqual(record.status, "not_configured")
            with patch("core.sms_service.provider_request") as provider:
                process_delivery(record.pk)
                provider.assert_not_called()

    def test_provider_acceptance_and_confirmed_receipt_are_distinct(self):
        self.opt_in(); delivery = self.notification().sms_delivery
        sid = "SM" + "b" * 32
        with patch("core.sms_service.provider_request", return_value={"sid": sid, "status": "queued"}) as provider:
            process_delivery(delivery.pk); process_delivery(delivery.pk)
            self.assertEqual(provider.call_count, 1)
        delivery.refresh_from_db(); self.assertEqual(delivery.status, "queued")
        with patch("core.sms_service.provider_request", return_value={"sid": sid, "status": "delivered"}):
            refresh_delivery(delivery.pk)
        delivery.refresh_from_db(); self.assertEqual(delivery.status, "delivered")
        self.assertEqual(delivery.attempts, 1)

    def test_uncertain_send_is_never_blindly_retried(self):
        self.opt_in(); delivery = self.notification().sms_delivery
        with patch("core.sms_service.provider_request", side_effect=URLError("timeout")) as provider:
            process_delivery(delivery.pk); process_delivery(delivery.pk)
            self.assertEqual(provider.call_count, 1)
        delivery.refresh_from_db(); self.assertEqual(delivery.status, "unknown")

    def test_confirmed_rate_limit_has_bounded_retry(self):
        self.opt_in(); delivery = self.notification().sms_delivery
        failure = HTTPError("https://api.twilio.com", 429, "Rate limit", {}, BytesIO())
        with patch("core.sms_service.provider_request", side_effect=failure):
            process_delivery(delivery.pk)
        delivery.refresh_from_db(); self.assertEqual(delivery.status, "retry"); self.assertIsNotNone(delivery.next_attempt_at)
        with patch("core.sms_service.provider_request") as provider:
            process_delivery(delivery.pk); provider.assert_not_called()

    def test_provider_payload_never_contains_health_details(self):
        response = MagicMock(); response.__enter__.return_value.read.return_value = b'{"sid":"SMbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","status":"queued"}'
        with patch("core.sms_service.urlopen", return_value=response) as network:
            provider_request(phone="+639171234567")
        payload = parse_qs(network.call_args.args[0].data.decode())
        self.assertEqual(payload["Body"], [SMS_BODY])
        self.assertNotIn("diagnosis", payload["Body"][0].lower())

    def test_preferences_own_account_and_disabled_category(self):
        patient = self.client_for("patient")
        response = patient.patch("/api/notifications/preferences/", {"phone_number": "09171234567", "sms_enabled": True, "categories": []}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["phone_number"], "+639171234567")
        self.assertIsNotNone(response.data["consent_at"])
        self.assertEqual(self.notification().sms_delivery.error_code, "category_disabled")
        self.assertEqual(patient.patch("/api/notifications/preferences/", {"phone_number": "invalid"}).status_code, 400)
        self.assertFalse(NotificationPreference.objects.filter(user=self.users["cho"]).exists())

    def test_doctor_statistics_unique_count_dates_and_permissions(self):
        doctor = self.users["doctor"]; doctor.is_active = False; doctor.save(update_fields=["is_active"])
        admin = self.client_for("cho")
        data = admin.get("/api/users/doctor-statistics/").data
        self.assertEqual((data["total"], data["active"], data["inactive"]), (1, 0, 1))
        self.assertIsNone(data["professional_citywide_total"])
        self.assertEqual(admin.get("/api/users/doctor-statistics/?status=active").data["total"], 0)
        self.assertEqual(admin.get("/api/users/doctor-statistics/?start_date=1900-01-01&end_date=1900-02-01").data["total"], 0)
        self.assertEqual(self.client_for("opd").get("/api/users/doctor-statistics/").status_code, 403)
        self.assertEqual(self.client_for("patient").get("/api/users/doctor-statistics/").status_code, 403)
        self.assertEqual(admin.get("/api/users/doctor-statistics/?status=bad").status_code, 400)

    def test_doctor_without_staff_profile_is_counted_and_deleted_user_is_excluded(self):
        extra = User.objects.create_user(username="doctor-without-profile", role="doctor")
        admin = self.client_for("cho")
        self.assertEqual(admin.get("/api/users/doctor-statistics/").data["total"], 2)
        extra.delete()
        self.assertEqual(admin.get("/api/users/doctor-statistics/").data["total"], 1)

    def test_announcements_permissions_and_duplicate_prevention(self):
        payload = {"title": "Maintenance", "message": "Scheduled service update", "roles": ["patient"]}
        self.assertEqual(self.client_for("opd").post("/api/notifications/announcements/", payload, format="json").status_code, 403)
        admin = self.client_for("cho")
        self.assertEqual(admin.post("/api/notifications/announcements/", payload, format="json").status_code, 200)
        self.assertEqual(admin.post("/api/notifications/announcements/", payload, format="json").status_code, 200)
        self.assertEqual(SystemNotification.objects.filter(notification_type="system", recipient=self.users["patient"]).count(), 1)
        self.assertEqual(admin.post("/api/notifications/announcements/", {**payload, "roles": ["bad"]}, format="json").status_code, 400)

    def test_referral_events_reject_complete_and_no_repeat(self):
        opd = self.client_for("opd")
        url = f"/api/referrals/{self.referral.pk}/"
        self.assertEqual(opd.patch(url, {"assigned_doctor": self.users["doctor"].pk}).status_code, 200)
        self.assertTrue(SystemNotification.objects.filter(recipient=self.users["patient"], title="Doctor assigned to referral").exists())
        self.assertEqual(opd.patch(url, {"status": "rejected"}).status_code, 200)
        count = SystemNotification.objects.count()
        self.assertEqual(opd.patch(url, {"status": "rejected"}).status_code, 200)
        self.assertEqual(SystemNotification.objects.count(), count)
        self.assertEqual(self.client_for("doctor").patch(url, {"status": "accepted"}).status_code, 400)
        self.assertTrue(SystemNotification.objects.filter(recipient=self.users["patient"], message__contains="Rejected").exists())

    def test_delivery_logs_only_own_records_and_read_only_notification_body(self):
        notice = self.notification()
        self.assertEqual(self.client_for("opd").get("/api/notifications/delivery-logs/").data, [])
        self.assertEqual(len(self.client_for("cho").get("/api/notifications/delivery-logs/").data), 1)
        self.client_for("patient").patch(f"/api/notifications/{notice.pk}/", {"message": "Tampered", "is_read": True})
        notice.refresh_from_db(); self.assertNotEqual(notice.message, "Tampered"); self.assertTrue(notice.is_read)

    def test_referral_supply_and_patient_completion_events_enqueue_in_app_and_sms(self):
        from .notification_service import notify_patient_medicine_request_created
        with patch("core.sms_service.provider_request") as gateway:
            url = f"/api/referrals/{self.referral.pk}/"
            self.assertEqual(self.client_for("opd").patch(url, {"assigned_doctor": self.users["doctor"].pk}).status_code, 200)
            for status in ("accepted", "completed"):
                self.assertEqual(self.client_for("doctor").patch(url, {"status": status}).status_code, 200)
                self.assertTrue(SystemNotification.objects.filter(recipient=self.users["patient"], message__icontains=status).exists())
            created = self.client_for("bhc").post("/api/medicine-requests/", {"medicine": self.medicine.pk, "quantity": 5})
            self.assertEqual(created.status_code, 201, created.data)
            supply_url = f"/api/medicine-requests/{created.data['id']}/"
            for status in ("approved", "dispatched"):
                self.assertEqual(self.client_for("pharmacist").patch(supply_url, {"status": status}).status_code, 200)
            self.assertEqual(self.client_for("bhc").patch(supply_url, {"status": "released"}).status_code, 200)
            self.assertTrue(SystemNotification.objects.filter(recipient=self.users["cho"], title="Supply process updated", message__icontains="released").exists())
            notify_patient_medicine_request_created(self.prescription, actor=self.users["patient"])
            self.assertTrue(SystemNotification.objects.filter(recipient=self.users["bhc"], title="New patient medicine request").exists())
            distribution = self.client_for("bhc").post("/api/patient-medicine-distributions/", {"patient": self.patient.pk, "medicine": self.medicine.pk, "quantity": 1, "request": self.prescription.pk})
            self.assertEqual(distribution.status_code, 201, distribution.data)
            self.assertTrue(SystemNotification.objects.filter(recipient=self.users["patient"], title="Medicine distributed").exists())
            self.assertTrue(SystemNotification.objects.filter(recipient=self.users["patient"], message__icontains="Received").exists())
            self.assertTrue(all(item.sms_delivery.status == "skipped" for item in SystemNotification.objects.all()))
            gateway.assert_not_called()

    def test_expired_outbox_message_is_not_sent(self):
        self.opt_in(); delivery = self.notification().sms_delivery
        SMSDelivery.objects.filter(pk=delivery.pk).update(created_at=timezone.now() - timedelta(days=2))
        with patch("core.sms_service.provider_request") as provider:
            process_delivery(delivery.pk); provider.assert_not_called()
        delivery.refresh_from_db(); self.assertEqual(delivery.error_code, "alert_expired_after_24h")

    def test_numeric_stock_gap_uses_consumption_not_supply_requests(self):
        from django.db.utils import ConnectionDoesNotExist
        MedicineInventory.objects.create(facility=self.bhc_facility, medicine=self.medicine, quantity=5)
        for month in range(1, 7):
            row = PatientMedicineDistribution.objects.create(patient=self.patient, medicine=self.medicine, facility=self.bhc_facility, distributed_by=self.users["bhc"], quantity=month * 3)
            PatientMedicineDistribution.objects.filter(pk=row.pk).update(distributed_at=timezone.make_aware(timezone.datetime(2026, month, 15)))
        real_localdate = timezone.localdate
        with patch("core.forecast_service.DiseaseCase.objects.using", side_effect=ConnectionDoesNotExist), patch("core.forecast_service.timezone.localdate", side_effect=lambda value=None: real_localdate(value) if value else date(2026, 6, 30)):
            result = build_forecast_analysis({"start_date": "2026-01-01", "end_date": "2026-06-30", "horizon": 1}, self.users["cho"])
        item = next(item for item in result["medicines"] if item["facility_id"] == self.bhc_facility.pk)
        self.assertEqual(item["forecast_total_units"], 15)
        self.assertEqual(item["stock_gap_units"], 10)

    def test_forecast_permissions_gis_failure_filters_and_real_consumption(self):
        from django.db.utils import ConnectionDoesNotExist
        admin = self.client_for("cho")
        for role in ("patient", "doctor", "opd", "pharmacist"):
            self.assertEqual(self.client_for(role).get("/api/analytics/outbreaks/?mode=forecast").status_code, 403)
        self.assertEqual(admin.get("/api/analytics/outbreaks/?mode=forecast&start_date=bad").status_code, 400)
        self.assertEqual(admin.get("/api/analytics/outbreaks/?mode=forecast&horizon=99").status_code, 400)
        for month in range(1, 7):
            record = PatientMedicineDistribution.objects.create(patient=self.patient, medicine=self.medicine, facility=self.bhc_facility, distributed_by=self.users["bhc"], quantity=month * 3)
            PatientMedicineDistribution.objects.filter(pk=record.pk).update(distributed_at=timezone.make_aware(timezone.datetime(2026, month, 15)))
        with patch("core.forecast_service.DiseaseCase.objects.using", side_effect=ConnectionDoesNotExist):
            response = admin.get("/api/analytics/outbreaks/?mode=forecast&start_date=2026-01-01&end_date=2026-06-30&horizon=1")
            self.assertEqual(response.status_code, 200, response.data)
            self.assertEqual(response.data["gis_status"], "unavailable")
            item = next(item for item in response.data["medicines"] if item["facility_id"] == self.bhc_facility.pk)
            self.assertEqual(item["consumption_forecast"]["forecasts"][0]["predicted"], 15)
            self.assertIsNone(item["stock_gap_units"])
            scoped = self.client_for("bhc").get("/api/analytics/outbreaks/?mode=forecast&barangay=Two").data
            self.assertEqual(scoped["filters"]["barangay"], "One")
            self.assertTrue(all(item["facility_id"] == self.bhc_facility.pk for item in scoped["medicines"]))
