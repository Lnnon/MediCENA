from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0005_referral_clinical_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="medicine",
            name="category",
            field=models.CharField(blank=True, max_length=80),
        ),
        migrations.AddField(
            model_name="medicine",
            name="dosage",
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name="medicine",
            name="expiry_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="medicine",
            name="issued_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="medicine",
            name="medicine_type",
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AlterField(
            model_name="medicinerequest",
            name="patient",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="medicine_requests",
                to="core.patientprofile",
            ),
        ),
    ]
