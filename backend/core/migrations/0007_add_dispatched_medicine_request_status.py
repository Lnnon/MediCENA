from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0006_medicine_metadata_and_optional_request_patient"),
    ]

    operations = [
        migrations.AlterField(
            model_name="medicinerequest",
            name="status",
            field=models.CharField(
                choices=[
                    ("requested", "Requested"),
                    ("approved", "Approved"),
                    ("dispatched", "Dispatched"),
                    ("released", "Released"),
                    ("declined", "Declined"),
                ],
                default="requested",
                max_length=20,
            ),
        ),
    ]
