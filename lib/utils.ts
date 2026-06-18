import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Courier slug helpers ─────────────────────────────────────────────────────
// Shared by trackcourier.ts and shiprocketTracking.ts so the slug logic stays
// in one place.

const COURIER_SLUG_ALIASES: Record<string, string> = {
  "blue dart courier": "blue-dart-courier",
  bluedart: "blue-dart-courier",
  "delhivery courier": "delhivery-courier",
  delhivery: "delhivery-courier",
  "delhivery ground": "delhivery-courier",
  dlv: "delhivery-courier",
  "dlv ground b2b std": "delhivery-courier",
  "dlv_ground_b2b_std": "delhivery-courier",
  "amazon logistics": "amazon-logistics",
  dtdc: "dtdc",
  fedex: "fedex-courier",
  "fedex courier": "fedex-courier",
  "ekart logistics courier": "ekart-logistics-courier",
  shadowfax: "shadowfax",
  shiprocket: "shiprocket",
  "blue dart": "blue-dart-courier",
  dhl: "dhl-courier",
  ups: "ups-courier",
  gati: "gati-courier",
  xpressbees: "xpressbees-courier",
  "india post": "india-post",
  aramex: "aramex-courier",
};

export function slugifyCourierName(courierName: string | null | undefined): string {
  const normalized = (courierName || "").trim().toLowerCase();
  if (!normalized) return "blue-dart-courier";

  const alias = COURIER_SLUG_ALIASES[normalized];
  if (alias) return alias;

  if (normalized.startsWith("bluedart") || normalized.startsWith("blue-dart") || normalized.includes("blue dart")) {
    return "blue-dart-courier";
  }
  if (normalized.startsWith("delhivery")) {
    return "delhivery-courier";
  }
  if (normalized.startsWith("fedex")) {
    return "fedex-courier";
  }
  if (normalized.startsWith("ekart")) {
    return "ekart-logistics-courier";
  }

  return normalized
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
