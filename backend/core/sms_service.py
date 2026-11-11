"""Consent-aware Twilio outbox. Network calls run in the worker, never in a clinical request."""
import base64
import json
import re
from datetime import timedelta
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import NotificationPreference, SMSDelivery, SMSAttempt

SMS_BODY = "MediCena: You have a new account update. Please sign in to view your notifications. Do not reply to this message."
PROVIDER_STATUSES = {"accepted", "queued", "sending", "sent", "delivered", "undelivered", "failed", "canceled"}


def normalize_phone(value):
    phone = re.sub(r"[\s()-]", "", value or "")
    if re.fullmatch(r"09\d{9}", phone):
        phone = "+63" + phone[1:]
    if phone and not re.fullmatch(r"\+[1-9]\d{7,14}", phone):
        raise ValueError("Use an international phone number, such as +639XXXXXXXXX, or an 11-digit Philippine mobile number.")
    return phone


def configured():
    return settings.SMS_PROVIDER == "twilio" and bool(re.fullmatch(r"AC[0-9a-fA-F]{32}", settings.TWILIO_ACCOUNT_SID)) and bool(settings.TWILIO_AUTH_TOKEN and settings.TWILIO_FROM_NUMBER)


def preference_status(user, category):
    preference = NotificationPreference.objects.filter(user=user).first()
    if not user.is_active or not preference or not preference.sms_enabled or not preference.consent_at:
        return "skipped", "not_opted_in"
    if category not in preference.categories:
        return "skipped", "category_disabled"
    try:
        if not normalize_phone(preference.phone_number):
            return "skipped", "missing_phone"
    except ValueError:
        return "skipped", "invalid_phone"
    return ("pending", "") if configured() else ("not_configured", "provider_not_configured")


def enqueue_sms(notification):
    status, code = preference_status(notification.recipient, notification.notification_type)
    delivery, created = SMSDelivery.objects.get_or_create(notification=notification, defaults={"recipient": notification.recipient, "status": status, "error_code": code})
    if created:
        SMSAttempt.objects.create(delivery=delivery, status=status, error_code=code)
    return delivery


def provider_request(phone=None, provider_id=None):
    account = settings.TWILIO_ACCOUNT_SID
    if not re.fullmatch(r"AC[0-9a-fA-F]{32}", account):
        raise ValueError("invalid_account_sid")
    auth = base64.b64encode(f"{account}:{settings.TWILIO_AUTH_TOKEN}".encode()).decode()
    url = f"https://api.twilio.com/2010-04-01/Accounts/{account}/Messages"
    if provider_id:
        if not re.fullmatch(r"SM[0-9a-fA-F]{32}", provider_id):
            raise ValueError("invalid_message_sid")
        request = Request(f"{url}/{provider_id}.json", headers={"Authorization": f"Basic {auth}"})
    else:
        payload = urlencode({"To": phone, "From": settings.TWILIO_FROM_NUMBER, "Body": SMS_BODY}).encode()
        request = Request(f"{url}.json", data=payload, headers={"Authorization": f"Basic {auth}", "Content-Type": "application/x-www-form-urlencoded"}, method="POST")
    with urlopen(request, timeout=settings.SMS_TIMEOUT) as response:
        return json.loads(response.read())


def save_outcome(delivery, status, code="", provider_id=None, retry_at=None):
    delivery.status, delivery.error_code, delivery.next_attempt_at = status, str(code or "")[:80], retry_at
    if provider_id:
        delivery.provider_id = provider_id
    delivery.save(update_fields=["status", "error_code", "provider_id", "next_attempt_at", "updated_at"])
    SMSAttempt.objects.create(delivery=delivery, status=status, error_code=delivery.error_code)


def process_delivery(delivery_id):
    with transaction.atomic():
        delivery = SMSDelivery.objects.select_for_update().select_related("recipient", "notification").get(pk=delivery_id)
        if delivery.status not in {"pending", "retry", "not_configured"} or (delivery.next_attempt_at and delivery.next_attempt_at > timezone.now()):
            return delivery
        if not delivery.notification:
            save_outcome(delivery, "skipped", "notification_expired")
            return delivery
        if delivery.created_at < timezone.now() - timedelta(days=1):
            save_outcome(delivery, "skipped", "alert_expired_after_24h")
            return delivery
        status, code = preference_status(delivery.recipient, delivery.notification.notification_type)
        if status != "pending":
            if status != delivery.status or code != delivery.error_code:
                save_outcome(delivery, status, code)
            return delivery
        if delivery.attempts >= settings.SMS_MAX_ATTEMPTS:
            save_outcome(delivery, "failed", "attempt_limit")
            return delivery
        # Conditional claim also prevents competing SQLite workers from sending the same outbox row.
        claimed = SMSDelivery.objects.filter(pk=delivery.pk, status=delivery.status).update(status="sending", attempts=delivery.attempts + 1, updated_at=timezone.now())
        if not claimed:
            return delivery
        delivery.refresh_from_db()
    try:
        phone = NotificationPreference.objects.get(user=delivery.recipient).phone_number
        result = provider_request(phone=normalize_phone(phone))
        sid, status = result.get("sid"), result.get("status")
        if not sid or not re.fullmatch(r"SM[0-9a-fA-F]{32}", sid) or status not in PROVIDER_STATUSES:
            save_outcome(delivery, "unknown", "unconfirmed_provider_response")
        else:
            save_outcome(delivery, status, result.get("error_code"), provider_id=sid)
    except HTTPError as exc:
        if exc.code == 429 and delivery.attempts < settings.SMS_MAX_ATTEMPTS:
            save_outcome(delivery, "retry", "http_429", retry_at=timezone.now() + timedelta(seconds=60 * 2 ** (delivery.attempts - 1)))
        elif exc.code >= 500:
            save_outcome(delivery, "unknown", f"http_{exc.code}")
        else:
            save_outcome(delivery, "failed", f"http_{exc.code}")
    except (TimeoutError, URLError, OSError):
        # A timed-out POST may already have reached the provider. Never blindly resend it.
        save_outcome(delivery, "unknown", "network_result_uncertain")
    except (ValueError, KeyError):
        save_outcome(delivery, "unknown", "invalid_provider_response")
    return delivery


def refresh_delivery(delivery_id):
    delivery = SMSDelivery.objects.get(pk=delivery_id)
    if not configured() or not delivery.provider_id or delivery.status in {"delivered", "failed", "undelivered", "canceled"}:
        return delivery
    try:
        result = provider_request(provider_id=delivery.provider_id)
        status = result.get("status")
        if result.get("sid") == delivery.provider_id and status in PROVIDER_STATUSES and status != delivery.status:
            save_outcome(delivery, status, result.get("error_code"))
    except (HTTPError, URLError, OSError, ValueError):
        SMSAttempt.objects.create(delivery=delivery, status="poll_failed", error_code="status_check_failed")
    return delivery
