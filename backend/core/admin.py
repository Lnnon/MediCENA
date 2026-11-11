from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import (
    Consultation,
    Facility,
    Medicine,
    MedicineInventory,
    MedicineRequest,
    PatientProfile,
    PatientMedicineRequest,
    Referral,
    StaffProfile,
    User,
)


@admin.register(User)
class MediflowUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (("MediFLOW", {"fields": ("role",)}),)
    add_fieldsets = UserAdmin.add_fieldsets + (("MediFLOW", {"fields": ("role",)}),)
    list_display = ("username", "email", "role", "is_staff", "is_active")
    list_filter = ("role", "is_staff", "is_active")


admin.site.register(Facility)
admin.site.register(StaffProfile)
admin.site.register(PatientProfile)
admin.site.register(Referral)
admin.site.register(Consultation)
admin.site.register(Medicine)
admin.site.register(MedicineInventory)
admin.site.register(MedicineRequest)
admin.site.register(PatientMedicineRequest)
