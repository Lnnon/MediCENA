from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from .clinical_queries import prefetch_recent_distributions
from .permissions import RoleAccess
from .models import (
    Facility,
    Medicine,
    MedicineInventory,
    MedicineRequest,
    PatientMedicineDistribution,
    PatientMedicineRequest,
    StaffProfile,
    User,
)
from .serializers import (
    MedicineInventorySerializer,
    PatientMedicineDistributionSerializer,
    PatientMedicineRequestSerializer,
    MedicineRequestSerializer,
    MedicineSerializer,
)
from .view_mixins import ActivityMixin


class MedicineViewSet(ActivityMixin, viewsets.ModelViewSet):
    permission_classes = [RoleAccess]
    create_roles = update_roles = {User.Role.PHARMACIST}
    delete_roles = set()
    queryset = Medicine.objects.order_by("name")
    serializer_class = MedicineSerializer


class MedicineInventoryViewSet(ActivityMixin, viewsets.ModelViewSet):
    permission_classes = [RoleAccess]
    read_roles = {User.Role.CHO, User.Role.PHARMACIST, User.Role.BHC}
    create_roles = update_roles = {User.Role.PHARMACIST, User.Role.BHC}
    delete_roles = set()
    queryset = MedicineInventory.objects.select_related("facility", "medicine").order_by("facility__name")
    serializer_class = MedicineInventorySerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        if not user.is_authenticated:
            return queryset.none()

        if user.role == User.Role.CHO:
            return queryset if self.request.query_params.get("scope") == "citywide" else queryset.filter(facility__facility_type=Facility.FacilityType.CHO)

        try:
            staff_profile = user.staff_profile
        except StaffProfile.DoesNotExist:
            return queryset.none()
        return queryset.filter(facility_id=staff_profile.facility_id)


class MedicineRequestViewSet(ActivityMixin, viewsets.ModelViewSet):
    permission_classes = [RoleAccess]
    read_roles = {User.Role.CHO, User.Role.PHARMACIST, User.Role.BHC}
    update_roles = {User.Role.PHARMACIST, User.Role.BHC}
    create_roles = {User.Role.BHC}
    delete_roles = set()
    queryset = MedicineRequest.objects.select_related(
        "requested_by",
        "patient",
        "patient__user",
        "medicine",
        "source_facility",
        "dispatched_by",
        "received_by",
    ).prefetch_related(prefetch_recent_distributions("patient__medicine_distributions")).order_by("-created_at")
    serializer_class = MedicineRequestSerializer

    @action(detail=False, methods=["post"], url_path="batch")
    @transaction.atomic
    def batch(self, request):
        items = request.data.get("items") if isinstance(request.data, dict) else None
        if not isinstance(items, list) or not 1 <= len(items) <= 100:
            return Response({"detail": "Select between 1 and 100 medicines."}, status=400)
        if any(not isinstance(item, dict) or set(item) != {"medicine", "quantity"} for item in items):
            return Response({"detail": "Each item must contain a medicine ID and quantity."}, status=400)
        serializer = self.get_serializer(data=items, many=True)
        serializer.is_valid(raise_exception=True)
        medicine_ids = [item["medicine"].pk for item in serializer.validated_data]
        if len(set(medicine_ids)) != len(medicine_ids):
            return Response({"detail": "Select each medicine only once."}, status=400)
        instances = serializer.save()
        for instance in instances:
            self.record_activity("created", instance)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        if user.role in {User.Role.CHO, User.Role.PHARMACIST}:
            return queryset
        if user.role == User.Role.BHC:
            try:
                return queryset.filter(source_facility=user.staff_profile.facility)
            except StaffProfile.DoesNotExist:
                return queryset.none()
        return queryset.none()


class PatientMedicineDistributionViewSet(ActivityMixin, viewsets.ModelViewSet):
    permission_classes = [RoleAccess]
    read_roles = {User.Role.CHO, User.Role.BHC, User.Role.PATIENT}
    create_roles = {User.Role.BHC}
    queryset = PatientMedicineDistribution.objects.select_related(
        "patient",
        "patient__user",
        "medicine",
        "facility",
        "distributed_by",
    ).order_by("-distributed_at")
    serializer_class = PatientMedicineDistributionSerializer
    http_method_names = ["get", "post", "head", "options"]

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

        if user.role == User.Role.CHO:
            return queryset

        try:
            staff_profile = user.staff_profile
        except StaffProfile.DoesNotExist:
            return queryset.none()

        if user.role == User.Role.BHC:
            return queryset.filter(facility=staff_profile.facility)

        return queryset


class PatientMedicineRequestViewSet(ActivityMixin, viewsets.ModelViewSet):
    permission_classes = [RoleAccess]
    read_roles = {User.Role.CHO, User.Role.BHC, User.Role.PATIENT}
    create_roles = update_roles = {User.Role.BHC, User.Role.PATIENT}
    delete_roles = set()
    queryset = PatientMedicineRequest.objects.select_related(
        "patient",
        "patient__user",
        "requested_by",
        "bhc_facility",
    ).prefetch_related(prefetch_recent_distributions("patient__medicine_distributions")).order_by("-created_at")
    serializer_class = PatientMedicineRequestSerializer
    parser_classes = (MultiPartParser, FormParser, JSONParser)

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

        if user.role == User.Role.BHC:
            try:
                staff_profile = user.staff_profile
            except StaffProfile.DoesNotExist:
                return queryset.none()

            return queryset.filter(bhc_facility=staff_profile.facility)

        if user.role == User.Role.CHO:
            return queryset

        return queryset.none()
