from datetime import timedelta
from django.contrib.auth.models import update_last_login
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from .permissions import CHOOnly
from .models import PatientProfile, StaffProfile, User
from .serializers import LoginSerializer, UserSerializer


ONLINE_WINDOW_SECONDS = 90


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    serializer = LoginSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    user = serializer.validated_data["user"]

    update_last_login(None, user)
    refresh = RefreshToken.for_user(user)
    return Response({
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": UserSerializer(user).data,
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me_view(request):
    return Response(UserSerializer(request.user).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password_view(request):
    current_password = request.data.get("current_password", "")
    new_password = request.data.get("new_password", "")

    if not current_password or not new_password:
        return Response(
            {"detail": "Current password and new password are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if len(new_password) < 8:
        return Response(
            {"detail": "New password must be at least 8 characters long."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not request.user.check_password(current_password):
        return Response(
            {"detail": "Current password is incorrect."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    request.user.set_password(new_password)
    request.user.save(update_fields=["password"])
    return Response({"detail": "Password updated successfully."})


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def account_status_view(request):
    is_active = request.data.get("is_active")

    if not isinstance(is_active, bool):
        return Response(
            {"detail": "is_active must be true or false."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    request.user.is_active = is_active
    request.user.save(update_fields=["is_active"])
    return Response(UserSerializer(request.user).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def heartbeat_view(request):
    request.user.last_login = timezone.now()
    request.user.save(update_fields=["last_login"])
    return Response(
        {
            "status": "online",
            "last_seen": request.user.last_login,
        }
    )


@api_view(["GET"])
@permission_classes([CHOOnly])
def online_users_view(request):
    online_since = timezone.now() - timedelta(seconds=ONLINE_WINDOW_SECONDS)

    online_staff = StaffProfile.objects.select_related("user", "facility").filter(
        user__is_active=True,
        user__last_login__gte=online_since,
    ).order_by("-user__last_login")
    online_patients = PatientProfile.objects.select_related("user", "primary_facility").filter(
        user__is_active=True,
        user__last_login__gte=online_since,
    ).order_by("-user__last_login")

    staff_payload = []
    for profile in online_staff:
        staff_payload.append(
            {
                "id": profile.id,
                "name": profile.user.get_full_name() or profile.user.username,
                "role": profile.position or profile.user.get_role_display(),
                "contact": profile.contact_number or "No contact number",
                "area": profile.barangay_designation or profile.specialty or profile.facility.name,
                "status": "Online",
                "last_login": profile.user.last_login,
            }
        )

    patient_payload = []
    for profile in online_patients:
        patient_payload.append(
            {
                "id": profile.id,
                "name": profile.user.get_full_name() or profile.user.username,
                "barangay": profile.barangay or profile.primary_facility.name,
                "last_login": profile.user.last_login,
            }
        )

    return Response(
        {
            "window_seconds": ONLINE_WINDOW_SECONDS,
            "stats": {
                "total_online": online_staff.count() + online_patients.count(),
                "doctors": online_staff.filter(user__role=User.Role.DOCTOR).count(),
                "barangay_health_workers": online_staff.filter(user__role=User.Role.BHC).count(),
                "opd": online_staff.filter(user__role=User.Role.OPD).count(),
                "pharmacists": online_staff.filter(user__role=User.Role.PHARMACIST).count(),
                "patients": online_patients.count(),
            },
            "staff": staff_payload,
            "patients": patient_payload,
        }
    )
