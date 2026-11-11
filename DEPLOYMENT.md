# Deploy MediCena with GitHub, Render, and Supabase

Use one GitHub repository. The root contains `frontend/`, `backend/`, and `.gitignore`. Render runs `frontend/` as a Static Site and `backend/` as a Python Web Service. The browser calls Django over HTTPS. Django connects to Supabase PostgreSQL for app records and to PostgreSQL with PostGIS for GIS records. Both Django connections can point at the same Supabase database.

## 1. Push the source to GitHub

Create an empty private GitHub repository. From the `MediCENA_V1` folder, run:

```powershell
git init -b main
git add .
git status --short
git diff --cached --stat
git commit -m "Prepare MediCena for Render deployment"
git remote add origin https://github.com/Lnnon/MediCENA.git
git push -u origin main
```

Review the staged files before committing. The root `.gitignore` excludes local environment files, SQLite databases, backups, patient uploads, credential files, and generated assets. If your GitHub repo already has commits, clone it into a separate folder, copy the source into that checkout, review the changes, and commit on a branch. Use the existing history.

## 2. Prepare Supabase

1. Create a Supabase project. Disable the **Data API** under its settings. MediCena uses Django for application access and connects to PostgreSQL directly. [Supabase API security](https://supabase.com/docs/guides/api/securing-your-api)
2. In **Connect**, get the database host, port, database name, username, and password. For an IPv4 connection use the **Session pooler**, usually port `5432`. Use the username exactly as shown by Supabase. [Supabase PostgreSQL connections](https://supabase.com/docs/guides/database/connecting-to-postgres)
3. On a fresh Supabase target, enable PostGIS in the same schema as the source dump. This workspace currently has PostGIS and the GIS tables in `public`. In Supabase SQL Editor, use `CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;`. If PostGIS is already installed in another schema, resolve the schema match before restoring. [Supabase PostGIS guide](https://supabase.com/docs/guides/database/extensions/postgis)
4. Export the four tables from your working GIS database using pgAdmin or `pg_dump`. Restore the archive into the fresh target with `pg_restore --exit-on-error --single-transaction --no-owner --no-privileges`. Use the direct connection if reachable, or the session pooler when you need IPv4. Keep the archive outside Git.

   For example, to export from your current local PostgreSQL connection, adjust the port and user if needed:

   ```powershell
   pg_dump -h localhost -p 5432 -U postgres -d MEDIFLOW -Fc -f "$env:USERPROFILE\medicena-gis.backup" --table=public.barangays --table=public.puroks --table=public.diseases --table=public.disease_cases
   ```

   In the restore command, use the target host, port, username, and database from **Connect**. `-W` prompts for the password. Run once against the fresh database:

   ```powershell
   $env:PGSSLMODE = 'require'
   pg_restore -h YOUR_SUPABASE_HOST -p 5432 -U YOUR_SUPABASE_USER -d postgres -W --exit-on-error --single-transaction --no-owner --no-privileges "$env:USERPROFILE\medicena-gis.backup"
   ```

5. Apply Django migrations to the Supabase application database with `python manage.py migrate --noinput` from `backend`, with the application database environment variables below set for that process. Double-check the target before running the command. For a fresh app database, run `python manage.py seed_medicine_catalog` and `python manage.py createsuperuser` against the same target to initialize the catalog and admin account.

   Git pushes and Django migrations do not transfer your SQLite records. If you need existing app records, export from the local `backend` folder before setting any Supabase variables in that terminal:

   ```powershell
   $env:DJANGO_DB_ENGINE = 'django.db.backends.sqlite3'
   $env:DJANGO_DB_NAME = (Resolve-Path .\db.sqlite3).Path
   python manage.py dumpdata auth.group core --natural-foreign --exclude core.BarangayBoundary --exclude core.PurokBoundary --exclude core.Disease --exclude core.DiseaseCase --exclude core.EmailVerificationCode --output "$env:USERPROFILE\medicena-private-fixture.json"
   ```

   For the hosted migration or import, open a separate PowerShell window in `backend`. Set the connection values from Supabase **Connect** and verify the host and database shown by the first Python command before continuing:

   ```powershell
   $env:DJANGO_DB_ENGINE = 'django.db.backends.postgresql'
   $env:DJANGO_DB_NAME = 'postgres'
   $env:DJANGO_DB_HOST = 'YOUR_SUPABASE_HOST'
   $env:DJANGO_DB_PORT = '5432'
   $env:DJANGO_DB_USER = 'YOUR_SUPABASE_USER'
   $env:DJANGO_DB_PASSWORD = Read-Host 'Supabase database password' -MaskInput
   $env:DJANGO_DB_SSLMODE = 'require'
   python -c "from mediflow.settings import DATABASES; d = DATABASES['default']; print(d['HOST'], d['NAME'])"
   python manage.py migrate --database default --noinput
   ```

   To restore the existing app records, run `python manage.py loaddata "$env:USERPROFILE\medicena-private-fixture.json" --database default` in that same window on the empty, migrated target, before creating accounts or seeding the catalog there. Rehearse the import on a test database first, keep the fixture private, compare record counts, and reset imported demo passwords before allowing access. Close the window to clear the temporary connection settings.

## 3. Create the Render backend Web Service

Connect the GitHub repo and choose **Python** as the runtime. Use these values. [Render Django deployment guide](https://render.com/docs/deploy-django)

| Render field | Value |
| --- | --- |
| Branch | `main` |
| Root Directory | `backend` |
| Build Command | `pip install -r requirements.txt && python manage.py collectstatic --noinput` |
| Start Command | `gunicorn mediflow.wsgi:application --bind 0.0.0.0:$PORT` |
| Health Check Path | `/api/address/lucena-city/` |

Set the following environment variables on the **backend service**. Use your actual names and database connection values. Set `DJANGO_SECRET_KEY` to a generated secret in Render.

| Variable | Value |
| --- | --- |
| `DJANGO_DEBUG` | `False` |
| `DJANGO_SECRET_KEY` | Generated secret |
| `DJANGO_ALLOWED_HOSTS` | `your-medicena-api.onrender.com` (hostname only) |
| `DJANGO_CORS_ALLOWED_ORIGINS` | `https://your-medicena-web.onrender.com` (no trailing slash) |
| `DJANGO_DB_ENGINE` | `django.db.backends.postgresql` |
| `DJANGO_DB_NAME` | Supabase database name, usually `postgres` |
| `DJANGO_DB_HOST` | Supabase session pooler host |
| `DJANGO_DB_PORT` | Supabase session pooler port, usually `5432` |
| `DJANGO_DB_USER` | Supabase connection username |
| `DJANGO_DB_PASSWORD` | Supabase database password |
| `DJANGO_DB_SSLMODE` | `require` |
| `DB_NAME`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` | The matching GIS connection values. Repeat the application database values if both aliases point to the same database. |
| `DJANGO_GIS_DB_SSLMODE` | `require` |

If Render assigns a different backend hostname, update `DJANGO_ALLOWED_HOSTS` to match. If you use a custom domain for Django admin, add its hostname to `DJANGO_ALLOWED_HOSTS` too.

## 4. Create the Render frontend Static Site

Connect the same repo and branch. Leave **Root Directory** blank. The React build imports the GAMOT catalog from `backend/core/medicine_catalog.json`, so Render needs both folders in its build context. [Render monorepo support](https://render.com/docs/monorepo-support)

| Render field | Value |
| --- | --- |
| Build Command | `npm --prefix frontend ci && npm --prefix frontend run build` |
| Publish Directory | `frontend/dist` |
| Environment variable | `VITE_API_BASE_URL=https://your-medicena-api.onrender.com/api/` |

Use Node 24 if you set `NODE_VERSION`. Use the actual Render backend URL. The frontend build includes this value, so redeploy the Static Site if the backend URL changes. If the frontend hostname differs from the planned one, update `DJANGO_CORS_ALLOWED_ORIGINS` on the backend and redeploy it. [Render Static Sites](https://render.com/docs/static-sites)

## 5. Verify the deployment

1. Open `https://your-medicena-api.onrender.com/api/address/lucena-city/` and confirm it returns JSON.
2. Run `python -m pytest -q` in `backend` for the isolated Django suite. In a new environment, install `pytest` and `pytest-django` first. For the hosted read-only checks, set `SUPABASE_DATABASE_URL` and `SUPABASE_GIS_DATABASE_URL` in your shell and run `python -m pytest -q tests/test_supabase.py`.
3. Open the Render frontend, sign in, check Medicine Inventory, and check HealthMap from a CHO or BHC account.
4. Before deploying workflows that depend on uploaded prescriptions, configure persistent private media storage and authorized downloads. The development media folder is local and the deployed static file server serves only application assets.
