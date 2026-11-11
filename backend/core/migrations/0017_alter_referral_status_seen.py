from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0016_patient_and_inventory_created_by"),
    ]

    operations = [
        migrations.AlterField(
            model_name="referral",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending", "Pending"),
                    ("seen", "Seen"),
                    ("accepted", "Accepted"),
                    ("completed", "Completed"),
                    ("cancelled", "Cancelled"),
                ],
                default="pending",
                max_length=20,
            ),
        ),
    ]
