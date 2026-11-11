from django.db.models import F

from .models import MedicineInventory


def decrement_stock(inventory_id, quantity):
    """Apply a stock reduction only if the row still has enough units."""
    return MedicineInventory.objects.filter(pk=inventory_id, quantity__gte=quantity).update(
        quantity=F("quantity") - quantity,
    )
