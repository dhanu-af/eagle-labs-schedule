import type { QcSampleStatus, QcSampleType, QcProductCategory } from "@/generated/prisma";

export const SAMPLE_TYPE_LABEL: Record<QcSampleType, string> = {
  FINISHED_PRODUCT: "Finished Product",
  STABILITY: "Stability",
  RETENTION: "Retention",
  INVESTIGATION: "Investigation",
  COMPLAINT: "Complaint",
};

export const PRODUCT_CATEGORY_LABEL: Record<QcProductCategory, string> = {
  CAPSULE: "Capsules",
  GUMMY: "Gummies",
};

export type TestSection = { section: string; items: string[] };

/** Capsules QC Testing checklist -- one row per item, each gets a Pass/Fail result plus a free-text details box. */
export const CAPSULE_TEST_SECTIONS: TestSection[] = [
  {
    section: "Physical Testing",
    items: [
      "Appearance",
      "Colour",
      "Odour",
      "Capsule Size",
      "Average Weight",
      "Weight Variation (20 Capsules)",
      "Fill Weight",
      "Capsule Length",
      "Hardness (if tablet)",
      "Friability (if tablet)",
      "Disintegration",
      "Dissolution (if required)",
      "Moisture Content",
    ],
  },
  {
    section: "Chemical Testing",
    items: [
      "Assay / Active Ingredients",
      "Identification",
      "Uniformity of Dosage Units",
      "Content Uniformity",
      "Impurities",
      "Heavy Metals",
      "Residual Solvents (if applicable)",
    ],
  },
  {
    section: "Microbiology",
    items: ["Total Plate Count (TPC)", "Yeast & Mould", "E. coli", "Salmonella", "Staphylococcus aureus", "Enterobacteriaceae"],
  },
  {
    section: "Packaging",
    items: [
      "Packaging Inspection",
      "Capsule Count Verification",
      "Label Inspection",
      "Seal Integrity",
      "Barcode Verification",
      "Batch Coding",
      "Expiry Date Check",
    ],
  },
  {
    section: "Documentation",
    items: ["COA Upload", "Laboratory Report", "Photographs", "QC Notes"],
  },
];

/** Gummies QC Testing checklist. */
export const GUMMY_TEST_SECTIONS: TestSection[] = [
  {
    section: "Physical Testing",
    items: [
      "Appearance",
      "Colour",
      "Flavour",
      "Odour",
      "Texture",
      "Shape",
      "Weight Check",
      "Weight Variation",
      "Size",
      "Moisture",
      "Water Activity (Aw)",
      "Brix",
      "pH",
      "Stickiness",
      "Hardness",
      "Chewiness",
      "Elasticity",
    ],
  },
  {
    section: "Chemical Testing",
    items: ["Active Ingredients", "Vitamin Assay", "Uniformity", "Heavy Metals", "Preservative Content", "Sugar Content (if applicable)"],
  },
  {
    section: "Microbiology",
    items: ["Total Plate Count", "Yeast & Mould", "E. coli", "Salmonella", "Staphylococcus aureus", "Coliforms", "Enterobacteriaceae"],
  },
  {
    section: "Packaging",
    items: [
      "Pouch Seal Strength",
      "Seal Integrity",
      "Oxygen Absorber Present",
      "Weight Verification",
      "Label Inspection",
      "Batch Coding",
      "Expiry Verification",
      "Metal Detection Verification",
    ],
  },
  {
    section: "Stability",
    items: ["Initial Test", "3 Months", "6 Months", "12 Months", "Retention Sample"],
  },
  {
    section: "Documentation",
    items: ["COA Upload", "Laboratory Report", "Product Photos", "QC Notes"],
  },
];

export const TEST_SECTIONS_BY_CATEGORY: Record<QcProductCategory, TestSection[]> = {
  CAPSULE: CAPSULE_TEST_SECTIONS,
  GUMMY: GUMMY_TEST_SECTIONS,
};

export const SAMPLE_STATUS_LABEL: Record<QcSampleStatus, string> = {
  WAITING_COLLECTION: "Waiting Collection",
  COLLECTED: "Collected",
  WAITING_LAB: "Waiting Lab",
  IN_LABORATORY: "In Laboratory",
  TESTING: "Testing",
  WAITING_RESULTS: "Waiting Results",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  RETENTION: "Retention",
  EXPIRED: "Expired",
  DISPOSED: "Disposed",
};

export type BadgeTone = "primary" | "success" | "warning" | "danger" | "info" | "muted";

export const SAMPLE_STATUS_TONE: Record<QcSampleStatus, BadgeTone> = {
  WAITING_COLLECTION: "muted",
  COLLECTED: "info",
  WAITING_LAB: "warning",
  IN_LABORATORY: "info",
  TESTING: "primary",
  WAITING_RESULTS: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  RETENTION: "primary",
  EXPIRED: "danger",
  DISPOSED: "muted",
};

/** The sample statuses that count as "still open" -- i.e. not yet at a terminal outcome. */
export const OPEN_SAMPLE_STATUSES: QcSampleStatus[] = [
  "WAITING_COLLECTION",
  "COLLECTED",
  "WAITING_LAB",
  "IN_LABORATORY",
  "TESTING",
  "WAITING_RESULTS",
];

/** Statuses in the laboratory phase -- used for the "lab testing overdue" alert. */
export const IN_LAB_STATUSES: QcSampleStatus[] = ["IN_LABORATORY", "TESTING", "WAITING_RESULTS"];

/** Alert thresholds -- simple starting heuristics, tune once there's real usage data. */
export const RETENTION_EXPIRY_WARNING_DAYS = 30;
export const LAB_TESTING_OVERDUE_DAYS = 5;
export const LOW_QUANTITY_THRESHOLD = 10;

/** `QC-2026-000124` -- year of creation + the row's autoincrement `sequence`, padded to 6 digits. Stored at creation so it never changes even if formatting rules do later. */
export function formatSampleId(sequence: number, createdAt: Date = new Date()): string {
  const year = createdAt.getFullYear();
  return `QC-${year}-${String(sequence).padStart(6, "0")}`;
}

/** Days until expiry/destroy (negative = already past). Null when there's no date. */
export function daysUntil(date: Date | string | null): number | null {
  if (!date) return null;
  const ms = new Date(date).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

/** Calendar-accurate years/months/days between two dates (like an age calculation) -- not a
 * fixed-length ÷365/÷30 approximation, so it matches how a human would actually count it. */
function calendarDiffYMD(earlier: Date, later: Date): { years: number; months: number; days: number } {
  let years = later.getFullYear() - earlier.getFullYear();
  let months = later.getMonth() - earlier.getMonth();
  let days = later.getDate() - earlier.getDate();
  if (days < 0) {
    months -= 1;
    days += new Date(later.getFullYear(), later.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months, days };
}

function pluralize(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}

/** "1 year, 2 months, 5 days left" / "Expired 3 days ago" / "—" when there's no date. */
export function timeUntilExpiryLabel(date: Date | string | null): string {
  if (!date) return "—";
  const target = new Date(date);
  const now = new Date();
  const isPast = target.getTime() < now.getTime();
  const { years, months, days } = isPast ? calendarDiffYMD(target, now) : calendarDiffYMD(now, target);

  const parts: string[] = [];
  if (years) parts.push(pluralize(years, "year"));
  if (months) parts.push(pluralize(months, "month"));
  if (days || parts.length === 0) parts.push(pluralize(days, "day"));
  const joined = parts.join(", ");

  return isPast ? `Expired ${joined} ago` : `${joined} left`;
}
