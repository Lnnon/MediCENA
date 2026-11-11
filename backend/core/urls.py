from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    ConsultationViewSet,
    FacilityViewSet,
    PatientProfileViewSet,
    ReferralViewSet,
    StaffProfileViewSet,
    StaffActivityViewSet,
    SystemNotificationViewSet,
    UserViewSet,
    lucena_city_address_view,
    doctors_view,
)
from .account_views import (
    login_view,
    change_password_view,
    account_status_view,
    me_view,
    heartbeat_view,
    online_users_view,
)
from .gis_views import (
    disease_list_view,
    outbreak_analytics_view,
    purok_list_view,
    purok_disease_map_view,
)
from .medicine_views import (
    MedicineInventoryViewSet,
    PatientMedicineDistributionViewSet,
    PatientMedicineRequestViewSet,
    MedicineRequestViewSet,
    MedicineViewSet,
)
from .panel_views import doctor_statistics, notification_preferences, notification_delivery_logs, system_announcement


router = DefaultRouter()
router.register("users", UserViewSet)
router.register("facilities", FacilityViewSet)
router.register("staff-profiles", StaffProfileViewSet)
router.register("staff-activities", StaffActivityViewSet)
router.register("patient-profiles", PatientProfileViewSet)
router.register("referrals", ReferralViewSet)
router.register("consultations", ConsultationViewSet)
router.register("medicines", MedicineViewSet)
router.register("medicine-inventory", MedicineInventoryViewSet)
router.register("medicine-requests", MedicineRequestViewSet)
router.register("patient-medicine-distributions", PatientMedicineDistributionViewSet)
router.register("patient-medicine-requests", PatientMedicineRequestViewSet)
router.register("notifications", SystemNotificationViewSet, basename="notifications")

urlpatterns = [
    path("users/doctor-statistics/", doctor_statistics, name="doctor_statistics"),
    path("notifications/preferences/", notification_preferences, name="notification_preferences"),
    path("notifications/delivery-logs/", notification_delivery_logs, name="notification_delivery_logs"),
    path("notifications/announcements/", system_announcement, name="system_announcement"),
    path("auth/login/", login_view, name="login"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/me/", me_view, name="me"),
    path("auth/change-password/", change_password_view, name="change_password"),
    path("auth/account-status/", account_status_view, name="account_status"),
    path("auth/heartbeat/", heartbeat_view, name="heartbeat"),
    path("address/lucena-city/", lucena_city_address_view, name="lucena_city_address"),
    path("users/online/", online_users_view, name="online_users"),
    path("doctors/", doctors_view, name="doctors"),
    path("diseases/", disease_list_view, name="diseases"),
    path("gis/puroks/", purok_list_view, name="puroks"),
    path("gis/purok-disease-map/", purok_disease_map_view, name="purok_disease_map"),
    path("analytics/outbreaks/", outbreak_analytics_view, name="outbreak_analytics"),
    path("", include(router.urls)),
]
