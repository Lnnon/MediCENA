import json
import logging
import smtplib
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings
from django.contrib.auth import authenticate
from django.db import transaction
from django.db.models import F
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.core import signing
from django.utils import timezone
from django.contrib.auth.models import update_last_login
from django.utils.crypto import get_random_string
from django.utils.text import slugify
from .medicine_catalog import MEDICINE_CATALOG
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .notification_service import (
    notify_medicine_request_created,
    notify_medicine_request_updated,
    notify_patient_medicine_distributed,
    notify_patient_medicine_request_created,
    notify_patient_medicine_request_updated,
    notify_patient_saved,
    notify_referral_created,
    notify_referral_updated,
)
from .clinical_queries import RECENT_DISTRIBUTIONS_ATTR, ordered_distributions
from .exceptions import VerificationDeliveryError
from .referral_gis_service import sync_referral_to_gis_disease_case
from .medicine_stock import decrement_stock

logger = logging.getLogger(__name__)
from .models import (
    Consultation,
    Disease,
    EmailVerificationCode,
    Facility,
    Medicine,
    MedicineInventory,
    MedicineRequest,
    PatientProfile,
    PatientMedicineDistribution,
    PatientMedicineRequest,
    Referral,
    StaffProfile,
    StaffActivity,
    SystemNotification,
    User,
)


def build_verification_email(code):
    text_message = f"Your MediFlow verification code is {code}. This code expires in 10 minutes."
    html_message = f"""
    <div style="margin:0;padding:32px;background:#f3f8fc;font-family:Arial,Helvetica,sans-serif;color:#0f2f4a;">
      <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #d8e6f1;border-radius:8px;padding:34px 28px;text-align:center;">
        <div style="font-size:34px;font-weight:400;letter-spacing:-1px;color:#32465f;margin-bottom:22px;">
          Medi<span style="font-weight:800;color:#1697b7;">FLOW</span>
        </div>
        <p style="margin:0 0 18px;font-size:15px;color:#233b53;">Your verification code is:</p>
        <div style="display:inline-block;margin:0 auto 20px;padding:14px 24px;border-radius:6px;background:#eef7fd;color:#0f5f8f;font-size:30px;font-weight:800;letter-spacing:6px;">
          {code}
        </div>
        <p style="margin:0 0 22px;font-size:13px;color:#52677d;">This code expires in 10 minutes. Please do not share it with anyone.</p>
        <p style="margin:0;color:#2c5677;font-size:13px;line-height:1.45;">If you did not request this login code, please contact your MediFlow administrator immediately.</p>
      </div>
      <div style="max-width:520px;margin:18px auto 0;border-top:1px solid #d8e6f1;padding-top:14px;text-align:center;color:#8a9bae;font-size:12px;">
        MediFlow secure login verification
      </div>
    </div>
    """
    return text_message, html_message


def send_resend_email(to_email, subject, text_message, html_message):
    api_key = getattr(settings, "RESEND_API_KEY", "")
    from_email = getattr(settings, "RESEND_FROM_EMAIL", "")

    if not api_key or not from_email:
        try:
            delivered = send_mail(subject, text_message, settings.DEFAULT_FROM_EMAIL, [to_email], html_message=html_message, fail_silently=False)
            if not delivered:
                raise VerificationDeliveryError("The email provider did not accept the verification email. Contact CHO support.")
        except VerificationDeliveryError:
            raise
        except smtplib.SMTPAuthenticationError as exc:
            logger.error("Verification SMTP authentication rejected (SMTP status %s). Check configured mail credentials.", exc.smtp_code)
            raise VerificationDeliveryError("The email server rejected the configured credentials. Contact CHO support to update the email app password.") from exc
        except smtplib.SMTPServerDisconnected as exc:
            logger.error("Verification SMTP connection closed unexpectedly. Check mail credentials and SMTP access.")
            raise VerificationDeliveryError("The email server closed the connection. Contact CHO support to check email credentials and SMTP access.") from exc
        except Exception as exc:
            logger.error("Verification email delivery failed (%s).", type(exc).__name__)
            raise VerificationDeliveryError("Verification email could not be delivered. Contact CHO support.") from exc
        return

    payload = json.dumps(
        {
            "from": from_email,
            "to": [to_email],
            "subject": subject,
            "html": html_message,
            "text": text_message,
        }
    ).encode("utf-8")
    request = Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=15) as response:
            response.read()
    except HTTPError as exc:
        logger.error("Verification email provider rejected delivery (HTTP status %s).", exc.code)
        raise VerificationDeliveryError("Verification email provider rejected delivery. Contact CHO support.") from exc
    except (TimeoutError, URLError) as exc:
        raise VerificationDeliveryError("Verification email service is unavailable. Please retry.") from exc


def send_login_verification_code(user):
    code = get_random_string(6, allowed_chars="0123456789")
    expires_at = timezone.now() + timezone.timedelta(minutes=10)
    verification = EmailVerificationCode.objects.create(
        user=user,
        code=code,
        purpose="login",
        expires_at=expires_at,
        is_used=True,
    )
    text_message, html_message = build_verification_email(code)
    try:
        send_resend_email(
            to_email=user.email,
            subject="MediFlow Login Verification Code",
            text_message=text_message,
            html_message=html_message,
        )
    except VerificationDeliveryError:
        raise
    with transaction.atomic():
        EmailVerificationCode.objects.filter(user=user, purpose="login", is_used=False).exclude(pk=verification.pk).update(is_used=True)
        verification.is_used = False
        verification.save(update_fields=["is_used"])
    verification._delivery_backend = "resend" if settings.RESEND_API_KEY and settings.RESEND_FROM_EMAIL else "smtp"
    return verification


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "first_name",
            "last_name",
            "email",
            "role",
            "is_active",
            "last_login",
        )


class StaffActivitySerializer(serializers.ModelSerializer):
    actor_detail = UserSerializer(source="actor", read_only=True)

    class Meta:
        model = StaffActivity
        fields = "__all__"


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        user = authenticate(
            request=self.context.get("request"),
            username=attrs["username"],
            password=attrs["password"],
        )
        if user is None:
            raise serializers.ValidationError("Invalid username or password.")
        if not user.is_active:
            raise serializers.ValidationError("This account is inactive.")

        attrs["user"] = user
        return attrs

    def create_verification(self):
        return send_login_verification_code(self.validated_data["user"])


def validate_login_challenge(user, challenge):
    try:
        payload = signing.loads(challenge, salt="medicena-login", max_age=600)
    except signing.BadSignature as exc:
        raise serializers.ValidationError("Login verification expired. Sign in again.") from exc
    if payload.get("user_id") != user.pk or not user.is_active:
        raise serializers.ValidationError("Invalid login verification request.")


class EmailVerificationSerializer(serializers.Serializer):
    username = serializers.CharField()
    code = serializers.CharField(min_length=6, max_length=6)
    challenge = serializers.CharField(write_only=True)

    def validate(self, attrs):
        try:
            user = User.objects.get(username=attrs["username"])
        except User.DoesNotExist as exc:
            raise serializers.ValidationError("Invalid verification request.") from exc

        validate_login_challenge(user, attrs["challenge"])

        verification = EmailVerificationCode.objects.filter(
            user=user,
            purpose="login",
            is_used=False,
        ).order_by("-created_at").first()

        if not verification:
            raise serializers.ValidationError("No active verification code. Please resend a code.")
        if verification.expires_at < timezone.now():
            verification.is_used = True
            verification.save(update_fields=["is_used"])
            raise serializers.ValidationError("Verification code expired. Please resend a code.")
        if verification.attempts >= 5:
            verification.is_used = True
            verification.save(update_fields=["is_used"])
            raise serializers.ValidationError("Too many attempts. Please resend a code.")
        if verification.code != attrs["code"]:
            verification.attempts += 1
            verification.save(update_fields=["attempts"])
            raise serializers.ValidationError("Invalid verification code.")

        verification.is_used = True
        verification.save(update_fields=["is_used"])
        update_last_login(None, user)
        refresh = RefreshToken.for_user(user)
        attrs["access"] = str(refresh.access_token)
        attrs["refresh"] = str(refresh)
        attrs["user"] = UserSerializer(user).data
        return attrs


class ResendEmailVerificationSerializer(serializers.Serializer):
    username = serializers.CharField()
    challenge = serializers.CharField(write_only=True)

    def validate(self, attrs):
        try:
            user = User.objects.get(username=attrs["username"])
        except User.DoesNotExist as exc:
            raise serializers.ValidationError("Invalid verification request.") from exc
        if not user.email:
            raise serializers.ValidationError("This account has no email address for verification.")
        validate_login_challenge(user, attrs["challenge"])
        attrs["user"] = user
        return attrs

    def create_verification(self):
        return send_login_verification_code(self.validated_data["user"])


class SystemNotificationSerializer(serializers.ModelSerializer):
    sms_status = serializers.SerializerMethodField()
    actor_detail = UserSerializer(source="actor", read_only=True)

    def get_sms_status(self, obj):
        from .models import SMSDelivery
        try:
            return obj.sms_delivery.status
        except SMSDelivery.DoesNotExist:
            return "not_requested"

    class Meta:
        model = SystemNotification
        fields = "__all__"
        read_only_fields = ("recipient", "actor", "created_at", "notification_type", "title", "message", "target_page", "object_type", "object_id", "event_key")

class FacilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Facility
        fields = "__all__"


class StaffProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    first_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    middle_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    last_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    email = serializers.EmailField(write_only=True, required=False, allow_blank=True)
    username = serializers.CharField(write_only=True, required=False)
    password = serializers.CharField(write_only=True, required=False, trim_whitespace=False)
    is_active = serializers.BooleanField(write_only=True, required=False)

    class Meta:
        model = StaffProfile
        fields = "__all__"
        read_only_fields = ("user",)
        extra_kwargs = {
            "facility": {"required": False},
            "position": {"required": False},
        }

    def validate(self, attrs):
        position = attrs.get("position", self.instance.position if self.instance else "")
        barangay_designation = attrs.get("barangay_designation", self.instance.barangay_designation if self.instance else "")
        email = attrs.get("email", self.instance.user.email if self.instance else "").strip()
        request = self.context.get("request")
        if self.instance and request and request.user.role != User.Role.CHO:
            protected = {"position", "facility", "barangay_designation", "is_active"}
            for field in protected & attrs.keys():
                if attrs[field] != getattr(self.instance, field, None):
                    raise serializers.ValidationError({field: "Only CHO administrators can change account assignments."})
        allowed_positions = {"Doctor", "Barangay Health Worker", "OPD Personnel", "Pharmacist", "CHO Administrator"}
        if position not in allowed_positions and not self.instance:
            raise serializers.ValidationError({"position": "Choose a supported staff role."})
        if not self.instance:
            username = attrs.get("username", "").strip()
            if username and User.objects.filter(username=username).exists():
                raise serializers.ValidationError({"username": "This username is already in use."})
            try:
                validate_password(attrs.get("password", ""))
            except DjangoValidationError as exc:
                raise serializers.ValidationError({"password": list(exc.messages)}) from exc

        if not email:
            raise serializers.ValidationError({"email": "A valid email address is required for login verification."})

        if position == "Barangay Health Worker" and not barangay_designation:
            raise serializers.ValidationError(
                {"barangay_designation": "Barangay designation is required for health workers."}
            )

        facility = attrs.get("facility", self.instance.facility if self.instance else None)
        if facility:
            expected_type = Facility.FacilityType.BHC if position == "Barangay Health Worker" else Facility.FacilityType.CHO
            if facility.facility_type != expected_type:
                raise serializers.ValidationError({"facility": "The facility type must match the selected staff role."})

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        first_name = validated_data.pop("first_name", "").strip()
        middle_name = validated_data.pop("middle_name", "").strip()
        last_name = validated_data.pop("last_name", "").strip()
        email = validated_data.pop("email", "").strip()
        username = validated_data.pop("username", "").strip()
        password = validated_data.pop("password", "")
        position = validated_data.get("position") or "Doctor"
        barangay_designation = validated_data.get("barangay_designation", "")

        if not username:
            username_base = "-".join(part.lower() for part in [first_name, last_name] if part) or "staff"
            username = username_base
            suffix = 1
            while User.objects.filter(username=username).exists():
                suffix += 1
                username = f"{username_base}-{suffix}"

        role = {"Doctor": User.Role.DOCTOR, "Barangay Health Worker": User.Role.BHC, "OPD Personnel": User.Role.OPD, "Pharmacist": User.Role.PHARMACIST, "CHO Administrator": User.Role.CHO}[position]
        is_active = validated_data.pop("is_active", True)
        user = User.objects.create_user(
            username=username,
            password=password,
            first_name=" ".join(part for part in [first_name, middle_name] if part) or first_name,
            last_name=last_name,
            email=email,
            role=role,
        )
        user.is_active = is_active
        user.save(update_fields=["is_active"])

        if "facility" not in validated_data:
            if role == User.Role.BHC and barangay_designation:
                facility, _ = Facility.objects.get_or_create(
                    name=f"{barangay_designation} Barangay Health Center",
                    defaults={
                        "facility_type": Facility.FacilityType.BHC,
                        "address": f"{barangay_designation}, Lucena City, Quezon",
                        "contact_number": validated_data.get("contact_number", ""),
                    },
                )
            else:
                facility, _ = Facility.objects.get_or_create(
                    name="Lucena City Health Office",
                    defaults={
                        "facility_type": Facility.FacilityType.CHO,
                        "address": "Lucena City, Quezon",
                        "contact_number": validated_data.get("contact_number", ""),
                    },
                )
            validated_data["facility"] = facility

        return StaffProfile.objects.create(user=user, **validated_data)

    @transaction.atomic
    def update(self, instance, validated_data):
        first_name = validated_data.pop("first_name", None)
        middle_name = validated_data.pop("middle_name", None)
        last_name = validated_data.pop("last_name", None)
        email = validated_data.pop("email", None)
        validated_data.pop("username", None)
        validated_data.pop("password", None)

        is_active = validated_data.pop("is_active", None)
        if is_active is not None:
            if instance.user_id == self.context["request"].user.id and not is_active:
                raise serializers.ValidationError({"is_active": "Use account settings to deactivate your own account."})
            instance.user.is_active = is_active
            instance.user.save(update_fields=["is_active"])
        # Role changes require a deliberate new account to preserve clinical ownership.
        if "position" in validated_data and validated_data["position"] != instance.position:
            raise serializers.ValidationError({"position": "Create an account for the new role; existing roles cannot be reassigned."})

        user_update_fields = []
        if first_name is not None:
            clean_first_name = first_name.strip()
            clean_middle_name = (middle_name or "").strip() if middle_name is not None else ""
            instance.user.first_name = " ".join(part for part in [clean_first_name, clean_middle_name] if part) or clean_first_name
            user_update_fields.append("first_name")
        if last_name is not None:
            instance.user.last_name = last_name.strip()
            user_update_fields.append("last_name")
        if email is not None:
            instance.user.email = email.strip()
            user_update_fields.append("email")
        if user_update_fields:
            instance.user.save(update_fields=user_update_fields)

        return super().update(instance, validated_data)


class DependentInformationSerializer(serializers.Serializer):
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    suffix = serializers.CharField(max_length=150, required=False, allow_blank=True)
    middle_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    phic_id = serializers.CharField(max_length=60, required=False, allow_blank=True)
    member_type = serializers.ChoiceField(choices=["None", "Member", "Dependent"], required=False)
    date_of_birth = serializers.DateField(required=False, allow_null=True)
    sex = serializers.ChoiceField(choices=["", "Male", "Female"], required=False)

    def validate_phic_id(self, value):
        if value and (len(value) > 12 or not value.isascii() or not value.isdigit()):
            raise serializers.ValidationError("PHIC ID must contain up to 12 digits only.")
        return value

    def validate_date_of_birth(self, value):
        if value and value > timezone.localdate():
            raise serializers.ValidationError("Birth date cannot be in the future.")
        return value.isoformat() if value else None


class PatientProfileSerializer(serializers.ModelSerializer):
    def validate_philhealth_id(self, value):
        if value and (len(value) > 12 or not value.isascii() or not value.isdigit()):
            raise serializers.ValidationError("PhilHealth ID must contain up to 12 digits only.")
        return value

    def validate_contact_number(self, value):
        if value and (len(value) > 11 or not value.isascii() or not value.isdigit()):
            raise serializers.ValidationError("Contact number must contain up to 11 digits only.")
        return value

    dependent_information = serializers.JSONField(required=False)

    def validate_dependent_information(self, value):
        validator = DependentInformationSerializer(data=value)
        validator.is_valid(raise_exception=True)
        return dict(validator.validated_data)

    user = UserSerializer(read_only=True)
    first_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    middle_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    last_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    generated_password = serializers.SerializerMethodField()
    was_existing_record = serializers.SerializerMethodField()
    medicine_distributions = serializers.SerializerMethodField()

    class Meta:
        model = PatientProfile
        fields = "__all__"
        read_only_fields = ("user", "created_by")
        extra_kwargs = {
            "address": {"required": False, "allow_blank": True},
            "primary_facility": {"required": False},
        }

    def get_generated_password(self, obj):
        return getattr(obj, "_generated_password", None)

    def get_was_existing_record(self, obj):
        return getattr(obj, "_was_existing_record", False)

    def get_medicine_distributions(self, obj):
        distributions = getattr(obj, RECENT_DISTRIBUTIONS_ATTR, None)
        if distributions is None:
            distributions = ordered_distributions(obj.medicine_distributions.all())[:10]
        return PatientMedicineDistributionSerializer(distributions, many=True).data

    def _get_bhc_barangay(self):
        request = self.context.get("request")

        if not request or not request.user.is_authenticated or request.user.role != User.Role.BHC:
            return ""

        try:
            staff_profile = request.user.staff_profile
        except StaffProfile.DoesNotExist:
            return ""

        if staff_profile.barangay_designation:
            return staff_profile.barangay_designation

        facility_name = staff_profile.facility.name
        return facility_name.replace(" Barangay Health Center", "").strip()

    def create(self, validated_data):
        first_name = validated_data.pop("first_name", "").strip()
        middle_name = validated_data.pop("middle_name", "").strip()
        last_name = validated_data.pop("last_name", "").strip()
        display_name = " ".join(part for part in [first_name, middle_name, last_name] if part)
        bhc_barangay = self._get_bhc_barangay()

        if bhc_barangay:
            validated_data["barangay"] = bhc_barangay
            validated_data["municipality"] = "Lucena City"
            validated_data["province"] = "Quezon"
            validated_data["region"] = "Region IV-A"

        duplicate_query = PatientProfile.objects.select_related("user")
        barangay = validated_data.get("barangay", "")
        philhealth_id = validated_data.get("philhealth_id", "").strip()
        date_of_birth = validated_data.get("date_of_birth")

        if barangay:
            duplicate_query = duplicate_query.filter(barangay=barangay)

        existing_profile = None
        if philhealth_id:
            existing_profile = duplicate_query.filter(philhealth_id=philhealth_id).first()
        elif first_name and last_name and date_of_birth:
            existing_profile = duplicate_query.filter(
                user__first_name=first_name,
                user__last_name=last_name,
                date_of_birth=date_of_birth,
            ).first()

        if existing_profile:
            request = self.context.get("request")
            if (
                request
                and request.user.is_authenticated
                and request.user.role == User.Role.BHC
                and not existing_profile.created_by_id
            ):
                existing_profile.created_by = request.user
                existing_profile.save(update_fields=["created_by"])
            existing_profile._generated_password = None
            existing_profile._was_existing_record = True
            notify_patient_saved(existing_profile, actor=request.user if request else None, created=False)
            return existing_profile

        username_base = slugify(display_name).lower() or "patient"
        username = username_base
        suffix = 1

        while User.objects.filter(username=username).exists():
            suffix += 1
            username = f"{username_base}-{suffix}"

        generated_password = get_random_string(10)

        user = User.objects.create_user(
            username=username,
            password=generated_password,
            first_name=first_name or display_name or "Patient",
            last_name=last_name,
            role=User.Role.PATIENT,
        )

        if "primary_facility" not in validated_data:
            barangay = validated_data.get("barangay", "")
            if barangay:
                facility, _ = Facility.objects.get_or_create(
                    name=f"{barangay} Barangay Health Center",
                    defaults={
                        "facility_type": Facility.FacilityType.BHC,
                        "address": f"{barangay}, Lucena City, Quezon",
                        "contact_number": "",
                    },
                )
            else:
                facility, _ = Facility.objects.get_or_create(
                    name="Lucena City Health Office",
                    defaults={
                        "facility_type": Facility.FacilityType.CHO,
                        "address": "Lucena City, Quezon",
                        "contact_number": "",
                    },
                )
            validated_data["primary_facility"] = facility

        if not validated_data.get("address"):
            parts = [
                validated_data.get("barangay"),
                validated_data.get("municipality"),
                validated_data.get("province"),
            ]
            validated_data["address"] = ", ".join(part for part in parts if part) or "Lucena City, Quezon"

        patient_profile = PatientProfile.objects.create(user=user, **validated_data)
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            patient_profile.created_by = request.user
            patient_profile.save(update_fields=["created_by"])
        patient_profile._generated_password = generated_password
        patient_profile._was_existing_record = False
        notify_patient_saved(patient_profile, actor=request.user if request else None, created=True)
        return patient_profile


class ReferralSerializer(serializers.ModelSerializer):
    consultation_details = serializers.SerializerMethodField()
    patient_detail = PatientProfileSerializer(source="patient", read_only=True)
    referred_by_detail = UserSerializer(source="referred_by", read_only=True)
    source_facility_detail = FacilitySerializer(source="source_facility", read_only=True)
    destination_facility_detail = FacilitySerializer(source="destination_facility", read_only=True)
    assigned_doctor_detail = UserSerializer(source="assigned_doctor", read_only=True)

    def get_consultation_details(self, obj):
        consultations = getattr(obj, "ordered_consultations", None)
        if consultations is None:
            consultations = obj.consultations.select_related("doctor").order_by("-consulted_at")
        return [
            {
                "id": item.pk,
                "diagnosis": item.diagnosis,
                "treatment_plan": item.treatment_plan,
                "consulted_at": item.consulted_at,
                "doctor": item.doctor.get_full_name() or item.doctor.username,
            }
            for item in consultations
        ]

    class Meta:
        model = Referral
        fields = "__all__"
        read_only_fields = ("created_at", "updated_at")
        extra_kwargs = {
            "referred_by": {"required": False},
            "source_facility": {"required": False},
            "destination_facility": {"required": False},
            "reason": {"required": False, "allow_blank": True},
        }

    def validate(self, attrs):
        user = self.context["request"].user
        if user.role == User.Role.DOCTOR:
            if set(attrs) - {"status"}:
                raise serializers.ValidationError("Doctors can update consultation progress only.")
            if attrs.get("status") not in {Referral.Status.ACCEPTED, Referral.Status.COMPLETED}:
                raise serializers.ValidationError({"status": "Choose accepted or completed."})
            if self.instance and (self.instance.status in {Referral.Status.CANCELLED, Referral.Status.REJECTED} or (attrs.get("status") == Referral.Status.COMPLETED and self.instance.status not in {Referral.Status.ACCEPTED, Referral.Status.COMPLETED})):
                raise serializers.ValidationError({"status": "This referral cannot move to the selected clinical status."})
        if user.role == User.Role.BHC:
            if "assigned_doctor" in attrs:
                raise serializers.ValidationError({"assigned_doctor": "Doctor assignment is managed by OPD."})
            patient = attrs.get("patient", self.instance.patient if self.instance else None)
            try:
                profile = user.staff_profile
            except StaffProfile.DoesNotExist as exc:
                raise serializers.ValidationError("Your account needs a BHC facility.") from exc
            if patient and patient.primary_facility_id != profile.facility_id and (not profile.barangay_designation or patient.barangay != profile.barangay_designation):
                raise serializers.ValidationError({"patient": "This patient belongs to another BHC."})
            if self.instance and self.instance.status not in {Referral.Status.PENDING, Referral.Status.SEEN}:
                raise serializers.ValidationError("This referral is already being processed by OPD or a doctor.")
            if attrs.get("status", Referral.Status.PENDING) not in {Referral.Status.PENDING, Referral.Status.CANCELLED}:
                raise serializers.ValidationError({"status": "BHC can submit or cancel referrals."})
            if "referred_by" in attrs and attrs["referred_by"] != user:
                raise serializers.ValidationError({"referred_by": "You cannot submit as another user."})
            if "source_facility" in attrs and attrs["source_facility"] != profile.facility:
                raise serializers.ValidationError({"source_facility": "Use your assigned BHC facility."})
        if "assigned_doctor" in attrs and attrs["assigned_doctor"]:
            doctor = attrs["assigned_doctor"]
            if doctor.role != User.Role.DOCTOR or not doctor.is_active:
                raise serializers.ValidationError({"assigned_doctor": "Choose an active doctor."})
        return attrs

    def create(self, validated_data):
        request = self.context.get("request")

        if "referred_by" not in validated_data and request and request.user.is_authenticated:
            validated_data["referred_by"] = request.user

        if "source_facility" not in validated_data:
            patient = validated_data.get("patient")
            if patient and patient.barangay:
                facility, _ = Facility.objects.get_or_create(
                    name=f"{patient.barangay} Barangay Health Center",
                    defaults={
                        "facility_type": Facility.FacilityType.BHC,
                        "address": f"{patient.barangay}, Lucena City, Quezon",
                        "contact_number": "",
                    },
                )
                validated_data["source_facility"] = facility
            elif patient:
                validated_data["source_facility"] = patient.primary_facility
            else:
                facility, _ = Facility.objects.get_or_create(
                    name="Lucena City Health Office",
                    defaults={
                        "facility_type": Facility.FacilityType.CHO,
                        "address": "Lucena City, Quezon",
                        "contact_number": "",
                    },
                )
                validated_data["source_facility"] = facility

        if "destination_facility" not in validated_data:
            facility, _ = Facility.objects.get_or_create(
                name="Lucena City Health Office",
                defaults={
                    "facility_type": Facility.FacilityType.CHO,
                    "address": "Lucena City, Quezon",
                    "contact_number": "",
                },
            )
            validated_data["destination_facility"] = facility

        if not validated_data.get("reason"):
            validated_data["reason"] = validated_data.get("specialty") or "For assessment"

        referral = Referral.objects.create(**validated_data)
        sync_referral_to_gis_disease_case(referral)
        notify_referral_created(referral, actor=request.user if request else None)
        return referral

    def update(self, instance, validated_data):
        request = self.context.get("request")
        previous_status = instance.status
        previous_doctor_id = instance.assigned_doctor_id
        referral = super().update(instance, validated_data)
        notify_referral_updated(
            referral,
            actor=request.user if request else None,
            previous_status=previous_status,
            previous_doctor_id=previous_doctor_id,
        )
        return referral


class ConsultationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Consultation
        fields = "__all__"
        read_only_fields = ("doctor", "consulted_at")

    def validate(self, attrs):
        referral = attrs.get("referral", self.instance.referral if self.instance else None)
        user = self.context["request"].user
        if not referral or referral.assigned_doctor_id != user.id:
            raise serializers.ValidationError({"referral": "You can consult only your assigned patients."})
        if referral.status not in {Referral.Status.ACCEPTED, Referral.Status.COMPLETED}:
            raise serializers.ValidationError({"referral": "Accept the referral before recording a consultation."})
        return attrs


class DiseaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Disease
        fields = ("id", "disease_name", "category")


class MedicineSerializer(serializers.ModelSerializer):
    class Meta:
        model = Medicine
        fields = "__all__"


MEDICINE_DOSAGE_CHOICES = {
    presentation["form"]: ()
    for item in MEDICINE_CATALOG
    for presentation in item["reference_presentations"]
}


class MedicineInventorySerializer(serializers.ModelSerializer):
    formulation_verified = serializers.BooleanField(write_only=True, required=True)
    facility = serializers.PrimaryKeyRelatedField(queryset=Facility.objects.all(), required=False)
    medicine = serializers.PrimaryKeyRelatedField(queryset=Medicine.objects.all(), required=False)
    facility_detail = FacilitySerializer(source="facility", read_only=True)
    medicine_detail = MedicineSerializer(source="medicine", read_only=True)
    medicine_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    category = serializers.CharField(write_only=True, required=False, allow_blank=True)
    medicine_type = serializers.CharField(write_only=True, required=False, allow_blank=True)
    dosage = serializers.CharField(write_only=True, required=False, allow_blank=True)
    issued_date = serializers.DateField(write_only=True, required=False, allow_null=True)
    expiry_date = serializers.DateField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = MedicineInventory
        fields = "__all__"
        read_only_fields = ("updated_at", "created_by")
        validators = []
        extra_kwargs = {
            "facility": {"required": False},
            "medicine": {"required": False},
        }

    def _get_request_facility(self):
        request = self.context.get("request")

        if not request or not request.user.is_authenticated:
            return None

        try:
            return request.user.staff_profile.facility
        except StaffProfile.DoesNotExist:
            return None

    def _get_inventory_facility(self, validated_data):
        request_facility = self._get_request_facility()
        if request_facility:
            if "facility" in validated_data and validated_data["facility"] != request_facility:
                raise serializers.ValidationError({"facility": "Use your assigned inventory facility."})
            return request_facility

        facility = validated_data.get("facility")
        if facility:
            return facility

        facility, _ = Facility.objects.get_or_create(
            name="Lucena City Health Office",
            defaults={
                "facility_type": Facility.FacilityType.CHO,
                "address": "Lucena City, Quezon",
                "contact_number": "",
            },
        )
        return facility

    def _pop_medicine_fields(self, validated_data):
        return {
            "category": validated_data.pop("category", ""),
            "medicine_type": validated_data.pop("medicine_type", ""),
            "dosage": validated_data.pop("dosage", ""),
            "issued_date": validated_data.pop("issued_date", None),
            "expiry_date": validated_data.pop("expiry_date", None),
        }

    def validate(self, attrs):
        if not attrs.pop("formulation_verified", False):
            raise serializers.ValidationError({"formulation_verified": "Confirm the actual product label and authorized formulation before saving stock."})
        issued = attrs.get("issued_date")
        expiry = attrs.get("expiry_date")
        if not issued or not expiry:
            raise serializers.ValidationError({"expiry_date": "Actual issue and expiry dates are required."})
        if expiry <= issued:
            raise serializers.ValidationError({"expiry_date": "Expiry must be after the issue date."})
        # Allow historical records to be edited without making expired stock newly available.
        if (not self.instance or expiry != self.instance.medicine.expiry_date) and expiry <= timezone.localdate():
            raise serializers.ValidationError({"expiry_date": "New stock must not be expired."})
        return attrs

    def _validate_medicine_fields(self, medicine_fields):
        if medicine_fields.get("medicine_type") not in MEDICINE_DOSAGE_CHOICES:
            raise serializers.ValidationError({"medicine_type": "Select an available dosage form."})
        strength = medicine_fields.get("dosage", "").strip()
        if not strength or strength.lower() in {"invalid", "to be verified", "not set"}:
            raise serializers.ValidationError({"dosage": "Enter the verified strength from the product label."})

    def _apply_medicine_fields(self, medicine, medicine_fields):
        update_fields = []
        for field, value in medicine_fields.items():
            if value not in ("", None) and getattr(medicine, field) != value:
                setattr(medicine, field, value)
                update_fields.append(field)
        if update_fields:
            medicine.save(update_fields=update_fields)

    def _get_or_create_medicine(self, validated_data):
        medicine = validated_data.get("medicine")
        medicine_name = validated_data.pop("medicine_name", "").strip()
        medicine_fields = self._pop_medicine_fields(validated_data)
        self._validate_medicine_fields(medicine_fields)

        if medicine:
            medicine_name = medicine_name or medicine.name

        if not medicine_name:
            raise serializers.ValidationError({"medicine_name": "Medicine name is required."})

        from .medicine_catalog import MEDICINE_CATALOG
        catalog_entry = next((item for item in MEDICINE_CATALOG if item["name"] == medicine_name), None)
        legacy_unchanged = self.instance and medicine_name == self.instance.medicine.name and medicine_fields["category"] == self.instance.medicine.category
        if not catalog_entry and not legacy_unchanged:
            raise serializers.ValidationError({"medicine_name": "Select a medicine from the predefined list."})
        if catalog_entry:
            aliases = {"Analgesic": "Supportive/Other Therapy", "Oral Rehydration": "Supportive/Other Therapy", "Vitamins": "Supportive/Other Therapy", "Antibiotic": "Anti-infectious", "Antihypertensive": "Anti-hypertensive and Cardiology"}
            selected_category = aliases.get(medicine_fields["category"], medicine_fields["category"])
            if selected_category != catalog_entry["category"] and not legacy_unchanged:
                raise serializers.ValidationError({"category": "Selected medicine does not belong to this category."})
            if not legacy_unchanged:
                medicine_fields["category"] = catalog_entry["category"]

        medicine = Medicine.objects.filter(
            name__iexact=medicine_name,
            medicine_type__iexact=medicine_fields["medicine_type"],
            dosage__iexact=medicine_fields["dosage"],
            issued_date=medicine_fields["issued_date"],
            expiry_date=medicine_fields["expiry_date"],
        ).first()

        if not medicine:
            medicine = Medicine.objects.create(name=medicine_name)

        self._apply_medicine_fields(medicine, medicine_fields)
        return medicine

    @transaction.atomic
    def create(self, validated_data):
        medicine = self._get_or_create_medicine(validated_data)
        facility = self._get_inventory_facility(validated_data)

        inventory, created = MedicineInventory.objects.get_or_create(
            facility=facility, medicine=medicine,
            defaults={"quantity": validated_data.get("quantity", 0),
                      "created_by": self.context["request"].user if self.context.get("request") else None},
        )
        if not created:
            raise serializers.ValidationError({"medicine": "This stock record already exists. Use Edit to change its quantity."})
        return inventory

    @transaction.atomic
    def update(self, instance, validated_data):
        medicine = self._get_or_create_medicine(validated_data)
        matching_inventory = MedicineInventory.objects.filter(
            facility=instance.facility,
            medicine=medicine,
        ).exclude(pk=instance.pk).first()

        if matching_inventory:
            raise serializers.ValidationError({"medicine": "Another stock record already uses this formulation and dates."})

        validated_data["medicine"] = medicine
        return super().update(instance, validated_data)


class MedicineRequestSerializer(serializers.ModelSerializer):
    dispatched_by_detail = UserSerializer(source="dispatched_by", read_only=True)
    received_by_detail = UserSerializer(source="received_by", read_only=True)
    requested_by_detail = UserSerializer(source="requested_by", read_only=True)
    patient_detail = PatientProfileSerializer(source="patient", read_only=True)
    medicine_detail = MedicineSerializer(source="medicine", read_only=True)
    source_facility_detail = FacilitySerializer(source="source_facility", read_only=True)
    medicine_name = serializers.CharField(write_only=True, required=False, allow_blank=True)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if self.context.get("request") and self.context["request"].user.role == User.Role.PHARMACIST:
            data.pop("patient_detail", None)
        return data

    class Meta:
        model = MedicineRequest
        fields = "__all__"
        read_only_fields = ("created_at", "requested_by", "source_facility", "dispatched_at", "received_at", "dispatch_facility", "dispatched_by", "received_by")
        extra_kwargs = {
            "requested_by": {"required": False},
            "patient": {"required": False, "allow_null": True},
            "medicine": {"required": False},
            "source_facility": {"required": False},
        }

    def _get_request_facility(self):
        request = self.context.get("request")

        if request and request.user.is_authenticated:
            try:
                return request.user.staff_profile.facility
            except StaffProfile.DoesNotExist:
                pass

        facility, _ = Facility.objects.get_or_create(
            name="Lucena City Health Office",
            defaults={
                "facility_type": Facility.FacilityType.CHO,
                "address": "Lucena City, Quezon",
                "contact_number": "",
            },
        )
        return facility

    def validate_quantity(self, value):
        if value < 1:
            raise serializers.ValidationError("Quantity must be at least 1.")
        if value > 1000:
            raise serializers.ValidationError("Quantity cannot exceed 1000.")
        return value

    def validate(self, attrs):
        user = self.context["request"].user
        if not self.instance:
            if attrs.get("status", MedicineRequest.Status.REQUESTED) != MedicineRequest.Status.REQUESTED:
                raise serializers.ValidationError({"status": "New requests must start as requested."})
            try:
                if user.staff_profile.facility.facility_type != Facility.FacilityType.BHC:
                    raise serializers.ValidationError("Medicine supply requests require a BHC facility.")
            except StaffProfile.DoesNotExist as exc:
                raise serializers.ValidationError("Your account needs a BHC facility.") from exc
            patient = attrs.get("patient")
            profile = user.staff_profile
            if patient and patient.primary_facility_id != profile.facility_id and (not profile.barangay_designation or patient.barangay != profile.barangay_designation):
                raise serializers.ValidationError({"patient": "This patient belongs to another BHC."})
        elif set(attrs) - {"status", "notes"}:
            raise serializers.ValidationError("Submitted requests cannot change medicine, quantity, or ownership.")
        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        medicine_name = validated_data.pop("medicine_name", "").strip()

        if "requested_by" not in validated_data and request and request.user.is_authenticated:
            validated_data["requested_by"] = request.user

        if "source_facility" not in validated_data:
            validated_data["source_facility"] = self._get_request_facility()

        if "medicine" not in validated_data:
            if not medicine_name:
                raise serializers.ValidationError({"medicine_name": "Medicine name is required."})
            medicine = Medicine.objects.filter(name__iexact=medicine_name).first()
            if not medicine:
                medicine = Medicine.objects.create(name=medicine_name)
            validated_data["medicine"] = medicine

        medicine_request = MedicineRequest.objects.create(**validated_data)
        notify_medicine_request_created(medicine_request, actor=request.user if request else None)
        return medicine_request

    @transaction.atomic
    def update(self, instance, validated_data):
        user = self.context["request"].user
        instance = MedicineRequest.objects.select_for_update().get(pk=instance.pk)
        previous_status = instance.status
        next_status = validated_data.get("status", previous_status)
        transitions = {
            MedicineRequest.Status.REQUESTED: {MedicineRequest.Status.APPROVED, MedicineRequest.Status.DECLINED},
            MedicineRequest.Status.APPROVED: {MedicineRequest.Status.DISPATCHED, MedicineRequest.Status.DECLINED},
            MedicineRequest.Status.DISPATCHED: {MedicineRequest.Status.RELEASED},
        }
        if next_status != previous_status:
            if next_status not in transitions.get(previous_status, set()):
                raise serializers.ValidationError({"status": "This status transition is not allowed."})
            if user.role == User.Role.BHC:
                allowed = (previous_status == MedicineRequest.Status.DISPATCHED and next_status == MedicineRequest.Status.RELEASED) or (previous_status == MedicineRequest.Status.REQUESTED and next_status == MedicineRequest.Status.DECLINED)
                if not allowed:
                    raise serializers.ValidationError({"status": "BHC can cancel pending requests or confirm receipt of dispatched supplies."})
            elif next_status == MedicineRequest.Status.RELEASED:
                raise serializers.ValidationError({"status": "The receiving BHC must confirm delivery."})
            if next_status == MedicineRequest.Status.DISPATCHED:
                try:
                    facility = user.staff_profile.facility
                except StaffProfile.DoesNotExist:
                    facility = Facility.objects.filter(facility_type=Facility.FacilityType.CHO).first()
                if not facility or facility.facility_type != Facility.FacilityType.CHO:
                    raise serializers.ValidationError("Dispatch requires an assigned CHO pharmacy facility.")
                stock = MedicineInventory.objects.select_for_update().filter(facility=facility, medicine=instance.medicine).first()
                if not stock or stock.quantity < instance.quantity:
                    raise serializers.ValidationError({"status": "Not enough CHO medicine stock to dispatch."})
                changed = decrement_stock(stock.pk, instance.quantity)
                if not changed:
                    raise serializers.ValidationError({"status": "Stock changed; refresh and retry."})
                validated_data.update(dispatched_at=timezone.now(), dispatch_facility=facility, dispatched_by=user)
            elif next_status == MedicineRequest.Status.RELEASED:
                inventory, _ = MedicineInventory.objects.get_or_create(facility=instance.source_facility, medicine=instance.medicine, defaults={"quantity": 0, "created_by": user})
                MedicineInventory.objects.filter(pk=inventory.pk).update(quantity=F("quantity") + instance.quantity)
                validated_data.update(received_at=timezone.now(), received_by=user)
        medicine_request = super().update(instance, validated_data)
        notify_medicine_request_updated(medicine_request, actor=user, previous_status=previous_status)
        return medicine_request



class PatientMedicineDistributionSerializer(serializers.ModelSerializer):
    medicine_detail = MedicineSerializer(source="medicine", read_only=True)
    facility_detail = FacilitySerializer(source="facility", read_only=True)
    distributed_by_detail = UserSerializer(source="distributed_by", read_only=True)
    patient_name = serializers.SerializerMethodField()
    patient_barangay = serializers.SerializerMethodField()

    class Meta:
        model = PatientMedicineDistribution
        fields = "__all__"
        read_only_fields = ("distributed_at", "facility", "distributed_by")
        extra_kwargs = {
            "patient": {"required": True},
            "medicine": {"required": True},
        }

    def get_patient_name(self, obj):
        return obj.patient.user.get_full_name() or obj.patient.user.username

    def get_patient_barangay(self, obj):
        return obj.patient.barangay

    def _get_request_facility(self):
        request = self.context.get("request")

        if request and request.user.is_authenticated:
            try:
                return request.user.staff_profile.facility
            except StaffProfile.DoesNotExist:
                pass

        return None

    def validate(self, attrs):
        request = self.context.get("request")
        patient = attrs.get("patient")
        medicine = attrs.get("medicine")
        quantity = attrs.get("quantity") or 0
        facility = self._get_request_facility()

        if not request or not request.user.is_authenticated or request.user.role != User.Role.BHC:
            raise serializers.ValidationError("Only BHC staff can distribute medicine to patients.")

        if not facility:
            raise serializers.ValidationError("Your account has no assigned BHC facility.")

        if patient and patient.primary_facility_id != facility.id:
            try:
                staff_profile = request.user.staff_profile
            except StaffProfile.DoesNotExist:
                staff_profile = None
            if not staff_profile or patient.barangay != staff_profile.barangay_designation:
                raise serializers.ValidationError({"patient": "This patient is not assigned to your BHC."})

        inventory = MedicineInventory.objects.filter(facility=facility, medicine=medicine).first()
        if not inventory:
            raise serializers.ValidationError({"medicine": "This medicine is not in your BHC inventory."})
        if quantity < 1:
            raise serializers.ValidationError({"quantity": "Quantity must be at least 1."})
        if inventory.quantity < quantity:
            raise serializers.ValidationError({"quantity": "Not enough stock available for this distribution."})

        attrs["_inventory"] = inventory
        attrs["_facility"] = facility
        patient_request = attrs.get("request")
        if patient_request and (patient_request.patient_id != patient.pk or patient_request.bhc_facility_id != facility.pk):
            raise serializers.ValidationError({"request": "Select a medicine request belonging to this patient and BHC."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        request = self.context.get("request")
        inventory = validated_data.pop("_inventory")
        facility = validated_data.pop("_facility")
        quantity = validated_data["quantity"]

        patient_request = validated_data.get("request")
        if patient_request:
            patient_request = PatientMedicineRequest.objects.select_for_update().get(pk=patient_request.pk)
            if patient_request.status == PatientMedicineRequest.Status.RECEIVED:
                raise serializers.ValidationError({"request": "This request has already been fulfilled. Record any additional medicine as a separate distribution."})

        changed = decrement_stock(inventory.pk, quantity)
        if not changed:
            raise serializers.ValidationError({"quantity": "Stock changed; refresh and retry."})

        distribution = PatientMedicineDistribution.objects.create(
            **validated_data,
            facility=facility,
            distributed_by=request.user,
        )
        if distribution.request_id:
            patient_request = PatientMedicineRequest.objects.select_for_update().get(pk=distribution.request_id)
            previous_status = patient_request.status
            patient_request.status = PatientMedicineRequest.Status.RECEIVED
            patient_request.save(update_fields=["status", "updated_at"])
            notify_patient_medicine_request_updated(patient_request, actor=request.user, previous_status=previous_status)
        notify_patient_medicine_distributed(distribution, actor=request.user)
        return distribution


class PatientMedicineRequestSerializer(serializers.ModelSerializer):
    patient = serializers.PrimaryKeyRelatedField(queryset=PatientProfile.objects.all(), required=False)
    patient_detail = PatientProfileSerializer(source="patient", read_only=True)
    requested_by_detail = UserSerializer(source="requested_by", read_only=True)
    bhc_facility_detail = FacilitySerializer(source="bhc_facility", read_only=True)
    prescription_url = serializers.SerializerMethodField()
    patient_name = serializers.SerializerMethodField()
    patient_barangay = serializers.SerializerMethodField()

    class Meta:
        model = PatientMedicineRequest
        fields = "__all__"
        read_only_fields = ("requested_by", "bhc_facility", "created_at", "updated_at")

    def get_prescription_url(self, obj):
        if not obj.prescription:
            return ""
        request = self.context.get("request")
        url = obj.prescription.url
        return request.build_absolute_uri(url) if request else url

    def get_patient_name(self, obj):
        return obj.patient.user.get_full_name() or obj.patient.user.username

    def get_patient_barangay(self, obj):
        return obj.patient.barangay

    def _get_patient(self):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            raise serializers.ValidationError("Authentication is required.")

        if request.user.role == User.Role.BHC:
            patient = self.initial_data.get("patient")
            if not patient:
                raise serializers.ValidationError({"patient": "Patient is required for walk-in medicine requests."})
            try:
                selected = PatientProfile.objects.get(pk=patient)
                profile = request.user.staff_profile
                if selected.primary_facility_id != profile.facility_id and (not profile.barangay_designation or selected.barangay != profile.barangay_designation):
                    raise serializers.ValidationError({"patient": "This patient belongs to another BHC."})
                return selected
            except PatientProfile.DoesNotExist as exc:
                raise serializers.ValidationError({"patient": "Selected patient was not found."}) from exc

        if request.user.role != User.Role.PATIENT:
            raise serializers.ValidationError("Only patient accounts can create medicine requests.")
        try:
            return request.user.patient_profile
        except PatientProfile.DoesNotExist as exc:
            raise serializers.ValidationError("This account has no patient profile.") from exc

    def validate(self, attrs):
        request = self.context.get("request")

        # Restrict new selections, preserving legacy prescription-only requests
        # and leaving inventory and existing request status updates unchanged.
        if request and request.method == "POST":
            from .medicine_catalog import MEDICINE_NAMES
            selected = attrs.get("medicine_name", "")
            if (selected and selected not in MEDICINE_NAMES) or (request.user.role == User.Role.PATIENT and not selected):
                raise serializers.ValidationError({"medicine_name": "Select a medicine from the predefined list."})

        if request and request.method == "POST":
            is_walk_in = request.user.is_authenticated and request.user.role == User.Role.BHC
            if not is_walk_in and not attrs.get("prescription"):
                raise serializers.ValidationError({"prescription": "Upload the doctor's prescription before requesting medicine."})

            if not is_walk_in and attrs.get("status", PatientMedicineRequest.Status.REQUESTED) != PatientMedicineRequest.Status.REQUESTED:
                raise serializers.ValidationError({"status": "Patient requests must start as requested."})
        elif self.instance:
            if self.instance.status == PatientMedicineRequest.Status.RECEIVED and attrs.get("status", self.instance.status) != self.instance.status:
                raise serializers.ValidationError({"status": "Received requests cannot be moved back to an earlier status."})
            if request.user.role == User.Role.PATIENT:
                if set(attrs) - {"notes", "prescription"}:
                    raise serializers.ValidationError("Patients may edit notes and prescriptions only.")
                if self.instance.status != PatientMedicineRequest.Status.REQUESTED:
                    raise serializers.ValidationError("Your BHC has already started reviewing this request.")
            elif set(attrs) - {"status", "notes"}:
                raise serializers.ValidationError("BHC may update request status and notes only.")
            if attrs.get("status") == PatientMedicineRequest.Status.RECEIVED and not self.instance.distributions.exists():
                raise serializers.ValidationError({"status": "Record the medicine distribution before marking the request received."})

        return attrs

    def create(self, validated_data):
        patient = self._get_patient()
        request = self.context["request"]
        validated_data.pop("patient", None)
        facility = patient.primary_facility
        validated_data["medicine_name"] = validated_data.get("medicine_name") or (
            "Walk-in medicine request" if request.user.role == User.Role.BHC else "Prescription request"
        )
        validated_data["quantity"] = validated_data.get("quantity") or 1
        if request.user.role == User.Role.BHC:
            validated_data["status"] = PatientMedicineRequest.Status.WALK_IN
            try:
                facility = request.user.staff_profile.facility
            except StaffProfile.DoesNotExist:
                pass

        if not facility or facility.facility_type != Facility.FacilityType.BHC:
            facility, _ = Facility.objects.get_or_create(
                name=f"{patient.barangay} Barangay Health Center" if patient.barangay else "Lucena City Health Office",
                defaults={
                    "facility_type": Facility.FacilityType.BHC if patient.barangay else Facility.FacilityType.CHO,
                    "address": f"{patient.barangay}, Lucena City, Quezon" if patient.barangay else "Lucena City, Quezon",
                    "contact_number": "",
                },
            )

        patient_request = PatientMedicineRequest.objects.create(
            **validated_data,
            patient=patient,
            requested_by=request.user,
            bhc_facility=facility,
        )
        notify_patient_medicine_request_created(patient_request, actor=request.user)
        return patient_request

    def update(self, instance, validated_data):
        request = self.context.get("request")
        previous_status = instance.status
        patient_request = super().update(instance, validated_data)
        notify_patient_medicine_request_updated(
            patient_request,
            actor=request.user if request else None,
            previous_status=previous_status,
        )
        return patient_request


