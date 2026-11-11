"""Recorded-data forecasts; no clinical conversion factors, fabricated observations, or random numbers."""
import calendar
import math
from collections import defaultdict
from datetime import date

from django.db import connections
from django.db.models import Q
from django.db.utils import ConnectionDoesNotExist, DatabaseError
from django.utils import timezone
from rest_framework import serializers

from .models import DiseaseCase, MedicineInventory, MedicineRequest, PatientMedicineDistribution, StaffProfile, User

WINDOW = 3
MIN_MONTHS = 6


def month_start(value):
    return value.replace(day=1)


def shift_month(value, step):
    index = value.year * 12 + value.month - 1 + step
    return date(index // 12, index % 12 + 1, 1)


def monthly_forecast(observations, start, end, horizon=3):
    """Three-month mean, recursive horizon, rolling-origin evaluation. Gaps are unknown, not zero."""
    start = month_start(start) if start.day == 1 else shift_month(month_start(start), 1)
    end_month = month_start(end)
    if end.day != calendar.monthrange(end.year, end.month)[1]:
        end_month = shift_month(end_month, -1)
    cleaned = {month_start(day): float(value) for day, value in observations.items() if day >= start and month_start(day) <= end_month and isinstance(value, (int, float)) and math.isfinite(value) and value >= 0}
    history = []
    cursor = start
    while cursor <= end_month:
        history.append({"month": cursor.isoformat(), "actual": cleaned.get(cursor)})
        cursor = shift_month(cursor, 1)
    # Do not pad pre-registration periods. Keep leading unknown months visible for coverage.
    known_indices = [i for i, row in enumerate(history) if row["actual"] is not None]
    series = history[known_indices[0]:known_indices[-1] + 1] if known_indices else []
    status = "ready"
    reason = "Three-month moving average using consecutive recorded calendar months."
    if len(known_indices) < MIN_MONTHS:
        status, reason = "insufficient_data", "At least six recorded complete months are required."
    elif any(row["actual"] is None for row in series):
        status, reason = "missing_periods", "Historical gaps require verified observations, including explicit zero reports."
    elif series[-1]["month"] != end_month.isoformat():
        status, reason = "stale_data", "No recorded observation for the latest complete month; current forecasts are withheld."
    evaluation = []
    for index in range(WINDOW, len(series)):
        past = [row["actual"] for row in series[index - WINDOW:index]]
        actual = series[index]["actual"]
        if actual is not None and all(value is not None for value in past):
            predicted = sum(past) / WINDOW
            evaluation.append({"month": series[index]["month"], "actual": actual, "predicted": round(predicted, 4), "absolute_error": abs(actual - predicted), "squared_error": (actual - predicted) ** 2})
    evaluation = evaluation[-3:]
    predictions = []
    if status == "ready":
        values = [row["actual"] for row in series]
        for step in range(1, horizon + 1):
            predicted = sum(values[-WINDOW:]) / WINDOW
            predictions.append({"month": shift_month(end_month, step).isoformat(), "predicted": round(predicted, 4)})
            values.append(predicted)
    latest = series[-1]["actual"] if series else None
    trend = None
    if predictions:
        trend = "increasing" if predictions[0]["predicted"] > latest else "decreasing" if predictions[0]["predicted"] < latest else "stable"
    return {"status": status, "reason": reason, "history": history, "forecasts": predictions, "trend": trend,
        "method": "3-month moving average", "window_months": WINDOW, "minimum_months": MIN_MONTHS,
        "observed_months": len(known_indices), "last_observed_month": series[-1]["month"] if series else None,
        "forecast_origin": end_month.isoformat(), "horizon_months": horizon,
        "evaluation": {"method": "Rolling-origin one-month-ahead backtest; up to the last three eligible months", "test_months": len(evaluation),
            "mae": round(sum(row["absolute_error"] for row in evaluation) / len(evaluation), 4) if evaluation else None,
            "rmse": round(math.sqrt(sum(row["squared_error"] for row in evaluation) / len(evaluation)), 4) if evaluation else None,
            "observations": [{key: value for key, value in row.items() if key not in {"absolute_error", "squared_error"}} for row in evaluation]}}


def forecast_filters(params, user):
    today = timezone.localdate()
    end = today
    try:
        if params.get("end_date"):
            end = date.fromisoformat(params["end_date"])
        start = date.fromisoformat(params["start_date"]) if params.get("start_date") else shift_month(month_start(end), -23)
        horizon = int(params.get("horizon", 3))
        disease_id = int(params["disease_id"]) if params.get("disease_id") else None
    except (ValueError, TypeError) as exc:
        raise serializers.ValidationError("Use ISO dates, a numeric disease ID, and an integer forecast horizon.") from exc
    if end > today or start > end or (end - start).days > 1096 or not 1 <= horizon <= 6:
        raise serializers.ValidationError("Choose a past/current date range of at most 36 months and a horizon of 1–6 months.")
    barangay = params.get("barangay", "").strip()
    if user.role == User.Role.BHC:
        try:
            profile = user.staff_profile
            barangay = profile.barangay_designation or profile.facility.name.replace(" Barangay Health Center", "").replace(" BHC", "").strip()
        except StaffProfile.DoesNotExist as exc:
            raise serializers.ValidationError("Your BHC account needs an assigned facility and barangay.") from exc
        if not barangay:
            raise serializers.ValidationError("Your BHC account needs an assigned facility and barangay.")
    return {"start": start, "end": end, "horizon": horizon, "barangay": barangay, "disease_id": disease_id, "category": params.get("medicine_category", "").strip()}


def build_forecast_analysis(params, user):
    filters = forecast_filters(params, user)
    start, end, horizon = filters["start"], filters["end"], filters["horizon"]
    diseases = []
    invalid = 0
    source_status = "available"
    try:
        records = DiseaseCase.objects.using("gis").filter(case_date__gte=start, case_date__lte=end)
        if filters["barangay"]:
            records = records.filter(purok__barangay=filters["barangay"])
        if filters["disease_id"]:
            records = records.filter(disease_id=filters["disease_id"])
        grouped = {}
        for row in records.values("case_date", "total_cases", "disease_id", "disease__disease_name", "purok__barangay").iterator():
            if row["total_cases"] < 0:
                invalid += 1
                continue
            key = (row["disease_id"], row["disease__disease_name"], row["purok__barangay"])
            grouped.setdefault(key, defaultdict(float))[month_start(row["case_date"])] += row["total_cases"]
        for (disease_id, name, barangay), observations in sorted(grouped.items()):
            diseases.append({"disease_id": disease_id, "disease": name, "barangay": barangay, **monthly_forecast(observations, start, end, horizon)})
    except (ConnectionDoesNotExist, DatabaseError):
        source_status = "unavailable"
    consumption = PatientMedicineDistribution.objects.filter(distributed_at__date__gte=start, distributed_at__date__lte=end).select_related("medicine", "facility")
    supplies = MedicineRequest.objects.filter(Q(created_at__date__gte=start, created_at__date__lte=end) | Q(received_at__date__gte=start, received_at__date__lte=end)).exclude(status=MedicineRequest.Status.DECLINED).select_related("medicine", "source_facility")
    stock = MedicineInventory.objects.select_related("medicine", "facility")
    if user.role == User.Role.BHC:
        facility = user.staff_profile.facility
        consumption, supplies, stock = consumption.filter(facility=facility), supplies.filter(source_facility=facility), stock.filter(facility=facility)
    elif filters["barangay"]:
        consumption = consumption.filter(facility__staff__barangay_designation=filters["barangay"]).distinct()
        supplies = supplies.filter(source_facility__staff__barangay_designation=filters["barangay"]).distinct()
        stock = stock.filter(facility__staff__barangay_designation=filters["barangay"]).distinct()
    if filters["category"]:
        consumption, supplies, stock = [query.filter(medicine__category=filters["category"]) for query in (consumption, supplies, stock)]
    groups = {}
    def bucket(facility, medicine):
        return groups.setdefault((facility.pk, medicine.pk), {"facility_id": facility.pk, "facility": facility.name, "medicine_id": medicine.pk,
            "medicine": medicine.name, "medicine_type": medicine.medicine_type, "dosage": medicine.dosage, "category": medicine.category, "unit": "inventory units", "consumption": defaultdict(float), "requests": defaultdict(float), "receipts": defaultdict(float), "usable_stock": 0, "expired_stock": 0})
    for row in consumption:
        bucket(row.facility, row.medicine)["consumption"][month_start(timezone.localdate(row.distributed_at))] += row.quantity
    for row in supplies:
        item = bucket(row.source_facility, row.medicine)
        item["requests"][month_start(timezone.localdate(row.created_at))] += row.quantity
        if row.received_at and start <= timezone.localdate(row.received_at) <= end:
            item["receipts"][month_start(timezone.localdate(row.received_at))] += row.quantity
    for row in stock:
        item = bucket(row.facility, row.medicine)
        item["expired_stock" if row.medicine.expiry_date and row.medicine.expiry_date < timezone.localdate() else "usable_stock"] += row.quantity
    medicines = []
    for item in groups.values():
        observation = item.pop("consumption")
        request_history, receipt_history = item.pop("requests"), item.pop("receipts")
        forecast = monthly_forecast(observation, start, end, horizon)
        expected = sum(point["predicted"] for point in forecast["forecasts"]) if forecast["status"] == "ready" else None
        # Today's stock is not a historical stock snapshot: no retrospective allocation recommendation.
        gap = max(0, math.ceil(expected - item["usable_stock"])) if expected is not None and end == timezone.localdate() else None
        medicines.append({**item, "consumption_forecast": forecast, "request_forecast": monthly_forecast(request_history, start, end, horizon),
            "receipt_history": [{"month": key.isoformat(), "quantity": value} for key, value in sorted(receipt_history.items())],
            "forecast_total_units": round(expected, 4) if expected is not None else None, "stock_gap_units": gap,
            "allocation_note": "Current usable stock compared with forecast consumption; verify supply lead times and units." if gap is not None else "No allocation quantity: insufficient/current data or historical cutoff."})
    return {"generated_at": timezone.now(), "filters": {**{key: str(value) if isinstance(value, date) else value for key, value in filters.items()}},
        "disease_source": "GIS disease_cases.total_cases grouped by case_date, disease_id and purok barangay", "gis_status": source_status,
        "medicine_source": "Patient medicine distribution quantity (consumption); non-declined supply request quantity shown separately; current inventory quantity",
        "provenance": "Stored records; legacy dataset provenance is not verified. A mock-data seed command exists in this repository. Validate imported data with CHO before public-health use.",
        "limitations": ["Decision support only, not guaranteed outcomes or clinical advice.", "No seasonality, population adjustment, lead-time model, or medicine-per-case conversion is assumed.", "Missing months are unknown; current partial months are excluded. At least six consecutive complete months are required.", "Stale records suppress forecasts. Existing inventory lacks lot-level expiry and historical stock snapshots.", "A zero transaction month is not assumed to be a verified zero demand month."],
        "invalid_disease_records_excluded": invalid, "diseases": diseases, "medicines": medicines,
        "summary": {"disease_series": len(diseases), "disease_forecasts_ready": sum(item["status"] == "ready" for item in diseases),
            "medicine_series": len(medicines), "medicine_forecasts_ready": sum(item["consumption_forecast"]["status"] == "ready" for item in medicines),
            "medicine_stock_gap_items": sum((item["stock_gap_units"] or 0) > 0 for item in medicines),
            "facilities_requiring_stock_review": sorted({item["facility"] for item in medicines if (item["stock_gap_units"] or 0) > 0})}}
