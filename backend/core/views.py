from django.db import transaction
from django.db.models import Prefetch, Q
from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from .address_data import LUCENA_CITY_ADDRESS
from .clinical_queries import prefetch_recent_distributions
from .permissions import RoleAccess, CHOOnly, STAFF, CLINICAL
from .models import (
    Consultation,
    Facility,
    PatientProfile,
    Referral,
    StaffProfile,
    StaffActivity,
    SystemNotification,
    User,
)
from .serializers import (
    ConsultationSerializer,
    FacilitySerializer,
    PatientProfileSerializer,
    ReferralSerializer,
    StaffProfileSerializer,
    StaffActivitySerializer,
    SystemNotificationSerializer,
    UserSerializer,
)
from .view_mixins import ActivityMixin


@api_view(["GET"])
@permission_classes([AllowAny])
def lucena_city_address_view(request):
    return Response(LUCENA_CITY_ADDRESS)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def doctors_view(request):
    doctors = []

    for profile in StaffProfile.objects.select_related("user", "facility").filter(user__role=User.Role.DOCTOR, user__is_active=True):
            doctors.append(
                {
                    "id": profile.id,
                    "user_id": profile.user.id,
                    "name": profile.user.get_full_name() or profile.user.username,
                    "display_name": profile.user.get_full_name() or profile.user.username,
                    "username": profile.user.username,
                    "specialty": profile.specialty,
                    "facility": profile.facility.name,
                    "status": "Active" if profile.user.is_active else "Inactive",
                }
            )

    return Response(doctors)


class SystemNotificationViewSet(viewsets.ModelViewSet):
    serializer_class = SystemNotificationSerializer
    http_method_names = ["get", "patch", "head", "options"]

    def get_queryset(self):
        queryset = SystemNotification.objects.select_related("recipient", "actor", "sms_delivery").filter(
            recipient=self.request.user,
        ).order_by("-created_at")
        return queryset[:200] if self.action == "list" else queryset

    def perform_update(self, serializer):
        serializer.save(recipient=self.request.user)


def scope_bhc_patients(queryset, user):
    try:
        profile = user.staff_profile
    except StaffProfile.DoesNotExist:
        return queryset.none()
    scope = Q(primary_facility=profile.facility)
    if profile.barangay_designation:
        scope |= Q(barangay=profile.barangay_designation)
    return queryset.filter(scope)


class StaffActivityViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [CHOOnly]
    queryset = StaffActivity.objects.select_related("actor").all()
    serializer_class = StaffActivitySerializer

    def get_queryset(self):
        # Bound the feed without returning clinical payloads or credentials.
        return super().get_queryset() if self.action == "retrieve" else super().get_queryset()[:500]


class UserViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [CHOOnly]
    queryset = User.objects.order_by("username")
    serializer_class = UserSerializer


class FacilityViewSet(ActivityMixin, viewsets.ModelViewSet):
    permission_classes = [RoleAccess]
    queryset = Facility.objects.order_by("name")
    serializer_class = FacilitySerializer


class StaffProfileViewSet(ActivityMixin, viewsets.ModelViewSet):
    permission_classes = [RoleAccess]
    update_roles = STAFF
    queryset = StaffProfile.objects.select_related("user", "facility").order_by("user__username")
    serializer_class = StaffProfileSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        return queryset if self.request.user.role == User.Role.CHO else queryset.filter(user=self.request.user)


class PatientProfileViewSet(ActivityMixin, viewsets.ModelViewSet):
    permission_classes = [RoleAccess]
    read_roles = CLINICAL
    create_roles = update_roles = {User.Role.CHO, User.Role.OPD, User.Role.BHC}
    queryset = PatientProfile.objects.select_related("user", "primary_facility").prefetch_related(
        prefetch_recent_distributions(),
    ).order_by("user__username")
    serializer_class = PatientProfileSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        if user.role in {User.Role.CHO, User.Role.OPD}:
            return queryset
        if user.role == User.Role.PATIENT:
            return queryset.filter(user=user)
        if user.role == User.Role.DOCTOR:
            return queryset.filter(referrals__assigned_doctor=user).distinct()
        if user.role == User.Role.BHC:
            return scope_bhc_patients(queryset, user)
        return queryset.none()


class ReferralViewSet(ActivityMixin, viewsets.ModelViewSet):
    permission_classes = [RoleAccess]
    read_roles = CLINICAL
    create_roles = {User.Role.OPD, User.Role.BHC}
    update_roles = {User.Role.OPD, User.Role.BHC, User.Role.DOCTOR}
    delete_roles = set()
    queryset = Referral.objects.select_related(
        "patient",
        "patient__user",
        "referred_by",
        "source_facility",
        "destination_facility",
        "assigned_doctor",
    ).prefetch_related(
        prefetch_recent_distributions("patient__medicine_distributions"),
        Prefetch("consultations", queryset=Consultation.objects.select_related("doctor").order_by("-consulted_at"), to_attr="ordered_consultations"),
    ).order_by("-created_at")
    serializer_class = ReferralSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        if not user.is_authenticated:
            return queryset.none()

        if user.role == User.Role.PATIENT:
            try:
                return queryset.filter(patient=user.patient_profile)
            except PatientProfile.DoesNotExist:
                return queryset.none()

        if user.role == User.Role.DOCTOR:
            return queryset.filter(assigned_doctor=user)

        if user.role != User.Role.BHC:
            return queryset

        return queryset.filter(patient__in=scope_bhc_patients(PatientProfile.objects.all(), user))


class ConsultationViewSet(ActivityMixin, viewsets.ModelViewSet):
    permission_classes = [RoleAccess]
    read_roles = CLINICAL
    create_roles = update_roles = {User.Role.DOCTOR}
    queryset = Consultation.objects.select_related("referral", "doctor").order_by("-consulted_at")
    serializer_class = ConsultationSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        if not user.is_authenticated:
            return queryset.none()

        if user.role == User.Role.DOCTOR:
            return queryset.filter(doctor=user)
        if user.role == User.Role.PATIENT:
            return queryset.filter(referral__patient__user=user)
        if user.role == User.Role.BHC:
            return queryset.filter(referral__patient__in=scope_bhc_patients(PatientProfile.objects.all(), user))
        return queryset if user.role in {User.Role.CHO, User.Role.OPD} else queryset.none()

    @transaction.atomic
    def perform_create(self, serializer):
        instance = serializer.save(doctor=self.request.user)
        self.record_activity("created", instance)
