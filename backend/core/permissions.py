from rest_framework.permissions import BasePermission, SAFE_METHODS

from .models import User


STAFF = {User.Role.CHO, User.Role.OPD, User.Role.PHARMACIST, User.Role.BHC, User.Role.DOCTOR}
CLINICAL = {User.Role.CHO, User.Role.OPD, User.Role.BHC, User.Role.DOCTOR, User.Role.PATIENT}


class RoleAccess(BasePermission):
    """Endpoint capabilities; record ownership is enforced by scoped querysets."""

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        role = request.user.role
        if request.method in SAFE_METHODS:
            return role in getattr(view, "read_roles", STAFF)
        if request.method == "DELETE":
            return role in getattr(view, "delete_roles", {User.Role.CHO})
        if request.method == "POST":
            return role in getattr(view, "create_roles", {User.Role.CHO})
        return role in getattr(view, "update_roles", {User.Role.CHO})


class CHOOnly(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == User.Role.CHO


class HealthMonitoringAccess(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in {User.Role.CHO, User.Role.BHC}
