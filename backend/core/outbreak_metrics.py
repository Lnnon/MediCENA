import math


CLUSTER_RADIUS_KM = 1.2


OUTBREAK_DISEASES = [
    {
        "name": "Dengue",
        "category": "Vector-borne disease",
        "keywords": ("dengue", "dengue fever", "dengue hemorrhagic"),
        "risk_threshold": 10,
    },
    {
        "name": "Leptospirosis",
        "category": "Flood and water-associated disease",
        "keywords": ("leptospirosis", "lepto"),
        "risk_threshold": 5,
    },
    {
        "name": "Measles",
        "category": "Vaccine-preventable disease",
        "keywords": ("measles", "rubeola", "tigdas"),
        "risk_threshold": 3,
    },
    {
        "name": "Cholera",
        "category": "Waterborne disease",
        "keywords": ("cholera",),
        "risk_threshold": 3,
    },
    {
        "name": "Typhoid Fever",
        "category": "Food and waterborne disease",
        "keywords": ("typhoid", "typhoid fever"),
        "risk_threshold": 5,
    },
    {
        "name": "Influenza-like Illness",
        "category": "Respiratory disease",
        "keywords": ("influenza", "flu", "ili", "influenza-like"),
        "risk_threshold": 10,
    },
    {
        "name": "COVID-19",
        "category": "Respiratory disease",
        "keywords": ("covid", "covid-19", "sars-cov-2"),
        "risk_threshold": 5,
    },
    {
        "name": "Hand, Foot and Mouth Disease",
        "category": "Communicable disease",
        "keywords": ("hand foot mouth", "hfmd", "hand, foot and mouth"),
        "risk_threshold": 5,
    },
]


def get_outbreak_definition(text):
    normalized = (text or "").lower()
    for disease in OUTBREAK_DISEASES:
        if any(keyword in normalized for keyword in disease["keywords"]):
            return disease
    return None


def get_outbreak_name_for_disease(disease_name):
    normalized_name = (disease_name or "").lower()
    for disease in OUTBREAK_DISEASES:
        if any(keyword in normalized_name for keyword in disease["keywords"]):
            return disease["name"]
    return None


def get_outbreak_level(cases, referrals, threshold):
    if cases >= threshold or referrals >= threshold:
        return "high"
    if cases > 0 or referrals > 0:
        return "watch"
    return "normal"


def get_distance_km(first, second):
    lat1, lng1 = math.radians(first["lat"]), math.radians(first["lng"])
    lat2, lng2 = math.radians(second["lat"]), math.radians(second["lng"])
    delta_lat = lat2 - lat1
    delta_lng = lng2 - lng1
    haversine = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lng / 2) ** 2
    )
    return 6371 * 2 * math.atan2(math.sqrt(haversine), math.sqrt(1 - haversine))


def get_cluster_risk(total_cases):
    if total_cases >= 30:
        return "high"
    if total_cases >= 10:
        return "watch"
    return "low"


def build_case_clusters(points, radius_km=CLUSTER_RADIUS_KM):
    clusters = []

    for point in sorted(points, key=lambda item: item["cases"], reverse=True):
        if point["cases"] <= 0 or point.get("lat") is None or point.get("lng") is None:
            continue

        matching_cluster = None
        for cluster in clusters:
            distance = get_distance_km(point, cluster["center"])
            if distance <= radius_km:
                matching_cluster = cluster
                break

        if not matching_cluster:
            matching_cluster = {
                "id": f"CL-{len(clusters) + 1:03d}",
                "center": {"lat": point["lat"], "lng": point["lng"]},
                "total_cases": 0,
                "affected_puroks": 0,
                "barangays": set(),
                "contributors": [],
            }
            clusters.append(matching_cluster)

        previous_cases = matching_cluster["total_cases"]
        next_cases = previous_cases + point["cases"]
        matching_cluster["center"] = {
            "lat": ((matching_cluster["center"]["lat"] * previous_cases) + (point["lat"] * point["cases"])) / next_cases,
            "lng": ((matching_cluster["center"]["lng"] * previous_cases) + (point["lng"] * point["cases"])) / next_cases,
        }
        matching_cluster["total_cases"] = next_cases
        matching_cluster["affected_puroks"] += 1
        matching_cluster["barangays"].add(point["barangay"])
        matching_cluster["contributors"].append(
            {
                "fid": point["fid"],
                "barangay": point["barangay"],
                "purok_name": point["purok_name"],
                "cases": point["cases"],
            }
        )

    return [
        {
            **cluster,
            "risk_level": get_cluster_risk(cluster["total_cases"]),
            "barangays": sorted(cluster["barangays"]),
            "contributors": sorted(cluster["contributors"], key=lambda item: item["cases"], reverse=True)[:8],
        }
        for cluster in sorted(clusters, key=lambda item: item["total_cases"], reverse=True)
    ]


def build_outbreak_bucket(disease):
    return {
        "disease": disease["name"],
        "category": disease["category"],
        "risk_threshold": disease["risk_threshold"],
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
        "source": "watchlist",
    }


def get_trend_direction(current_value, previous_value):
    if current_value > previous_value:
        return "increasing"
    if current_value < previous_value:
        return "decreasing"
    return "stable"


def get_prediction_level(risk_level, trend_direction, projected_cases, threshold):
    if risk_level == "high" or projected_cases >= threshold:
        return "critical"
    if trend_direction == "increasing":
        return "elevated"
    if projected_cases > 0:
        return "watch"
    return "low"


def build_resource_recommendations(disease, prediction_level):
    recommendations = []
    disease_name = disease["disease"].lower()

    if prediction_level in ("critical", "elevated"):
        recommendations.append("Prepare CHO rapid assessment and barangay follow-up.")
        recommendations.append("Prioritize medicine and supply checks for affected barangays.")

    if "dengue" in disease_name:
        recommendations.extend(
            [
                "Coordinate vector control, clean-up drives, and larvicide availability.",
                "Pre-position hydration supplies and fever monitoring resources.",
            ]
        )
    elif "leptospirosis" in disease_name:
        recommendations.append("Prepare post-flood case finding and prophylaxis coordination.")
    elif "cholera" in disease_name or "typhoid" in disease_name:
        recommendations.append("Coordinate water safety advisories and oral rehydration supplies.")
    elif "measles" in disease_name:
        recommendations.append("Review vaccination coverage and prepare contact tracing support.")
    elif "influenza" in disease_name or "covid" in disease_name:
        recommendations.append("Prepare respiratory triage, testing, and isolation guidance.")

    if not recommendations:
        recommendations.append("Continue routine surveillance and barangay-level monitoring.")

    return recommendations[:4]


def build_critical_alert(disease):
    if disease["prediction_level"] not in ("critical", "elevated"):
        return None

    return {
        "title": f"{disease['disease']} {disease['prediction_level']} alert",
        "severity": disease["prediction_level"],
        "message": (
            f"{disease['disease']} is {disease['trend_direction']} with "
            f"{disease['projected_30_day_cases']} forecast cases in the next calendar month."
        ),
        "delivery_channel": "dashboard_only",
        "email_status": "not_sent",
        "recipients": ["City Health Office", "assigned Barangay Health Center"],
    }
