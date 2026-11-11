from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0010_referral_purok_fid_referral_purok_name"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="PatientMedicineDistribution",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("quantity", models.PositiveIntegerField()),
                ("instructions", models.TextField(blank=True)),
                ("notes", models.TextField(blank=True)),
                ("distributed_at", models.DateTimeField(auto_now_add=True)),
                (
                    "distributed_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="patient_medicine_distributions",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "facility",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="patient_medicine_distributions",
                        to="core.facility",
                    ),
                ),
                (
                    "medicine",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="patient_distributions",
                        to="core.medicine",
                    ),
                ),
                (
                    "patient",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="medicine_distributions",
                        to="core.patientprofile",
                    ),
                ),
            ],
            options={
                "ordering": ("-distributed_at",),
            },
        ),
    ]
