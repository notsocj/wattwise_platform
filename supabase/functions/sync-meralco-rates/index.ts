type ArchiveEntry = {
  monthLabel: string;
  monthDate: Date;
  title: string;
  pdfUrl: string;
};

type ParsedRates = {
  generation: number | null;
  transmission: number | null;
  system_loss: number | null;
  distribution: number | null;
  universal_charges: number | null;
  fit_all: number | null;
  vat_rate: number | null;
  metering_charge: number | null;
  supply_charge: number | null;
};

type CompleteRates = {
  generation: number;
  transmission: number;
  system_loss: number;
  distribution: number;
  universal_charges: number;
  fit_all: number;
  vat_rate: number;
  metering_charge: number;
  supply_charge: number;
};

type SyncRunStatus = "success" | "failed" | "dry_run";

type ExistingRateRow = {
  effective_month: string;
  vat_rate: number;
  generation: number;
  transmission: number;
  system_loss: number;
  distribution: number;
  universal_charges: number;
  fit_all: number;
  metering_charge: number;
  supply_charge: number;
};

const DEFAULT_RATES_ARCHIVES_URL =
  "https://company.meralco.com.ph/news-and-advisories/rates-archives";

const MONTHS: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-secret",
};

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

function toIsoMonthStart(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}-01`;
}

function parseMonthLabel(monthLabel: string): Date | null {
  const cleaned = monthLabel.replace(/\s+/g, " ").trim();
  const match = cleaned.match(/^([A-Za-z]+)\s+(\d{4})$/);

  if (!match) {
    return null;
  }

  const month = MONTHS[match[1].toLowerCase()];
  const year = Number(match[2]);

  if (month === undefined || Number.isNaN(year)) {
    return null;
  }

  return new Date(Date.UTC(year, month, 1));
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function isSummaryTitle(title: string): boolean {
  const normalized = title.toLowerCase();
  return /summary\s+(of\s+)?schedule\s+of\s+rates/.test(normalized);
}

function parseArchiveEntries(html: string): ArchiveEntry[] {
  const entries: ArchiveEntry[] = [];

  const rowRegex =
    /<td[^>]*views-field-field-date-created[^>]*>\s*([^<]+?)\s*<\/td>[\s\S]*?<td[^>]*views-field-title[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>[\s\S]*?<td[^>]*views-field-field-downloadable-file[^>]*>[\s\S]*?<a[^>]*href="([^"]+?\.pdf(?:\?[^"]*)?)"/gi;

  let match: RegExpExecArray | null;
  while ((match = rowRegex.exec(html)) !== null) {
    const monthLabel = normalizeWhitespace(match[1]);
    const title = normalizeWhitespace(match[2]);
    const pdfUrl = match[3].trim();
    const monthDate = parseMonthLabel(monthLabel);

    if (!monthDate) {
      continue;
    }

    entries.push({
      monthLabel,
      monthDate,
      title,
      pdfUrl,
    });
  }

  return entries;
}

function selectSummaryEntry(entries: ArchiveEntry[], targetMonth?: string): ArchiveEntry {
  const summaryEntries = entries.filter((entry) => isSummaryTitle(entry.title));

  if (summaryEntries.length === 0) {
    throw new Error("No 'Summary Schedule of Rates' PDF entries found in rates archives.");
  }

  if (targetMonth) {
    const normalizedTarget = `${targetMonth}-01`;
    const found = summaryEntries.find(
      (entry) => toIsoMonthStart(entry.monthDate) === normalizedTarget
    );

    if (!found) {
      throw new Error(
        `No summary PDF found for target month ${targetMonth}.`
      );
    }

    return found;
  }

  summaryEntries.sort((a, b) => b.monthDate.getTime() - a.monthDate.getTime());
  return summaryEntries[0];
}

function bytesToTextFragments(bytes: Uint8Array): string {
  const raw = new TextDecoder("latin1").decode(bytes);
  const chunks = raw.match(/[A-Za-z0-9][A-Za-z0-9\s.,:%()\/+\-]{2,}/g) ?? [];
  return chunks.join("\n");
}

async function extractPdfTextWithPdfJs(pdfBytes: Uint8Array): Promise<string | null> {
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: pdfBytes,
      disableWorker: true,
      isEvalSupported: false,
      disableFontFace: true,
      useSystemFonts: false,
    });

    const pdf = await loadingTask.promise;
    const pageTexts: string[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = (textContent.items as Array<{ str?: string }>)
        .map((item) => item.str ?? "")
        .join(" ");

      if (pageText.trim()) {
        pageTexts.push(pageText);
      }
    }

    const combined = pageTexts.join("\n").trim();
    return combined.length >= 120 ? combined : null;
  } catch (_error) {
    return null;
  }
}

async function extractPdfText(pdfBytes: Uint8Array, pdfUrl: string): Promise<string> {
  const externalParserUrl = Deno.env.get("PDF_TEXT_EXTRACTOR_URL")?.trim();

  if (externalParserUrl) {
    const headers: HeadersInit = {
      "Content-Type": "application/pdf",
      "x-source-url": pdfUrl,
    };

    const parserSecret = Deno.env.get("PDF_TEXT_EXTRACTOR_SECRET")?.trim();
    if (parserSecret) {
      headers["Authorization"] = `Bearer ${parserSecret}`;
    }

    const parserResponse = await fetch(externalParserUrl, {
      method: "POST",
      headers,
      body: pdfBytes,
    });

    if (!parserResponse.ok) {
      throw new Error(
        `External PDF parser failed with status ${parserResponse.status}.`
      );
    }

    const parserContentType = parserResponse.headers.get("content-type") || "";
    if (parserContentType.includes("application/json")) {
      const json = await parserResponse.json();
      const text =
        (typeof json.text === "string" && json.text) ||
        (typeof json.content === "string" && json.content) ||
        (typeof json.plainText === "string" && json.plainText) ||
        "";

      if (!text.trim()) {
        throw new Error("External PDF parser returned no text.");
      }

      return text;
    }

    const text = await parserResponse.text();
    if (!text.trim()) {
      throw new Error("External PDF parser returned empty response body.");
    }

    return text;
  }

  const pdfJsText = await extractPdfTextWithPdfJs(pdfBytes);
  if (pdfJsText) {
    return pdfJsText;
  }

  // Zero-config fallback: use jina.ai's PDF-to-text proxy if available.
  // This preserves full automation when no dedicated parser service is configured.
  const strippedPdfUrl = pdfUrl.replace(/^https?:\/\//, "");
  const jinaProxyUrls = [
    `https://r.jina.ai/http://${strippedPdfUrl}`,
    `https://r.jina.ai/https://${strippedPdfUrl}`,
  ];

  for (const jinaProxyUrl of jinaProxyUrls) {
    try {
      const jinaResponse = await fetch(jinaProxyUrl, {
        headers: {
          "User-Agent": "WattWise-MeralcoRateSync/1.0",
        },
      });

      if (!jinaResponse.ok) {
        continue;
      }

      const jinaText = await jinaResponse.text();
      const normalizedJina = jinaText.toLowerCase();
      const looksLikeProxyError =
        normalizedJina.includes("title: error") ||
        normalizedJina.includes("returned error") ||
        normalizedJina.includes("forbidden") ||
        normalizedJina.includes("cached snapshot");

      const hasRateSignals =
        normalizedJina.includes("summary schedule of rates") ||
        normalizedJina.includes("for non-lifeline") ||
        normalizedJina.includes("residential") ||
        normalizedJina.includes("fit-all");

      if (!looksLikeProxyError && hasRateSignals && jinaText.trim().length >= 200) {
        return jinaText;
      }
    } catch (_error) {
      // Non-fatal: continue trying other proxy forms/local fallback.
    }
  }

  const localText = bytesToTextFragments(pdfBytes);
  if (localText.length < 600) {
    throw new Error(
      "PDF text extraction was too short for reliable parsing. Configure PDF_TEXT_EXTRACTOR_URL for robust extraction."
    );
  }

  return localText;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toNumber(raw: string): number | null {
  const normalized = raw.replace(/,/g, "").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseSignedNumberToken(raw: string): number | null {
  const trimmed = raw.trim();
  const normalized =
    trimmed.startsWith("(") && trimmed.endsWith(")")
      ? `-${trimmed.slice(1, -1)}`
      : trimmed;
  return toNumber(normalized);
}

function parseResidentialBaseRowValues(text: string): number[] | null {
  const rowAnchors = [
    "101 TO 200 KWH",
    "201 TO 300 KWH",
    "0 TO 20 KWH",
  ];

  for (const anchor of rowAnchors) {
    const idx = text.toUpperCase().indexOf(anchor);
    if (idx < 0) {
      continue;
    }

    const snippet = text.slice(idx, idx + 500);
    const tokens = snippet.match(/\(?-?\d+(?:\.\d+)?\)?/g) ?? [];
    let numbers = tokens
      .map((token) => parseSignedNumberToken(token))
      .filter((value): value is number => value !== null);

    // Row labels include kWh ranges (e.g., 101 TO 200 KWH). Remove those leading bounds.
    if (
      numbers.length >= 20 &&
      numbers[0] >= 0 &&
      numbers[0] <= 500 &&
      numbers[1] >= 0 &&
      numbers[1] <= 500 &&
      numbers[2] > 0 &&
      numbers[2] < 20
    ) {
      numbers = numbers.slice(2);
    }

    if (numbers.length >= 18) {
      return numbers;
    }
  }

  // Anchor-free fallback: find a plausible residential rate row by numeric pattern.
  const allDecimalTokens = text.match(/\(?-?\d+\.\d+\)?/g) ?? [];
  const allNumbers = allDecimalTokens
    .map((token) => parseSignedNumberToken(token))
    .filter((value): value is number => value !== null);

  for (let i = 0; i + 18 < allNumbers.length; i += 1) {
    const window = allNumbers.slice(i, i + 19);

    const looksLikeResidentialRow =
      window[0] >= 3 &&
      window[0] <= 15 &&
      window[1] >= 0.5 &&
      window[1] <= 3 &&
      window[2] >= 0.1 &&
      window[2] <= 2 &&
      window[3] >= 0.5 &&
      window[3] <= 3 &&
      window[7] >= 0 &&
      window[7] <= 20 &&
      window[17] >= 0 &&
      window[17] <= 2 &&
      window[18] >= 0 &&
      window[18] <= 2;

    if (looksLikeResidentialRow) {
      return window;
    }
  }

  return null;
}

function findByLabels(
  text: string,
  labels: string[],
  options?: { min?: number; max?: number; window?: number; requireDecimal?: boolean }
): number | null {
  const min = options?.min ?? Number.NEGATIVE_INFINITY;
  const max = options?.max ?? Number.POSITIVE_INFINITY;
  const window = options?.window ?? 120;
  const requireDecimal = options?.requireDecimal ?? false;
  const numberPattern = requireDecimal
    ? "-?\\d{1,4}(?:,\\d{3})*\\.\\d{1,4}"
    : "-?\\d{1,4}(?:,\\d{3})*(?:\\.\\d{1,4})?";

  for (const label of labels) {
    const escaped = escapeRegExp(label);
    const regex = new RegExp(
      `${escaped}[\\s\\S]{0,${window}}?(${numberPattern})`,
      "gi"
    );

    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const value = toNumber(match[1]);
      if (value === null) {
        continue;
      }
      if (value >= min && value <= max) {
        return value;
      }
    }
  }

  return null;
}

function findVatRate(text: string): number | null {
  const vatPercentRegex = /vat[\s\S]{0,50}?(\d{1,2}(?:\.\d+)?)\s*%/gi;
  let vatPercentMatch: RegExpExecArray | null;

  while ((vatPercentMatch = vatPercentRegex.exec(text)) !== null) {
    const value = Number(vatPercentMatch[1]);
    if (Number.isFinite(value) && value > 0 && value <= 100) {
      return value / 100;
    }
  }

  return findByLabels(text, ["VAT rate", "VAT"], { min: 0.01, max: 0.3 });
}

function parseRatesFromText(text: string): ParsedRates {
  const normalizedText = text
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const residentialBaseRow = parseResidentialBaseRowValues(normalizedText);

  const rowFallbackUniversal =
    residentialBaseRow && residentialBaseRow.length >= 19
      ? residentialBaseRow.slice(11, 17).reduce((sum, value) => sum + Math.max(value, 0), 0)
      : null;

  const rowFallbackGeneration =
    residentialBaseRow && residentialBaseRow.length >= 1
      ? residentialBaseRow[0]
      : null;

  const rowFallbackTransmission =
    residentialBaseRow && residentialBaseRow.length >= 2
      ? residentialBaseRow[1]
      : null;

  const rowFallbackSystemLoss =
    residentialBaseRow && residentialBaseRow.length >= 3
      ? residentialBaseRow[2]
      : null;

  const rowFallbackDistribution =
    residentialBaseRow && residentialBaseRow.length >= 4
      ? residentialBaseRow[3]
      : null;

  const rowFallbackFitAll =
    residentialBaseRow && residentialBaseRow.length >= 19
      ? residentialBaseRow[17]
      : null;

  const rowFallbackSupplyCharge =
    residentialBaseRow && residentialBaseRow.length >= 6
      ? residentialBaseRow[5]
      : null;

  const rowFallbackMeteringCharge =
    residentialBaseRow && residentialBaseRow.length >= 8
      ? residentialBaseRow[7]
      : null;

  return {
    generation:
      rowFallbackGeneration ??
      findByLabels(normalizedText, ["Generation Charge", "Generation"], {
        min: 0.1,
        max: 20,
        requireDecimal: true,
      }),
    transmission:
      rowFallbackTransmission ??
      findByLabels(normalizedText, ["Transmission Charge", "Transmission"], {
        min: 0.05,
        max: 10,
        requireDecimal: true,
      }),
    system_loss:
      rowFallbackSystemLoss ??
      findByLabels(normalizedText, ["System Loss Charge", "System Loss", "System-Loss"], {
        min: 0.01,
        max: 10,
        requireDecimal: true,
      }),
    distribution:
      rowFallbackDistribution ??
      findByLabels(normalizedText, ["Distribution Charge", "Distribution"], {
        min: 0.01,
        max: 10,
        requireDecimal: true,
      }),
    universal_charges:
      rowFallbackUniversal ??
      findByLabels(
        normalizedText,
        ["Universal Charge", "Universal Charges", "Universal Charge FIT-All"],
        { min: 0.001, max: 10, window: 1200, requireDecimal: true }
      ),
    fit_all:
      rowFallbackFitAll ??
      findByLabels(normalizedText, ["FIT-All", "FIT All", "FITALL"], {
        min: 0.0001,
        max: 3,
        requireDecimal: true,
      }),
    vat_rate: findVatRate(normalizedText),
    metering_charge:
      rowFallbackMeteringCharge ??
      findByLabels(normalizedText, ["Metering Charge", "Metering Cust Charge"], {
        min: 0,
        max: 100,
        requireDecimal: true,
      }),
    supply_charge:
      rowFallbackSupplyCharge ??
      findByLabels(normalizedText, ["Supply Charge", "Supply Cust Charge"], {
        min: 0,
        max: 100,
        requireDecimal: true,
      }),
  };
}

function requireNumber(field: keyof CompleteRates, value: number | null): number {
  if (value === null || !Number.isFinite(value)) {
    throw new Error(`Missing or invalid parsed value for '${field}'.`);
  }

  return value;
}

function validateRanges(rates: CompleteRates): void {
  const checks: Array<{ key: keyof CompleteRates; min: number; max: number }> = [
    { key: "generation", min: 0.1, max: 20 },
    { key: "transmission", min: 0.05, max: 10 },
    { key: "system_loss", min: 0.01, max: 10 },
    { key: "distribution", min: 0.01, max: 10 },
    { key: "universal_charges", min: 0.001, max: 10 },
    { key: "fit_all", min: 0, max: 3 },
    { key: "vat_rate", min: 0.01, max: 0.3 },
    { key: "metering_charge", min: 0, max: 100 },
    { key: "supply_charge", min: 0, max: 100 },
  ];

  for (const check of checks) {
    const value = rates[check.key];
    if (value < check.min || value > check.max) {
      throw new Error(
        `Parsed '${check.key}' value ${value} is outside expected range (${check.min} - ${check.max}).`
      );
    }
  }
}

function validateAgainstPrevious(
  next: CompleteRates,
  previous: ExistingRateRow | null,
  force: boolean
): string[] {
  const warnings: string[] = [];

  if (!previous) {
    return warnings;
  }

  const maxRelativeChange = Number(
    Deno.env.get("MERALCO_MAX_RELATIVE_CHANGE") ?? "0.5"
  );

  const fields: Array<keyof CompleteRates> = [
    "generation",
    "transmission",
    "system_loss",
    "distribution",
    "universal_charges",
    "fit_all",
    "vat_rate",
    "metering_charge",
    "supply_charge",
  ];

  for (const field of fields) {
    const prev = Number(previous[field]);
    const nextValue = Number(next[field]);

    if (!Number.isFinite(prev) || prev <= 0) {
      continue;
    }

    const relativeChange = Math.abs(nextValue - prev) / prev;
    if (relativeChange > maxRelativeChange) {
      const warning = `${field} changed by ${(relativeChange * 100).toFixed(2)}% from ${prev} to ${nextValue}.`;
      warnings.push(warning);
    }
  }

  if (warnings.length > 0 && !force) {
    throw new Error(
      `Anomaly validation failed. Set force=true to override. Details: ${warnings.join(" | ")}`
    );
  }

  return warnings;
}

async function logRun(
  supabase: ReturnType<typeof createClient>,
  payload: {
    status: SyncRunStatus;
    message: string;
    source_url: string;
    pdf_url?: string;
    effective_month?: string;
    raw_rates?: ParsedRates;
    warnings?: string[];
  }
): Promise<void> {
  const { error } = await supabase.from("meralco_rate_sync_runs").insert({
    status: payload.status,
    message: payload.message,
    source_url: payload.source_url,
    pdf_url: payload.pdf_url ?? null,
    effective_month: payload.effective_month ?? null,
    raw_rates: payload.raw_rates ?? null,
    warnings: payload.warnings ?? [],
    ran_at: new Date().toISOString(),
  });

  if (error) {
    // Do not fail the main pipeline if log table is unavailable.
    console.warn("meralco_rate_sync_runs insert skipped:", error.message);
  }
}

function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import * as pdfjsLib from "https://esm.sh/pdfjs-dist@4.10.38/legacy/build/pdf.mjs";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed. Use POST." });
  }

  let supabase: ReturnType<typeof createClient> | null = null;
  let sourceUrlForLog = DEFAULT_RATES_ARCHIVES_URL;

  try {
    const requiredSecret = getRequiredEnv("MERALCO_SYNC_SECRET");
    const incomingSecret = req.headers.get("x-sync-secret")?.trim();

    if (!incomingSecret || incomingSecret !== requiredSecret) {
      return jsonResponse(401, { error: "Unauthorized." });
    }

    const supabaseUrl = getRequiredEnv("SUPABASE_URL");
    const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

    supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const dryRun = Boolean(body?.dryRun);
    const force = Boolean(body?.force);
    const targetMonth = typeof body?.targetMonth === "string" ? body.targetMonth : undefined;
    const ratesArchivesUrl =
      typeof body?.ratesArchivesUrl === "string" && body.ratesArchivesUrl.trim()
        ? body.ratesArchivesUrl.trim()
        : DEFAULT_RATES_ARCHIVES_URL;

    sourceUrlForLog = ratesArchivesUrl;

    const archiveResponse = await fetch(ratesArchivesUrl, {
      headers: {
        "User-Agent": "WattWise-MeralcoRateSync/1.0",
      },
    });

    if (!archiveResponse.ok) {
      throw new Error(
        `Failed to fetch rates archives page. HTTP ${archiveResponse.status}.`
      );
    }

    const archiveHtml = await archiveResponse.text();
    const archiveEntries = parseArchiveEntries(archiveHtml);

    if (archiveEntries.length === 0) {
      throw new Error("No downloadable rate rows found in rates archives HTML.");
    }

    const selectedSummary = selectSummaryEntry(archiveEntries, targetMonth);
    const effectiveMonth = toIsoMonthStart(selectedSummary.monthDate);

    const pdfResponse = await fetch(selectedSummary.pdfUrl, {
      headers: {
        "User-Agent": "WattWise-MeralcoRateSync/1.0",
      },
    });

    if (!pdfResponse.ok) {
      throw new Error(`Failed to download summary PDF. HTTP ${pdfResponse.status}.`);
    }

    const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer());
    const extractedText = await extractPdfText(pdfBytes, selectedSummary.pdfUrl);
    const parsed = parseRatesFromText(extractedText);

    const { data: previousRow, error: previousError } = await supabase
      .from("meralco_rates")
      .select(
        "effective_month, vat_rate, generation, transmission, system_loss, distribution, universal_charges, fit_all, metering_charge, supply_charge"
      )
      .order("effective_month", { ascending: false })
      .limit(1)
      .maybeSingle<ExistingRateRow>();

    if (previousError) {
      throw new Error(`Failed to read previous meralco_rates row: ${previousError.message}`);
    }

    const completeRates: CompleteRates = {
      generation: requireNumber("generation", parsed.generation),
      transmission: requireNumber("transmission", parsed.transmission),
      system_loss: requireNumber("system_loss", parsed.system_loss),
      distribution: requireNumber("distribution", parsed.distribution),
      universal_charges: requireNumber("universal_charges", parsed.universal_charges),
      fit_all: requireNumber("fit_all", parsed.fit_all),
      vat_rate: parsed.vat_rate ?? previousRow?.vat_rate ?? (() => {
        throw new Error("Missing vat_rate in parsed data and no previous row fallback available.");
      })(),
      metering_charge:
        parsed.metering_charge ??
        previousRow?.metering_charge ??
        (() => {
          throw new Error(
            "Missing metering_charge in parsed data and no previous row fallback available."
          );
        })(),
      supply_charge:
        parsed.supply_charge ??
        previousRow?.supply_charge ??
        (() => {
          throw new Error(
            "Missing supply_charge in parsed data and no previous row fallback available."
          );
        })(),
    };

    validateRanges(completeRates);
    const warnings = validateAgainstPrevious(completeRates, previousRow ?? null, force);

    if (dryRun) {
      await logRun(supabase, {
        status: "dry_run",
        message: "Dry run completed successfully.",
        source_url: ratesArchivesUrl,
        pdf_url: selectedSummary.pdfUrl,
        effective_month: effectiveMonth,
        raw_rates: parsed,
        warnings,
      });

      return jsonResponse(200, {
        ok: true,
        mode: "dry_run",
        source_url: ratesArchivesUrl,
        selected_summary: selectedSummary,
        effective_month: effectiveMonth,
        parsed_rates: completeRates,
        warnings,
      });
    }

    const basePayload = {
      effective_month: effectiveMonth,
      vat_rate: completeRates.vat_rate,
      generation: completeRates.generation,
      transmission: completeRates.transmission,
      system_loss: completeRates.system_loss,
      distribution: completeRates.distribution,
      universal_charges: completeRates.universal_charges,
      fit_all: completeRates.fit_all,
      metering_charge: completeRates.metering_charge,
      supply_charge: completeRates.supply_charge,
    };

    const metadataPayload = {
      ...basePayload,
      source_url: ratesArchivesUrl,
      source_pdf_url: selectedSummary.pdfUrl,
      fetched_at: new Date().toISOString(),
      auto_updated: true,
    };

    let upsertResponse = await supabase
      .from("meralco_rates")
      .upsert(metadataPayload, { onConflict: "effective_month" })
      .select()
      .maybeSingle();

    if (upsertResponse.error && /column .* does not exist/i.test(upsertResponse.error.message)) {
      upsertResponse = await supabase
        .from("meralco_rates")
        .upsert(basePayload, { onConflict: "effective_month" })
        .select()
        .maybeSingle();
      warnings.push(
        "Metadata columns are not present yet. Applied base upsert without source/fetched metadata."
      );
    }

    if (upsertResponse.error) {
      throw new Error(`Failed to upsert meralco_rates row: ${upsertResponse.error.message}`);
    }

    await logRun(supabase, {
      status: "success",
      message: "Automatic Meralco rate sync completed.",
      source_url: ratesArchivesUrl,
      pdf_url: selectedSummary.pdfUrl,
      effective_month: effectiveMonth,
      raw_rates: parsed,
      warnings,
    });

    return jsonResponse(200, {
      ok: true,
      mode: "upsert",
      source_url: ratesArchivesUrl,
      selected_summary: selectedSummary,
      effective_month: effectiveMonth,
      rates_upserted: upsertResponse.data,
      warnings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (supabase) {
      await logRun(supabase, {
        status: "failed",
        message,
        source_url: sourceUrlForLog,
      });
    }

    return jsonResponse(500, {
      ok: false,
      error: message,
    });
  }
});
