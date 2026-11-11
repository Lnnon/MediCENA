from django.db import connections
from django.db.utils import ConnectionDoesNotExist, DatabaseError
from django.utils import timezone


def normalize_disease_text(value):
    return (value or "").strip().lower()


def get_referral_disease_text(referral):
    return " ".join(
        value
        for value in [
            referral.other_diagnosis,
            referral.reason,
            referral.specialty,
        ]
        if value
    )


def sync_referral_to_gis_disease_case(referral):
    patient = referral.patient
    barangay = (patient.barangay or "").strip()
    purok_fid = referral.purok_fid
    disease_text = normalize_disease_text(get_referral_disease_text(referral))

    if not barangay or not purok_fid or not disease_text:
        return

    try:
        with connections["gis"].cursor() as cursor:
            cursor.execute(
                """
                SELECT id, disease_name
                FROM diseases
                WHERE LOWER(disease_name) = %s
                   OR %s LIKE CONCAT('%%', LOWER(disease_name), '%%')
                   OR LOWER(disease_name) LIKE CONCAT('%%', %s, '%%')
                ORDER BY
                    CASE WHEN LOWER(disease_name) = %s THEN 0 ELSE 1 END,
                    LENGTH(disease_name)
                LIMIT 1
                """,
                [disease_text, disease_text, disease_text, disease_text],
            )
            disease_row = cursor.fetchone()

            if not disease_row:
                return

            cursor.execute(
                """
                SELECT fid, purok_name
                FROM puroks
                WHERE fid = %s
                  AND LOWER(barangay) = LOWER(%s)
                LIMIT 1
                """,
                [purok_fid, barangay],
            )
            purok_row = cursor.fetchone()

            if not purok_row:
                return

            disease_id = disease_row[0]
            purok_fid = purok_row[0]
            case_date = timezone.localdate(referral.created_at)

            cursor.execute(
                """
                SELECT id
                FROM disease_cases
                WHERE disease_id = %s
                  AND purok_fid = %s
                  AND case_date = %s
                LIMIT 1
                """,
                [disease_id, purok_fid, case_date],
            )
            existing_case = cursor.fetchone()

            if existing_case:
                cursor.execute(
                    """
                    UPDATE disease_cases
                    SET total_cases = total_cases + 1
                    WHERE id = %s
                    """,
                    [existing_case[0]],
                )
                return

            cursor.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM disease_cases")
            next_id = cursor.fetchone()[0]
            cursor.execute(
                """
                INSERT INTO disease_cases (id, disease_id, purok_fid, case_date, total_cases)
                VALUES (%s, %s, %s, %s, 1)
                """,
                [next_id, disease_id, purok_fid, case_date],
            )
    except (ConnectionDoesNotExist, DatabaseError):
        return
