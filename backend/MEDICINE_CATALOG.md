# GAMOT medicine catalog

The shared `core/medicine_catalog.json` contains exactly 75 generic names in the requested eight-category order, sorted alphabetically within categories. It supplies the searchable React selector. `MedicineCatalogEntry` stores the same catalog separately from `Medicine` formulation/stock records.

From the backend directory:

```powershell
python manage.py migrate
python manage.py seed_medicine_catalog
```

Migration `0022_medicinecatalogentry` only adds the catalog table. The seed is transactional and idempotent, creates no inventory, and never updates quantities, issue/expiry dates, requests, or distributions. It has already been applied locally.

All reference presentations are unverified examples supplied in the task, including additional syrup/suspension/solution examples for Paracetamol, Amoxicillin, and Cetirizine. No reference is automatically stocked or offered as a verified strength. Staff must enter actual strength and dates and explicitly confirm the product label and authorized reference. The confirmation is required by the backend on inventory save; it is an attestation, not external verification.

The existing Medicine model continues to represent individual formulation/strength/date combinations. Different strengths and forms have separate stock. A different issue/expiry date uses a separate Medicine record rather than changing dates shared with other facilities. No historical records are rewritten. This preserves existing request/distribution links; it does not introduce a new lot-tracking system.

The app's existing default database configuration is retained (SQLite locally; separate PostgreSQL GIS database). This change does not move application records to PostgreSQL.

Inventory remains real stock only. Catalog entries with no stock are available in Add Medicine, not fabricated table rows. Re-adding an existing stock record is rejected with instructions to use Edit, preventing accidental quantity replacement.

Checks run: Django system check; 27 tests across core.tests, core.test_inventory_catalog and core.test_medicine_batch; frontend build; targeted ESLint. Seed repeated twice with exactly 75 entries, and hashes of existing medicine, stock, request and distribution rows compared before/after with no differences. Browser visual QA remains to be performed.
