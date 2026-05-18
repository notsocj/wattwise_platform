export type ArchiveEntry = {
  monthLabel: string;
  monthDate: Date;
  title: string;
  pdfUrl: string;
};

export type ParsedRates = {
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

export type CompleteRates = {
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

export type SyncRunStatus = "success" | "failed" | "dry_run";

export type ExistingRateRow = {
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
