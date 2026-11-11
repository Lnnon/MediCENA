from collections import defaultdict
from datetime import timedelta
import json
from django.db import connections
from django.db.utils import ConnectionDoesNotExist, DatabaseError
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .forecast_service import build_forecast_analysis
from .gis_queries import fetch_purok_map_rows
from .permissions import HealthMonitoringAccess
from .models import Disease, Referral, StaffProfile, User
from .serializers import DiseaseSerializer
from .outbreak_metrics import (
    OUTBREAK_DISEASES,
    get_outbreak_definition,
    get_outbreak_name_for_disease,
    get_outbreak_level,
    build_case_clusters,
    build_outbreak_bucket,
    get_trend_direction,
    get_prediction_level,
    build_resource_recommendations,
    build_critical_alert,
)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def disease_list_view(request):
    diseases = Disease.objects.using("gis").order_by("disease_name")
    return Response(DiseaseSerializer(diseases, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def purok_list_view(request):
    barangay = request.query_params.get("barangay", "").strip()
    assigned_barangay = get_user_barangay_designation(request.user)

    if assigned_barangay:
        barangay = assigned_barangay

    if not barangay:
        return Response({"detail": "barangay query parameter is required."}, status=400)

    with connections["gis"].cursor() as cursor:
        cursor.execute(
            """
            SELECT fid, barangay, purok_name
            FROM puroks
            WHERE LOWER(barangay) = LOWER(%s)
            ORDER BY purok_name
            """,
            [barangay],
        )
        rows = cursor.fetchall()

    return Response(
        [
            {
                "fid": fid,
                "barangay": row_barangay,
                "purok_name": purok_name,
            }
            for fid, row_barangay, purok_name in rows
        ]
    )


def get_user_barangay_designation(user):
    if not user.is_authenticated or user.role != User.Role.BHC:
        return ""

    try:
        staff_profile = user.staff_profile
    except StaffProfile.DoesNotExist as exc:
        raise PermissionDenied("Your BHC account needs an assigned facility and barangay.") from exc

    designation = staff_profile.barangay_designation or staff_profile.facility.name.replace(" Barangay Health Center", "").replace(" BHC", "").strip()
    if not designation:
        raise PermissionDenied("Your BHC account needs an assigned facility and barangay.")
    return designation


def get_scoped_referrals(user):
    queryset = Referral.objects.select_related("patient").only(
        "patient__barangay", "specialty", "reason", "other_diagnosis", "created_at", "status",
    ).order_by("-created_at")

    if not user.is_authenticated or user.role != User.Role.BHC:
        return queryset

    try:
        staff_profile = user.staff_profile
    except StaffProfile.DoesNotExist:
        return queryset.filter(referred_by=user)

    if staff_profile.barangay_designation:
        return queryset.filter(patient__barangay=staff_profile.barangay_designation)

    return queryset.filter(source_facility=staff_profile.facility)


@api_view(["GET"])
@permission_classes([HealthMonitoringAccess])
def purok_disease_map_view(request):
    disease_id = request.query_params.get("disease_id")
    barangay = request.query_params.get("barangay", "").strip()
    purok_fid = request.query_params.get("purok_fid")

    if disease_id in ("", None):
        disease_id = None
    else:
        try:
            disease_id = int(disease_id)
        except ValueError:
            return Response({"detail": "disease_id must be a valid integer."}, status=400)

    if purok_fid in ("", None):
        purok_fid = None
    else:
        try:
            purok_fid = int(purok_fid)
        except ValueError:
            return Response({"detail": "purok_fid must be a valid integer."}, status=400)

    assigned_barangay = get_user_barangay_designation(request.user)
    rows = fetch_purok_map_rows(disease_id, assigned_barangay or barangay, purok_fid)

    features = []
    cluster_points = []
    for fid, barangay, purok_name, cases, center_lat, center_lng, geometry in rows:
        center = {
            "lat": float(center_lat) if center_lat is not None else None,
            "lng": float(center_lng) if center_lng is not None else None,
        }
        features.append(
            {
                "type": "Feature",
                "geometry": json.loads(geometry) if geometry else None,
                "properties": {
                    "fid": fid,
                    "barangay": barangay,
                    "purok_name": purok_name,
                    "cases": cases,
                    "center": center,
                },
            }
        )
        cluster_points.append(
            {
                "fid": fid,
                "barangay": barangay,
                "purok_name": purok_name,
                "cases": cases,
                **center,
            }
        )

    return Response(
        {
            "type": "FeatureCollection",
            "scope": {
                "barangay": assigned_barangay,
                "is_barangay_scoped": bool(assigned_barangay),
            },
            "clusters": build_case_clusters(cluster_points),
            "features": features,
        }
    )


@api_view(["GET"])
@permission_classes([HealthMonitoringAccess])
def outbreak_analytics_view(request):
    forecast_analysis = build_forecast_analysis(request.query_params, request.user)
    if request.query_params.get("mode") == "forecast":
        return Response(forecast_analysis)
    assigned_barangay = get_user_barangay_designation(request.user)
    recent_since = timezone.now() - timedelta(days=30)
    previous_since = timezone.now() - timedelta(days=60)
    buckets = {disease["name"]: build_outbreak_bucket(disease) for disease in OUTBREAK_DISEASES}

    referrals = get_scoped_referrals(request.user)
    for referral in referrals.iterator():
        disease = get_outbreak_definition(
            " ".join(
                [
                    referral.specialty,
                    referral.reason,
                    referral.other_diagnosis,
                ]
            )
        )
        if not disease:
            continue

        bucket = buckets[disease["name"]]
        bucket["referrals"] += 1
        if referral.created_at >= recent_since:
            bucket["recent_referrals"] += 1
        elif referral.created_at >= previous_since:
            bucket["previous_referrals"] += 1
        if referral.status == Referral.Status.PENDING:
            bucket["pending_referrals"] += 1
        elif referral.status == Referral.Status.ACCEPTED:
            bucket["accepted_referrals"] += 1
        elif referral.status == Referral.Status.COMPLETED:
            bucket["completed_referrals"] += 1

        barangay = referral.patient.barangay or "Barangay not set"
        bucket["top_barangays"][barangay] = bucket["top_barangays"].get(barangay, 0) + 1

    case_params = []
    where_sql = ""
    if assigned_barangay:
        where_sql = "WHERE p.barangay = %s"
        case_params.append(assigned_barangay)

    gis_status = "connected"
    try:
        with connections["gis"].cursor() as cursor:
            cursor.execute(
                f"""
                SELECT
                    d.disease_name,
                    COALESCE(NULLIF(d.category, ''), 'Communicable disease') AS category,
                    COALESCE(SUM(dc.total_cases), 0)::integer AS cases,
                    COALESCE(SUM(CASE WHEN dc.case_date >= %s THEN dc.total_cases ELSE 0 END), 0)::integer AS recent_cases,
                    COALESCE(SUM(CASE WHEN dc.case_date >= %s AND dc.case_date < %s THEN dc.total_cases ELSE 0 END), 0)::integer AS previous_cases,
                    COUNT(DISTINCT dc.purok_fid)::integer AS affected_puroks
                FROM diseases d
                LEFT JOIN disease_cases dc
                    ON dc.disease_id = d.id
                LEFT JOIN puroks p
                    ON p.fid = dc.purok_fid
                {where_sql}
                GROUP BY d.id, d.disease_name, d.category
                ORDER BY cases DESC, d.disease_name
                """,
                [recent_since.date(), previous_since.date(), recent_since.date(), *case_params],
            )
            disease_rows = cursor.fetchall()

            cursor.execute(
                f"""
                SELECT
                    d.disease_name,
                    p.fid,
                    p.barangay,
                    p.purok_name,
                    COALESCE(SUM(dc.total_cases), 0)::integer AS cases,
                    ST_Y(ST_Centroid(p.geom)) AS center_lat,
                    ST_X(ST_Centroid(p.geom)) AS center_lng
                FROM diseases d
                INNER JOIN disease_cases dc
                    ON dc.disease_id = d.id
                INNER JOIN puroks p
                    ON p.fid = dc.purok_fid
                {where_sql}
                GROUP BY d.id, d.disease_name, p.fid, p.barangay, p.purok_name, p.geom
                HAVING COALESCE(SUM(dc.total_cases), 0) > 0
                ORDER BY cases DESC, d.disease_name
                """,
                case_params,
            )
            cluster_rows = cursor.fetchall()

            monthly_filters = ["dc.case_date >= %s"]
            monthly_params = [(timezone.now() - timedelta(days=365)).date()]
            if assigned_barangay:
                monthly_filters.append("p.barangay = %s")
                monthly_params.append(assigned_barangay)
            monthly_where_sql = f"WHERE {' AND '.join(monthly_filters)}"

            cursor.execute(
                f"""
                SELECT
                    DATE_TRUNC('month', dc.case_date)::date AS month,
                    COALESCE(SUM(dc.total_cases), 0)::integer AS cases
                FROM disease_cases dc
                INNER JOIN puroks p
                    ON p.fid = dc.purok_fid
                {monthly_where_sql}
                GROUP BY month
                ORDER BY month
                """,
                monthly_params,
            )
            monthly_rows = cursor.fetchall()
    except (ConnectionDoesNotExist, DatabaseError):
        gis_status = "unavailable"
        disease_rows = []
        cluster_rows = []
        monthly_rows = []

    for disease_name, category, cases, recent_cases, previous_cases, affected_puroks in disease_rows:
        matching_name = get_outbreak_name_for_disease(disease_name)

        if matching_name:
            bucket = buckets[matching_name]
        else:
            bucket = buckets.setdefault(
                disease_name,
                {
                    "disease": disease_name,
                    "category": category,
                    "risk_threshold": 10,
                    "gis_cases": 0,
                    "recent_gis_cases": 0,
                    "previous_gis_cases": 0,
                    "referrals": 0,
                    "recent_referrals": 0,
                    "previous_referrals": 0,
                    "pending_referrals": 0,
                    "accepted_referrals": 0,
                    "completed_referrals": 0,
                    "top_barangays": {},
                    "cluster_points": [],
                    "source": "gis",
                },
            )

        bucket["gis_cases"] += cases
        bucket["recent_gis_cases"] += recent_cases
        bucket["previous_gis_cases"] += previous_cases
        bucket["affected_puroks"] = bucket.get("affected_puroks", 0) + affected_puroks

    for disease_name, fid, barangay, purok_name, cases, center_lat, center_lng in cluster_rows:
        matching_name = get_outbreak_name_for_disease(disease_name)
        bucket = buckets.get(matching_name or disease_name)
        if not bucket:
            continue

        bucket["cluster_points"].append(
            {
                "fid": fid,
                "barangay": barangay,
                "purok_name": purok_name,
                "cases": cases,
                "lat": float(center_lat) if center_lat is not None else None,
                "lng": float(center_lng) if center_lng is not None else None,
            }
        )

    forecasts_by_disease = defaultdict(list)
    for item in forecast_analysis["diseases"]:
        name = get_outbreak_name_for_disease(item["disease"]) or item["disease"]
        forecasts_by_disease[name].append(item)

    diseases = []
    for bucket in buckets.values():
        barangay_cases = {}
        for point in bucket.get("cluster_points", []):
            barangay = point.get("barangay") or "Barangay not set"
            barangay_cases[barangay] = barangay_cases.get(barangay, 0) + point.get("cases", 0)

        barangay_breakdown = [
            {"barangay": barangay, "cases": cases}
            for barangay, cases in sorted(barangay_cases.items(), key=lambda item: item[1], reverse=True)[:12]
        ]
        purok_breakdown = [
            {
                "barangay": point.get("barangay") or "Barangay not set",
                "purok_name": point.get("purok_name") or "Purok not set",
                "cases": point.get("cases", 0),
            }
            for point in sorted(bucket.get("cluster_points", []), key=lambda item: item.get("cases", 0), reverse=True)[:12]
        ]
        top_barangays = [
            {"barangay": barangay, "referrals": count}
            for barangay, count in sorted(
                bucket["top_barangays"].items(),
                key=lambda item: item[1],
                reverse=True,
            )[:5]
        ]
        level = get_outbreak_level(bucket["gis_cases"], bucket["recent_referrals"], bucket["risk_threshold"])
        current_signal = bucket["recent_gis_cases"] + bucket["recent_referrals"]
        previous_signal = bucket["previous_gis_cases"] + bucket["previous_referrals"]
        relevant_forecasts = forecasts_by_disease[bucket["disease"]]
        projected_cases = round(sum(item["forecasts"][0]["predicted"] for item in relevant_forecasts)) if relevant_forecasts and all(item["status"] == "ready" for item in relevant_forecasts) else None
        trend_direction = get_trend_direction(current_signal, previous_signal)
        prediction_level = get_prediction_level(level, trend_direction, projected_cases, bucket["risk_threshold"]) if projected_cases is not None else "unavailable"
        clusters = build_case_clusters(bucket["cluster_points"])
        public_bucket = {key: value for key, value in bucket.items() if key != "cluster_points"}
        disease_payload = {
            **public_bucket,
            "top_barangays": top_barangays,
            "risk_level": level,
            "cluster_count": len(clusters),
            "clusters": clusters[:5],
            "barangay_breakdown": barangay_breakdown,
            "purok_breakdown": purok_breakdown,
            "trend_direction": trend_direction,
            "current_30_day_signal": current_signal,
            "previous_30_day_signal": previous_signal,
            "projected_30_day_cases": projected_cases,
            "prediction_level": prediction_level,
            "resource_recommendations": [],
            "medicine_demand_forecast": [],
            "is_common_ph_outbreak": bucket["disease"] in {disease["name"] for disease in OUTBREAK_DISEASES},
        }
        disease_payload["resource_recommendations"] = build_resource_recommendations(disease_payload, prediction_level)
        # Medicine forecasts come from recorded consumption, not assumed medicine-per-disease factors.
        disease_payload["medicine_demand_forecast"] = []
        diseases.append(
            disease_payload
        )

    diseases.sort(
        key=lambda disease: (
            {"high": 0, "watch": 1, "normal": 2}[disease["risk_level"]],
            -(disease["gis_cases"] + disease["recent_referrals"]),
            disease["disease"],
        )
    )

    return Response(
        {
            "scope": {
                "barangay": assigned_barangay,
                "is_barangay_scoped": bool(assigned_barangay),
                "window_days": 30,
                "gis_status": gis_status,
            },
            "pipeline": [
                {"stage": "BHC", "label": "Disease referral encoded by barangay staff"},
                {"stage": "CHO", "label": "Referral reviewed by City Health Office"},
                {"stage": "GIS", "label": "Cases grouped by barangay and purok"},
                {"stage": "Predictive Analytics", "label": "Historical trends projected for outbreak and resource planning"},
                {"stage": "Alerts", "label": "Dashboard screening signals; delivery is not claimed"},
            ],
            "summary": {
                "total_outbreak_referrals": sum(disease["referrals"] for disease in diseases),
                "recent_outbreak_referrals": sum(disease["recent_referrals"] for disease in diseases),
                "total_gis_cases": sum(disease["gis_cases"] for disease in diseases),
                "high_risk_diseases": sum(1 for disease in diseases if disease["risk_level"] == "high"),
                "total_clusters": sum(disease["cluster_count"] for disease in diseases),
                "critical_predictions": sum(1 for disease in diseases if disease["prediction_level"] == "critical"),
                "elevated_predictions": sum(1 for disease in diseases if disease["prediction_level"] == "elevated"),
                "projected_30_day_cases": sum(disease["projected_30_day_cases"] for disease in diseases if disease["projected_30_day_cases"] is not None) if any(disease["projected_30_day_cases"] is not None for disease in diseases) else None,
                "watchlist_diseases": len(OUTBREAK_DISEASES),
            },
            "critical_alerts": [
                alert
                for alert in (build_critical_alert(disease) for disease in diseases)
                if alert is not None
            ],
            "forecast_analysis": forecast_analysis,
            "monthly_history": [
                {"month": month.isoformat(), "cases": cases}
                for month, cases in monthly_rows
            ],
            "diseases": diseases,
        }
    )
