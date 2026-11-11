from datetime import timedelta
from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone
from core.models import SMSDelivery
from core.sms_service import configured, process_delivery, refresh_delivery, save_outcome


class Command(BaseCommand):
    help = "Process the consent-aware SMS outbox and poll Twilio delivery receipts. Schedule this command every minute."

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=100)
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        limit = max(1, min(options["limit"], 1000))
        due = SMSDelivery.objects.filter(status__in=["pending", "retry", "not_configured"]).filter(Q(next_attempt_at__isnull=True) | Q(next_attempt_at__lte=timezone.now()))
        if options["dry_run"]:
            self.stdout.write(f"Provider configured: {configured()}; due outbox records: {due.count()}. No messages sent.")
            return
        for delivery in SMSDelivery.objects.filter(status="sending", updated_at__lt=timezone.now() - timedelta(minutes=5)):
            save_outcome(delivery, "unknown", "worker_interrupted")
        for pk in list(due.order_by("created_at").values_list("pk", flat=True)[:limit]):
            process_delivery(pk)
        for pk in SMSDelivery.objects.filter(provider_id__isnull=False, status__in=["accepted", "queued", "sending", "sent", "unknown"]).values_list("pk", flat=True)[:limit]:
            refresh_delivery(pk)
        self.stdout.write("Outbox processing complete. Only provider-confirmed statuses are recorded as delivered.")
