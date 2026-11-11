from django.db import connections


def fetch_purok_map_rows(disease_id, barangay, purok_fid):
    location_filters = []
    params = []
    if barangay:
        location_filters.append("barangay = %s")
        params.append(barangay)
    if purok_fid is not None:
        location_filters.append("fid = %s")
        params.append(purok_fid)
    location_sql = f"WHERE {' AND '.join(location_filters)}" if location_filters else ""
    case_scope_sql = "JOIN selected_puroks p ON dc.purok_fid = p.fid" if location_filters else ""
    disease_sql = "WHERE dc.disease_id = %s" if disease_id is not None else ""
    if disease_id is not None:
        params.append(disease_id)

    # Aggregate case counts by ID before rendering geometry. This keeps polygon
    # values out of the aggregate and preserves puroks with no recorded cases.
    with connections["gis"].cursor() as cursor:
        cursor.execute(
            f"""
            WITH selected_puroks AS NOT MATERIALIZED (
                SELECT fid, barangay, purok_name, geom
                FROM puroks
                {location_sql}
            ), case_totals AS (
                SELECT dc.purok_fid, SUM(dc.total_cases)::integer AS cases
                FROM disease_cases dc
                {case_scope_sql}
                {disease_sql}
                GROUP BY dc.purok_fid
            )
            SELECT
                p.fid,
                p.barangay,
                p.purok_name,
                COALESCE(totals.cases, 0) AS cases,
                ST_Y(ST_Centroid(p.geom)) AS center_lat,
                ST_X(ST_Centroid(p.geom)) AS center_lng,
                ST_AsGeoJSON(p.geom) AS geometry
            FROM selected_puroks p
            LEFT JOIN case_totals totals ON totals.purok_fid = p.fid
            ORDER BY p.barangay, p.purok_name
            """,
            params,
        )
        return cursor.fetchall()
