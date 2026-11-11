import hashlib
from .models import Facility, MedicineRequest, PatientMedicineRequest, Referral, StaffProfile, SystemNotification, User
from .sms_service import enqueue_sms


def create_notification(recipient, *, actor=None, notification_type, title, message, target_page, object_type="", object_id=None):
    if not recipient or not recipient.is_active:
        return None

    event_key = hashlib.sha256(f"{recipient.pk}|{notification_type}|{object_type}|{object_id}|{title}|{message}".encode()).hexdigest()
    notification, created = SystemNotification.objects.get_or_create(event_key=event_key, defaults={
        "recipient": recipient, "actor": actor if actor and actor.is_authenticated else None,
        "notification_type": notification_type, "title": title, "message": message,
        "target_page": target_page, "object_type": object_type, "object_id": object_id,
    })
    if not created:
        return notification
    enqueue_sms(notification)
    return notification


def notify_users(users, **kwargs):
    sent_to = set()
    for user in users:
        if not user or user.id in sent_to:
            continue
        create_notification(user, **kwargs)
        sent_to.add(user.id)


def get_cho_users(department=User.Role.OPD):
    return User.objects.filter(role__in=[User.Role.CHO, department], is_active=True)


def get_referral_patient_name(referral):
    patient_user = referral.patient.user
    return patient_user.get_full_name() or patient_user.username


def get_facility_barangay(facility):
    name = facility.name or "Barangay Health Center"
    return name.replace(" Barangay Health Center", "").replace(" BHC", "").strip() or name


def get_patient_name(patient):
    return patient.user.get_full_name() or patient.user.username


def get_bhc_users_for_patient_medicine_request(patient_request):
    filters = []
    if patient_request.bhc_facility_id:
        filters.append({"staff_profile__facility": patient_request.bhc_facility})
    if patient_request.patient.barangay:
        filters.append({"staff_profile__barangay_designation": patient_request.patient.barangay})

    users = User.objects.none()
    for filter_kwargs in filters:
        users = users | User.objects.filter(role=User.Role.BHC, is_active=True, **filter_kwargs)

    return users.distinct()


def notify_referral_created(referral, actor=None):
    patient_name = get_referral_patient_name(referral)
    source_name = referral.source_facility.name if referral.source_facility_id else "BHC"
    notify_users(
        get_cho_users(),
        actor=actor,
        notification_type=SystemNotification.NotificationType.REFERRAL,
        title="New patient referral",
        message=f"{patient_name} was referred from {source_name} for {referral.specialty or referral.reason or 'assessment'}.",
        target_page="incoming",
        object_type="referral",
        object_id=referral.id,
    )

    if referral.assigned_doctor_id:
        create_notification(
            referral.assigned_doctor,
            actor=actor,
            notification_type=SystemNotification.NotificationType.REFERRAL,
            title="New assigned referral",
            message=f"{patient_name} is assigned to you for {referral.specialty or 'consultation'}.",
            target_page="referrals",
            object_type="referral",
            object_id=referral.id,
        )

    create_notification(
        referral.patient.user,
        actor=actor,
        notification_type=SystemNotification.NotificationType.REFERRAL,
        title="New referral created",
        message=f"You were referred to {referral.destination_facility.name if referral.destination_facility_id else 'CHO'} for {referral.specialty or referral.reason or 'assessment'}.",
        target_page="currentReferral",
        object_type="referral",
        object_id=referral.id,
    )


def notify_referral_updated(referral, *, actor=None, previous_status=None, previous_doctor_id=None):
    patient_name = get_referral_patient_name(referral)

    if previous_doctor_id != referral.assigned_doctor_id and referral.assigned_doctor_id:
        create_notification(
            referral.assigned_doctor,
            actor=actor,
            notification_type=SystemNotification.NotificationType.REFERRAL,
            title="Referral assigned to you",
            message=f"{patient_name} is ready for your review.",
            target_page="referrals",
            object_type="referral",
            object_id=referral.id,
        )
        for recipient, target in [(referral.patient.user, "currentReferral"), (referral.referred_by, "trackPatients")]:
            create_notification(recipient, actor=actor,
                notification_type=SystemNotification.NotificationType.REFERRAL, title="Doctor assigned to referral",
                message="A doctor has been assigned to this referral. View the referral for details.",
                target_page=target, object_type="referral", object_id=referral.id)

    if previous_status and previous_status != referral.status:
        notify_users(get_cho_users(), actor=actor, notification_type=SystemNotification.NotificationType.REFERRAL,
            title="Referral process updated", message=f"Referral #{referral.pk} is now {referral.get_status_display()}.",
            target_page="incoming", object_type="referral", object_id=referral.id)
        create_notification(
            referral.referred_by,
            actor=actor,
            notification_type=SystemNotification.NotificationType.REFERRAL,
            title="Referral status updated",
            message=f"{patient_name}'s referral is now {referral.get_status_display()}.",
            target_page="trackPatients",
            object_type="referral",
            object_id=referral.id,
        )

        create_notification(
            referral.patient.user,
            actor=actor,
            notification_type=SystemNotification.NotificationType.REFERRAL,
            title="Referral status updated",
            message=f"Your referral is now {referral.get_status_display()}.",
            target_page="pastReferral" if referral.status in {Referral.Status.COMPLETED, Referral.Status.CANCELLED, Referral.Status.REJECTED} else "currentReferral",
            object_type="referral",
            object_id=referral.id,
        )

        if actor and actor.role == User.Role.BHC:
            notify_users(
                get_cho_users(),
                actor=actor,
                notification_type=SystemNotification.NotificationType.REFERRAL,
                title="Referral updated by BHC",
                message=f"{patient_name}'s referral was updated by {actor.get_full_name() or actor.username}.",
                target_page="incoming" if referral.status == Referral.Status.PENDING else "referred",
                object_type="referral",
                object_id=referral.id,
            )


def notify_medicine_request_created(medicine_request, actor=None):
    barangay = get_facility_barangay(medicine_request.source_facility)
    notify_users(
        get_cho_users(User.Role.PHARMACIST),
        actor=actor,
        notification_type=SystemNotification.NotificationType.MEDICINE,
        title="New medicine request",
        message=f"{barangay} requested {medicine_request.quantity} unit/s of {medicine_request.medicine.name}.",
        target_page="medicineRequests",
        object_type="medicine_request",
        object_id=medicine_request.id,
    )


def notify_medicine_request_updated(medicine_request, *, actor=None, previous_status=None):
    if previous_status == medicine_request.status:
        return

    status_label = medicine_request.get_status_display()
    notify_users(get_cho_users(User.Role.PHARMACIST), actor=actor, notification_type=SystemNotification.NotificationType.MEDICINE,
        title="Supply process updated", message=f"Supply request #{medicine_request.pk} is now {status_label}.",
        target_page="medicineRequests", object_type="medicine_request", object_id=medicine_request.id)
    if actor and actor.role == User.Role.BHC:
        notify_users(
            get_cho_users(User.Role.PHARMACIST),
            actor=actor,
            notification_type=SystemNotification.NotificationType.MEDICINE,
            title="Medicine request updated",
            message=f"{medicine_request.source_facility.name} marked {medicine_request.medicine.name} as {status_label}.",
            target_page="medicineRequests",
            object_type="medicine_request",
            object_id=medicine_request.id,
        )
        return

    create_notification(
        medicine_request.requested_by,
        actor=actor,
        notification_type=SystemNotification.NotificationType.MEDICINE,
        title="Medicine request status updated",
        message=f"Your {medicine_request.medicine.name} request is now {status_label}.",
        target_page="medicineRequests",
        object_type="medicine_request",
        object_id=medicine_request.id,
    )


def notify_patient_medicine_request_created(patient_request, actor=None):
    patient_name = get_patient_name(patient_request.patient)

    if actor and actor.role == User.Role.BHC:
        create_notification(
            patient_request.patient.user,
            actor=actor,
            notification_type=SystemNotification.NotificationType.MEDICINE,
            title="Walk-in medicine request recorded",
            message="Your BHC recorded a walk-in medicine request for you.",
            target_page="medicineRequest",
            object_type="patient_medicine_request",
            object_id=patient_request.id,
        )
        return

    notify_users(
        get_bhc_users_for_patient_medicine_request(patient_request),
        actor=actor,
        notification_type=SystemNotification.NotificationType.MEDICINE,
        title="New patient medicine request",
        message=f"{patient_name} uploaded a prescription for BHC review.",
        target_page="medicineDistribution",
        object_type="patient_medicine_request",
        object_id=patient_request.id,
    )


def notify_patient_medicine_request_updated(patient_request, *, actor=None, previous_status=None):
    if previous_status == patient_request.status:
        return

    patient_name = get_patient_name(patient_request.patient)
    status_label = patient_request.get_status_display()

    if actor and actor.role == User.Role.PATIENT:
        notify_users(
            get_bhc_users_for_patient_medicine_request(patient_request),
            actor=actor,
            notification_type=SystemNotification.NotificationType.MEDICINE,
            title="Patient medicine request updated",
            message=f"{patient_name}'s request is now {status_label}.",
            target_page="medicineDistribution",
            object_type="patient_medicine_request",
            object_id=patient_request.id,
        )
        return

    create_notification(
        patient_request.patient.user,
        actor=actor,
        notification_type=SystemNotification.NotificationType.MEDICINE,
        title="Medicine request status updated",
        message=f"Your medicine request is now {status_label}.",
        target_page="medicineRequest",
        object_type="patient_medicine_request",
        object_id=patient_request.id,
    )


def notify_patient_medicine_distributed(distribution, actor=None):
    medicine_name = distribution.medicine.name if distribution.medicine_id else "medicine"
    create_notification(
        distribution.patient.user,
        actor=actor,
        notification_type=SystemNotification.NotificationType.MEDICINE,
        title="Medicine distributed",
        message=f"{distribution.quantity} {medicine_name} was released to your patient record.",
        target_page="medicineRequest",
        object_type="patient_medicine_distribution",
        object_id=distribution.id,
    )


def notify_patient_saved(patient, *, actor=None, created=False):
    if not actor or not actor.is_authenticated:
        return

    patient_name = patient.user.get_full_name() or patient.user.username
    create_notification(
        actor,
        actor=actor,
        notification_type=SystemNotification.NotificationType.PATIENT,
        title="Patient added" if created else "Patient updated",
        message=f"{patient_name}'s patient record was {'created' if created else 'updated'}.",
        target_page="patients",
        object_type="patient",
        object_id=patient.id,
    )
