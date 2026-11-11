from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        BHC = "bhc", "Barangay Health Center"
        CHO = "cho", "City Health Office"
        OPD = "opd", "Outpatient Department"
        PHARMACIST = "pharmacist", "Pharmacist"
        DOCTOR = "doctor", "Doctor"
        PATIENT = "patient", "Patient"

    role = models.CharField(max_length=20, choices=Role.choices)



class SystemNotification(models.Model):
    class NotificationType(models.TextChoices):
        REFERRAL = "referral", "Referral"
        MEDICINE = "medicine", "Medicine"
        PATIENT = "patient", "Patient"
        SYSTEM = "system", "System"

    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications")
    actor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="sent_notifications",
        null=True,
        blank=True,
    )
    notification_type = models.CharField(max_length=30, choices=NotificationType.choices)
    title = models.CharField(max_length=160)
    message = models.TextField()
    target_page = models.CharField(max_length=80, blank=True)
    object_type = models.CharField(max_length=80, blank=True)
    object_id = models.PositiveIntegerField(null=True, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    event_key = models.CharField(max_length=64, unique=True, null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.title} for {self.recipient.username}"

def notification_categories():
    return ["referral", "medicine", "patient", "system"]


class NotificationPreference(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="notification_preference")
    sms_enabled = models.BooleanField(default=False)
    phone_number = models.CharField(max_length=16, blank=True)
    categories = models.JSONField(default=notification_categories, blank=True)
    consent_at = models.DateTimeField(null=True, blank=True)


class SMSDelivery(models.Model):
    notification = models.OneToOneField(SystemNotification, on_delete=models.SET_NULL, null=True, related_name="sms_delivery")
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sms_deliveries")
    status = models.CharField(max_length=24, default="pending")
    provider_id = models.CharField(max_length=64, null=True, blank=True, unique=True)
    attempts = models.PositiveIntegerField(default=0)
    error_code = models.CharField(max_length=80, blank=True)
    next_attempt_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at", "-id")


class SMSAttempt(models.Model):
    delivery = models.ForeignKey(SMSDelivery, on_delete=models.CASCADE, related_name="logs")
    status = models.CharField(max_length=24)
    error_code = models.CharField(max_length=80, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class StaffActivity(models.Model):
    actor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="activities")
    action = models.CharField(max_length=20)
    resource = models.CharField(max_length=80)
    object_id = models.PositiveIntegerField(null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at", "-id")


class EmailVerificationCode(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="email_verification_codes")
    code = models.CharField(max_length=6)
    purpose = models.CharField(max_length=40, default="login")
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    attempts = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.user.username} verification code"


class Facility(models.Model):
    class FacilityType(models.TextChoices):
        BHC = "bhc", "Barangay Health Center"
        CHO = "cho", "City Health Office"
        CLINIC = "clinic", "Clinic"

    name = models.CharField(max_length=150)
    facility_type = models.CharField(max_length=20, choices=FacilityType.choices)
    address = models.CharField(max_length=255)
    contact_number = models.CharField(max_length=30, blank=True)

    def __str__(self):
        return self.name


class StaffProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="staff_profile")
    facility = models.ForeignKey(Facility, on_delete=models.PROTECT, related_name="staff")
    contact_number = models.CharField(max_length=30, blank=True)
    license_number = models.CharField(max_length=80, blank=True)
    position = models.CharField(max_length=80)
    specialty = models.CharField(max_length=100, blank=True)
    barangay_designation = models.CharField(max_length=80, blank=True)

    def __str__(self):
        return f"{self.user.username} - {self.position}"


class PatientProfile(models.Model):
    class Sex(models.TextChoices):
        MALE = "Male", "Male"
        FEMALE = "Female", "Female"

    class CivilStatus(models.TextChoices):
        SINGLE = "Single", "Single"
        MARRIED = "Married", "Married"
        WIDOWED = "Widowed", "Widowed"

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="patient_profile")
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="created_patient_profiles",
        null=True,
        blank=True,
    )
    primary_facility = models.ForeignKey(Facility, on_delete=models.PROTECT, related_name="patients")
    philhealth_status = models.CharField(max_length=30, default="None")
    philhealth_id = models.CharField(max_length=60, blank=True)
    dependent_information = models.JSONField(default=dict, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    sex = models.CharField(max_length=10, choices=Sex.choices, blank=True)
    civil_status = models.CharField(max_length=20, choices=CivilStatus.choices, default=CivilStatus.SINGLE)
    region = models.CharField(max_length=80, default="Region IV-A")
    province = models.CharField(max_length=80, default="Quezon")
    municipality = models.CharField(max_length=80, default="Lucena City")
    barangay = models.CharField(max_length=80, blank=True)
    address = models.CharField(max_length=255)
    contact_number = models.CharField(max_length=30, blank=True)

    def __str__(self):
        return self.user.get_full_name() or self.user.username


class Referral(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        SEEN = "seen", "Seen"
        ACCEPTED = "accepted", "Accepted"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"
        REJECTED = "rejected", "Rejected"

    patient = models.ForeignKey(PatientProfile, on_delete=models.CASCADE, related_name="referrals")
    referred_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="created_referrals")
    source_facility = models.ForeignKey(Facility, on_delete=models.PROTECT, related_name="outgoing_referrals")
    destination_facility = models.ForeignKey(Facility, on_delete=models.PROTECT, related_name="incoming_referrals")
    assigned_doctor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="assigned_referrals",
        null=True,
        blank=True,
        limit_choices_to={"role": User.Role.DOCTOR},
    )
    specialty = models.CharField(max_length=100, blank=True)
    reason = models.TextField()
    weight = models.CharField(max_length=40, blank=True)
    temperature = models.CharField(max_length=40, blank=True)
    blood_pressure = models.CharField(max_length=40, blank=True)
    oxygen_saturation = models.CharField(max_length=40, blank=True)
    height = models.CharField(max_length=40, blank=True)
    respiration_rate = models.CharField(max_length=40, blank=True)
    cardiac_rate = models.CharField(max_length=40, blank=True)
    ekonsult_encounter = models.CharField(max_length=10, default="No")
    visit_number = models.CharField(max_length=40, blank=True)
    profiled_at_bhs = models.CharField(max_length=10, default="No")
    other_diagnosis = models.TextField(blank=True)
    call_taken_by = models.CharField(max_length=120, blank=True)
    purok_fid = models.IntegerField(null=True, blank=True)
    purok_name = models.CharField(max_length=150, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Referral #{self.pk} for {self.patient}"


class Consultation(models.Model):
    referral = models.ForeignKey(Referral, on_delete=models.CASCADE, related_name="consultations")
    doctor = models.ForeignKey(User, on_delete=models.PROTECT, related_name="consultations")
    diagnosis = models.TextField()
    treatment_plan = models.TextField()
    consulted_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Consultation #{self.pk}"


class MedicineCatalogEntry(models.Model):
    name = models.CharField(max_length=150, unique=True)
    category = models.CharField(max_length=80)
    reference_presentations = models.JSONField(default=list)

    class Meta:
        ordering = ("id",)


class Medicine(models.Model):
    name = models.CharField(max_length=150)
    category = models.CharField(max_length=80, blank=True)
    medicine_type = models.CharField(max_length=50, blank=True)
    dosage = models.CharField(max_length=50, blank=True)
    issued_date = models.DateField(null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name


class MedicineInventory(models.Model):
    facility = models.ForeignKey(Facility, on_delete=models.CASCADE, related_name="medicine_inventory")
    medicine = models.ForeignKey(Medicine, on_delete=models.CASCADE, related_name="inventory_records")
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="created_medicine_inventory",
        null=True,
        blank=True,
    )
    quantity = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["facility", "medicine"], name="unique_facility_medicine")
        ]

    def __str__(self):
        return f"{self.medicine} at {self.facility}"


class MedicineRequest(models.Model):
    class Status(models.TextChoices):
        REQUESTED = "requested", "Requested"
        APPROVED = "approved", "Approved"
        DISPATCHED = "dispatched", "Dispatched"
        RELEASED = "released", "Released"
        DECLINED = "declined", "Declined"

    dispatched_at = models.DateTimeField(null=True, blank=True)
    received_at = models.DateTimeField(null=True, blank=True)
    dispatch_facility = models.ForeignKey(Facility, on_delete=models.PROTECT, null=True, blank=True, related_name="medicine_dispatches")
    dispatched_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="medicine_dispatches")
    received_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="medicine_receipts")

    requested_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="medicine_requests")
    patient = models.ForeignKey(
        PatientProfile,
        on_delete=models.CASCADE,
        related_name="medicine_requests",
        null=True,
        blank=True,
    )
    medicine = models.ForeignKey(Medicine, on_delete=models.PROTECT, related_name="requests")
    source_facility = models.ForeignKey(Facility, on_delete=models.PROTECT, related_name="medicine_requests")
    quantity = models.PositiveIntegerField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.REQUESTED)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        target = self.patient or self.source_facility
        return f"{self.quantity} {self.medicine} for {target}"


class PatientMedicineDistribution(models.Model):
    request = models.ForeignKey("PatientMedicineRequest", on_delete=models.SET_NULL, null=True, blank=True, related_name="distributions")
    patient = models.ForeignKey(PatientProfile, on_delete=models.CASCADE, related_name="medicine_distributions")
    medicine = models.ForeignKey(Medicine, on_delete=models.PROTECT, related_name="patient_distributions")
    facility = models.ForeignKey(Facility, on_delete=models.PROTECT, related_name="patient_medicine_distributions")
    distributed_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="patient_medicine_distributions")
    quantity = models.PositiveIntegerField()
    instructions = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    distributed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-distributed_at",)

    def __str__(self):
        return f"{self.quantity} {self.medicine} for {self.patient}"


class PatientMedicineRequest(models.Model):
    class Status(models.TextChoices):
        WALK_IN = "walk_in", "Walk In"
        REQUESTED = "requested", "Requested"
        SEEN = "seen", "Seen"
        AVAILABLE = "available", "Available"
        NOT_AVAILABLE = "not_available", "Not Available"
        READY_TO_GET = "ready_to_get", "Ready to Get"
        RECEIVED = "received", "Received"

    patient = models.ForeignKey(PatientProfile, on_delete=models.CASCADE, related_name="patient_medicine_requests")
    requested_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="patient_medicine_requests")
    bhc_facility = models.ForeignKey(Facility, on_delete=models.PROTECT, related_name="patient_medicine_requests")
    medicine_name = models.CharField(max_length=150, default="Prescription request", blank=True)
    quantity = models.PositiveIntegerField(default=1)
    prescription = models.FileField(upload_to="patient_prescriptions/", blank=True)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.REQUESTED)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.quantity} {self.medicine_name} requested by {self.patient}"


class BarangayBoundary(models.Model):
    fid = models.IntegerField(primary_key=True)
    barangay = models.CharField(max_length=150)
    barangay_id = models.IntegerField(null=True, blank=True)
    population = models.IntegerField(null=True, blank=True)
    geom = models.TextField()

    class Meta:
        managed = False
        db_table = "barangays"

    def __str__(self):
        return self.barangay


class PurokBoundary(models.Model):
    fid = models.IntegerField(primary_key=True)
    purok_id = models.IntegerField(null=True, blank=True)
    barangay = models.CharField(max_length=150)
    purok_name = models.CharField(max_length=150)
    geom = models.TextField()

    class Meta:
        managed = False
        db_table = "puroks"

    def __str__(self):
        return f"{self.barangay} - {self.purok_name}"


class Disease(models.Model):
    id = models.IntegerField(primary_key=True)
    disease_name = models.CharField(max_length=150)
    category = models.CharField(max_length=120, blank=True)

    class Meta:
        managed = False
        db_table = "diseases"
        ordering = ("disease_name",)

    def __str__(self):
        return self.disease_name


class DiseaseCase(models.Model):
    id = models.IntegerField(primary_key=True)
    disease = models.ForeignKey(Disease, on_delete=models.DO_NOTHING, db_column="disease_id")
    purok = models.ForeignKey(PurokBoundary, on_delete=models.DO_NOTHING, db_column="purok_fid")
    case_date = models.DateField()
    total_cases = models.IntegerField()

    class Meta:
        managed = False
        db_table = "disease_cases"


