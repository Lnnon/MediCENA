from django.db.models import Prefetch

from .models import PatientMedicineDistribution


RECENT_DISTRIBUTIONS_ATTR = "recent_medicine_distributions"


def ordered_distributions(queryset):
    return queryset.select_related("medicine", "facility", "distributed_by").order_by("-distributed_at")


def prefetch_recent_distributions(relation="medicine_distributions"):
    # Django applies the slice per patient, keeping the existing ten-row response limit.
    return Prefetch(
        relation,
        queryset=ordered_distributions(PatientMedicineDistribution.objects.select_related("patient__user"))[:10],
        to_attr=RECENT_DISTRIBUTIONS_ATTR,
    )
