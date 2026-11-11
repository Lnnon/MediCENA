from django.db import transaction
from rest_framework.decorators import action
from .models import StaffActivity


class ActivityMixin:
    @transaction.atomic
    def perform_create(self, serializer):
        instance = serializer.save()
        self.record_activity("created", instance)

    @transaction.atomic
    def perform_update(self, serializer):
        instance = serializer.save()
        self.record_activity("updated", instance)

    @transaction.atomic
    def perform_destroy(self, instance):
        self.record_activity("deleted", instance)
        instance.delete()

    def record_activity(self, action, instance):
        StaffActivity.objects.create(actor=self.request.user, action=action, resource=instance._meta.verbose_name, object_id=instance.pk)
