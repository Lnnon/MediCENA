import os
from contextlib import contextmanager

import psycopg
import pytest


@contextmanager
def read_only_cursor(env_name):
    dsn = os.environ.get(env_name)
    if not dsn:
        pytest.skip(f"Set {env_name} to run this database check.")

    try:
        options = psycopg.conninfo.conninfo_to_dict(dsn)
        options.setdefault("sslmode", "require")
        options["connect_timeout"] = 10
        with psycopg.connect(**options) as connection:
            connection.read_only = True
            with connection.cursor() as cursor:
                cursor.execute("SET LOCAL statement_timeout = '10s'")
                yield cursor
    except psycopg.Error as exc:
        pytest.fail(f"{env_name} check failed ({type(exc).__name__}). Check the connection and expected schema.", pytrace=False)


def test_supabase_postgres_connection():
    with read_only_cursor("SUPABASE_DATABASE_URL") as cursor:
        cursor.execute("SELECT 1")
        assert cursor.fetchone() == (1,)


def test_supabase_gis_schema():
    with read_only_cursor("SUPABASE_GIS_DATABASE_URL") as cursor:
        cursor.execute("SELECT ST_AsGeoJSON(ST_MakePoint(0, 0))")
        assert cursor.fetchone()[0]
        cursor.execute("SELECT fid, barangay, ST_AsGeoJSON(geom) FROM barangays LIMIT 0")
        cursor.execute("SELECT fid, barangay, purok_name, ST_AsGeoJSON(geom) FROM puroks LIMIT 0")
        cursor.execute("SELECT id, disease_name, category FROM diseases LIMIT 0")
        cursor.execute("SELECT id, disease_id, purok_fid, case_date, total_cases FROM disease_cases LIMIT 0")
