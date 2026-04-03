# sync-meralco-rates (Supabase Edge Function)

Automates monthly insertion of base residential Meralco rates from the `Summary Schedule of Rates` PDF listed in:

- `https://company.meralco.com.ph/news-and-advisories/rates-archives`

This function intentionally ignores lifeline-tier rows and focuses on the base monthly components used by the billing engine.

## Request

- Method: `POST`
- Header: `x-sync-secret: <MERALCO_SYNC_SECRET>`
- Body (optional):

```json
{
  "dryRun": false,
  "force": false,
  "targetMonth": "2026-03",
  "ratesArchivesUrl": "https://company.meralco.com.ph/news-and-advisories/rates-archives"
}
```

## Required env vars

- `MERALCO_SYNC_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Optional env vars

- `PDF_TEXT_EXTRACTOR_URL` (recommended for robust PDF text extraction)
- `PDF_TEXT_EXTRACTOR_SECRET`
- `MERALCO_MAX_RELATIVE_CHANGE` (default `0.5`)

## What it writes

Upserts into `meralco_rates` by `effective_month`:

- `generation`
- `transmission`
- `system_loss`
- `distribution`
- `universal_charges`
- `fit_all`
- `vat_rate`
- `metering_charge`
- `supply_charge`

If metadata columns are available, it also writes:

- `source_url`
- `source_pdf_url`
- `fetched_at`
- `auto_updated`

Run logs are inserted into `meralco_rate_sync_runs` when the table exists.

## Failure behavior

No partial writes are done when parsing/validation fails.

- Parse failures abort the run.
- Out-of-range fields abort the run.
- Large month-over-month deltas abort unless `force=true`.
