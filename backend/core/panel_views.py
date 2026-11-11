from datetime import date
import hashlib

from django.db.models import Count, Q
from django.db import transaction
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework import serializers
from rest_framework.response import Response

from .models import User, NotificationPreference, SMSDelivery, SystemNotification
from .permissions import CHOOnly
from .notification_service import create_notification
from .sms_service import normalize_phone, configured


def date_filters(params):
    values = {}
    for key in ("start_date", "end_date"):
        if params.get(key):
            try:
                values[key] = date.fromisoformat(params[key])
            except ValueError as exc:
                raise serializers.ValidationError({key: "Use YYYY-MM-DD."}) from exc
    if values.get("start_date", date.min) > values.get("end_date", date.max):
        raise serializers.ValidationError("Start date must not be after end date.")
    return values


@api_view(["GET"])
@permission_classes([CHOOnly])
def doctor_statistics(request):
    dates = date_filters(request.query_params)
    doctors = User.objects.filter(role=User.Role.DOCTOR)
    for key, value in dates.items():
        doctors = doctors.filter(**{f"date_joined__date__{'gte' if key == 'start_date' else 'lte'}": value})
    status = request.query_params.get("status", "")
    if status not in {"", "active", "inactive"}:
        raise serializers.ValidationError({"status": "Choose active or inactive."})
    if status:
        doctors = doctors.filter(is_active=status == "active")
    summary = doctors.aggregate(total=Count("pk", distinct=True), active=Count("pk", filter=Q(is_active=True), distinct=True), inactive=Count("pk", filter=Q(is_active=False), distinct=True))
    monthly = list(doctors.annotate(month=TruncMonth("date_joined")).values("month").annotate(count=Count("pk", distinct=True)).order_by("month"))
    return Response({**summary, "monthly_registrations": [{"month": item["month"].date().isoformat(), "count": item["count"]} for item in monthly],
        "label": "Doctor accounts registered in MediCena", "basis": "Unique existing User accounts with role=doctor, by date_joined and is_active. Includes accounts without a staff profile.",
        "professional_citywide_total": None, "professional_citywide_source": "Official CHO data required; not provided.", "filters": dict(request.query_params), "generated_at": timezone.now()})


class PreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = ("sms_enabled", "phone_number", "categories", "consent_at")
        read_only_fields = ("consent_at",)

    def validate_phone_number(self, value):
        try:
            return normalize_phone(value)
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc

    def validate_categories(self, value):
        if not isinstance(value, list) or any(item not in SystemNotification.NotificationType.values for item in value):
            raise serializers.ValidationError("Choose referral, medicine, patient, or system categories.")
        return list(dict.fromkeys(value))

    def validate(self, attrs):
        if attrs.get("sms_enabled", self.instance.sms_enabled) and not attrs.get("phone_number", self.instance.phone_number):
            raise serializers.ValidationError({"phone_number": "Provide your mobile number before enabling SMS."})
        return attrs


@api_view(["GET", "PATCH"])
def notification_preferences(request):
    preference, _ = NotificationPreference.objects.get_or_create(user=request.user)
    if request.method == "PATCH":
        serializer = PreferenceSerializer(preference, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        opted_in = serializer.validated_data.get("sms_enabled", preference.sms_enabled)
        serializer.save(consent_at=(preference.consent_at or timezone.now()) if opted_in else None)
    return Response({**PreferenceSerializer(preference).data, "sms_configured": configured(), "in_app_enabled": True})


@api_view(["GET"])
def notification_delivery_logs(request):
    query = SMSDelivery.objects.select_related("recipient", "notification").prefetch_related("logs")
    if request.user.role != User.Role.CHO:
        query = query.filter(recipient=request.user)
    return Response([{"id": item.pk, "notification_id": item.notification_id, "recipient": item.recipient.username if request.user.role == User.Role.CHO else "Your account",
        "status": item.status, "attempts": item.attempts, "error_code": item.error_code, "provider_id": item.provider_id if request.user.role == User.Role.CHO else None,
        "created_at": item.created_at, "updated_at": item.updated_at, "logs": [{"status": log.status, "error_code": log.error_code, "at": log.created_at} for log in item.logs.all()]} for item in query[:200]])


@api_view(["POST"])
@permission_classes([CHOOnly])
@transaction.atomic
def system_announcement(request):
    title, message = request.data.get("title"), request.data.get("message")
    roles = request.data.get("roles", User.Role.values)
    if not isinstance(title, str) or not title.strip() or len(title) > 160 or not isinstance(message, str) or not message.strip() or len(message) > 2000:
        raise serializers.ValidationError("Provide a title (1–160 characters) and message (1–2000 characters).")
    if not isinstance(roles, list) or not roles or any(role not in User.Role.values for role in roles):
        raise serializers.ValidationError({"roles": "Choose valid recipient roles."})
    title, message = title.strip(), message.strip()
    announcement_key = hashlib.sha256(f"{request.user.pk}|{title}|{message}|{sorted(set(roles))}".encode()).hexdigest()
    count = 0
    for user in User.objects.filter(is_active=True, role__in=roles):
        create_notification(user, actor=request.user, notification_type="system", title=title.strip(), message=message.strip(), target_page="notifications", object_type=f"announcement:{announcement_key}")
        count += 1
    return Response({"detail": "Announcement saved to recipient notification histories. SMS is queued only for opted-in recipients; delivery is not yet confirmed.", "recipient_count": count})
