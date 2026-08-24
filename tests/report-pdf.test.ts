import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { buildReportPdf } from "../lib/report-pdf.ts";

test("buildReportPdf creates a readable one-page report", async () => {
  const bytes = await buildReportPdf({
    accountEmail: "demo@example.com",
    period: "monthly",
    start: new Date("2026-08-01T00:00:00+08:00"),
    end: new Date("2026-08-24T23:59:59+08:00"),
    rows: [{
      device_name: "Demo Unit",
      appliance_type: "other",
      measured_kwh: 61.7927,
      estimated_kwh: 60,
      average_watts: 537.79,
      variable_cost_php: 744.21,
      limit_php: 500,
      budget_percent: 148.84,
    }],
  });

  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), "%PDF");
  const document = await PDFDocument.load(bytes);
  assert.equal(document.getPageCount(), 1);
  assert.equal(document.getTitle(), "WattWise monthly energy report");
});

test("buildReportPdf paginates long appliance lists", async () => {
  const bytes = await buildReportPdf({
    accountEmail: "demo@example.com",
    period: "monthly",
    start: new Date("2026-08-01T00:00:00+08:00"),
    end: new Date("2026-08-24T23:59:59+08:00"),
    rows: Array.from({ length: 30 }, (_, index) => ({
      device_name: `Appliance ${index + 1}`,
      appliance_type: "other",
      measured_kwh: 1.25,
      estimated_kwh: 2,
      average_watts: 500,
      variable_cost_php: 15.05,
      limit_php: 100,
      budget_percent: 15.05,
    })),
  });

  const document = await PDFDocument.load(bytes);
  assert.ok(document.getPageCount() > 1);
});
