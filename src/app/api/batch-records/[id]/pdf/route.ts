import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const MARGIN = 36;
const CONTENT_WIDTH = 595.28 - MARGIN * 2;
const FOOTER_ZONE = 26;
const COLOR = {
  text: "#0f172a",
  muted: "#64748b",
  border: "#94a3b8",
  headerBg: "#1e293b",
  headerText: "#ffffff",
  labelBg: "#f1f5f9",
  tableHeaderBg: "#e2e8f0",
  danger: "#b91c1c",
};

const PROCESS_LABEL: Record<number, string> = {
  1: "Dispensing",
  2: "Blending",
  3: "Polishing",
  4: "Coating",
  5: "Rework",
  6: "Cleaning",
  7: "Breakdown",
  8: "Other",
};

const CLEAN_TYPE_LABEL: Record<string, string> = { FULL: "Full", PROVISIONAL: "Provisional" };

/** Every helper below finishes by resetting doc.x to MARGIN -- pdfkit leaves doc.x wherever the last
 * piece of text was drawn, and a subsequent doc.text() call inherits that x with almost no width left
 * before the page edge, wrapping the next heading one character per line down the page. */
function resetCursor(doc: PDFKit.PDFDocument, y: number) {
  doc.x = MARGIN;
  doc.y = y;
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  if (doc.y + needed > doc.page.height - MARGIN - FOOTER_ZONE) {
    doc.addPage({ size: "A4", margin: MARGIN });
    doc.x = MARGIN;
  }
}

function fmtDate(d: Date | null | undefined) {
  return d ? new Date(d).toLocaleDateString("en-AU") : "—";
}

function yesNo(b: boolean) {
  return b ? "Yes" : "No";
}

function newPage(doc: PDFKit.PDFDocument) {
  doc.addPage({ size: "A4", margin: MARGIN });
  doc.x = MARGIN;
  doc.y = MARGIN;
}

/** Document control box shown once at the top of page 1 -- mirrors the real Eagle Labs Inc header
 * table (Written by / Checked & Authorised by / Review date, each with a Sign/Date line). */
function documentControlBox(
  doc: PDFKit.PDFDocument,
  fields: { writtenByName: string | null; writtenSignedDate: Date | null; checkedByName: string | null; checkedSignedDate: Date | null; reviewDate: Date | null }
) {
  const y = doc.y;
  const boxH = 54;
  const colW = CONTENT_WIDTH / 3;

  doc.rect(MARGIN, y, CONTENT_WIDTH, boxH).lineWidth(1).stroke(COLOR.border);
  doc.moveTo(MARGIN + colW, y).lineTo(MARGIN + colW, y + boxH).stroke(COLOR.border);
  doc.moveTo(MARGIN + colW * 2, y).lineTo(MARGIN + colW * 2, y + boxH).stroke(COLOR.border);

  doc.font("Helvetica-Bold").fontSize(11).fillColor(COLOR.text).text("EAGLE LABS INC", MARGIN, y + 4, { width: CONTENT_WIDTH, align: "center" });

  doc.font("Helvetica-Bold").fontSize(7.5).fillColor(COLOR.muted);
  doc.text("Written by:", MARGIN + 8, y + 22, { width: colW - 16, lineBreak: false });
  doc.text("Checked & Authorised by:", MARGIN + colW + 8, y + 22, { width: colW - 16, lineBreak: false });
  doc.text("Review date:", MARGIN + colW * 2 + 8, y + 22, { width: colW - 16, lineBreak: false });

  doc.font("Helvetica").fontSize(8).fillColor(COLOR.text);
  doc.text(fields.writtenByName ?? "—", MARGIN + 8, y + 32, { width: colW - 16, lineBreak: false });
  doc.text(fields.checkedByName ?? "—", MARGIN + colW + 8, y + 32, { width: colW - 16, lineBreak: false });
  doc.text(fmtDate(fields.reviewDate), MARGIN + colW * 2 + 8, y + 32, { width: colW - 16, lineBreak: false });

  doc.font("Helvetica").fontSize(7).fillColor(COLOR.muted);
  doc.text(`Sign/Date: ${fmtDate(fields.writtenSignedDate)}`, MARGIN + 8, y + 44, { width: colW - 16, lineBreak: false });
  doc.text(`Sign/Date: ${fmtDate(fields.checkedSignedDate)}`, MARGIN + colW + 8, y + 44, { width: colW - 16, lineBreak: false });

  resetCursor(doc, y + boxH + 12);
  doc.fillColor(COLOR.text);
}

function docTitle(doc: PDFKit.PDFDocument, title: string) {
  ensureSpace(doc, 30);
  doc.font("Helvetica-Bold").fontSize(16).fillColor(COLOR.text).text(title, MARGIN, doc.y, { width: CONTENT_WIDTH, align: "center" });
  resetCursor(doc, doc.y + 8);
}

/** Small recurring header drawn at the top of every interior page (page 2 onward). */
function runningHeader(doc: PDFKit.PDFDocument) {
  const y = doc.y;
  doc.rect(MARGIN, y, CONTENT_WIDTH, 20).fillAndStroke(COLOR.headerBg, COLOR.headerBg);
  doc.font("Helvetica-Bold").fontSize(9).fillColor(COLOR.headerText).text("BATCH MANUFACTURING RECORD — BLENDING", MARGIN + 8, y + 5, { width: CONTENT_WIDTH - 16 });
  resetCursor(doc, y + 20 + 10);
  doc.fillColor(COLOR.text);
}

function sectionHeader(doc: PDFKit.PDFDocument, text: string) {
  ensureSpace(doc, 30);
  const y = doc.y;
  doc.rect(MARGIN, y, CONTENT_WIDTH, 18).fillAndStroke(COLOR.labelBg, COLOR.border);
  doc.font("Helvetica-Bold").fontSize(9).fillColor(COLOR.text).text(text.toUpperCase(), MARGIN + 8, y + 4, { width: CONTENT_WIDTH - 16 });
  resetCursor(doc, y + 18 + 6);
}

/** A bordered two-column form grid -- label cell (shaded) : value cell. Row height grows to fit
 * whichever side wraps to more lines, so long checklist statements never get clipped by the next
 * row's border. */
function fieldRows(doc: PDFKit.PDFDocument, rows: [string, string][], labelWidth = 260) {
  const valueWidth = CONTENT_WIDTH - labelWidth;
  for (const [label, value] of rows) {
    doc.font("Helvetica-Bold").fontSize(8);
    const labelHeight = doc.heightOfString(label, { width: labelWidth - 12 });
    doc.font("Helvetica").fontSize(8.5);
    const valueHeight = doc.heightOfString(value || "—", { width: valueWidth - 12 });
    const rowHeight = Math.max(16, labelHeight + 8, valueHeight + 8);

    ensureSpace(doc, rowHeight);
    const y = doc.y;
    doc.rect(MARGIN, y, labelWidth, rowHeight).fillAndStroke(COLOR.labelBg, COLOR.border);
    doc.rect(MARGIN + labelWidth, y, valueWidth, rowHeight).lineWidth(0.5).stroke(COLOR.border);
    doc.font("Helvetica-Bold").fontSize(8).fillColor(COLOR.muted).text(label, MARGIN + 6, y + 4, { width: labelWidth - 12 });
    doc.font("Helvetica").fontSize(8.5).fillColor(COLOR.text).text(value || "—", MARGIN + labelWidth + 6, y + 4, { width: valueWidth - 12 });
    resetCursor(doc, y + rowHeight);
  }
  doc.y += 6;
  doc.fillColor(COLOR.text);
}

function paragraph(doc: PDFKit.PDFDocument, text: string, opts: { bold?: boolean; size?: number } = {}) {
  ensureSpace(doc, 14);
  doc.font(opts.bold ? "Helvetica-Bold" : "Helvetica").fontSize(opts.size ?? 8.5).fillColor(COLOR.text).text(text, MARGIN, doc.y, { width: CONTENT_WIDTH });
  resetCursor(doc, doc.y + 4);
}

function bullets(doc: PDFKit.PDFDocument, items: string[], indent = 10) {
  for (const item of items) {
    ensureSpace(doc, 14);
    doc.font("Helvetica").fontSize(8).fillColor(COLOR.text).text(`•  ${item}`, MARGIN + indent, doc.y, { width: CONTENT_WIDTH - indent });
    resetCursor(doc, doc.y + 3);
  }
}

function drawTable(
  doc: PDFKit.PDFDocument,
  columns: { header: string; width: number }[],
  rows: string[][],
  opts: { rowHeight?: number; fontSize?: number } = {}
) {
  const rowHeight = opts.rowHeight ?? 16;
  const fontSize = opts.fontSize ?? 7.5;
  const totalWidth = columns.reduce((s, c) => s + c.width, 0);

  // Header labels can be longer than their column is wide (e.g. "Performed by (Sign/Date)"). Size
  // the header row to whatever the longest wrapped header actually needs, rather than a fixed
  // rowHeight -- otherwise the row divider cuts straight through a wrapped second line of text.
  doc.font("Helvetica-Bold").fontSize(fontSize);
  const headerHeight = Math.max(rowHeight, ...columns.map((c) => doc.heightOfString(c.header, { width: c.width - 6 }) + 8));

  function drawGridRow(y: number, cells: string[], bold: boolean, height: number, bg?: string) {
    if (bg) doc.rect(MARGIN, y, totalWidth, height).fillAndStroke(bg, COLOR.border);
    else doc.rect(MARGIN, y, totalWidth, height).lineWidth(0.5).stroke(COLOR.border);
    let x = MARGIN;
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? fontSize : fontSize - 0.5).fillColor(COLOR.text);
    for (let i = 0; i < columns.length; i++) {
      doc.text(cells[i] ?? "—", x + 3, y + 4, { width: columns[i].width - 6, lineBreak: bold });
      x += columns[i].width;
    }
    x = MARGIN;
    for (const col of columns) {
      doc.moveTo(x, y).lineTo(x, y + height).lineWidth(0.5).strokeColor(COLOR.border).stroke();
      x += col.width;
    }
    doc.moveTo(x, y).lineTo(x, y + height).strokeColor(COLOR.border).stroke();
  }

  ensureSpace(doc, headerHeight + rowHeight);
  let y = doc.y;
  drawGridRow(y, columns.map((c) => c.header), true, headerHeight, COLOR.tableHeaderBg);
  y += headerHeight;

  if (rows.length === 0) {
    doc.rect(MARGIN, y, totalWidth, rowHeight).lineWidth(0.5).stroke(COLOR.border);
    doc.font("Helvetica-Oblique").fontSize(fontSize - 1).fillColor(COLOR.muted).text("No rows recorded.", MARGIN + 4, y + 4, { width: totalWidth - 8 });
    y += rowHeight;
  }

  for (const row of rows) {
    if (y + rowHeight > doc.page.height - MARGIN - FOOTER_ZONE) {
      doc.addPage({ size: "A4", margin: MARGIN });
      y = MARGIN;
      drawGridRow(y, columns.map((c) => c.header), true, headerHeight, COLOR.tableHeaderBg);
      y += headerHeight;
    }
    drawGridRow(y, row, false, rowHeight);
    y += rowHeight;
  }
  resetCursor(doc, y + 10);
  doc.fillColor(COLOR.text);
}

type WorkLogEntry = { date: Date | null; operatorName: string | null; processNumber: number | null; totalHours: number | null };

/** These formulas are my best interpretation of the printed labels on the real Eagle Labs Inc form --
 * its cells were blank (unfilled template), so there's no worked example to match against. Production
 * = Dispensing/Blending/Polishing/Coating only (Rework and Cleaning are broken out as their own lines,
 * matching "Total Personnel Hours (Production + Cleaning + Rework)"). Confirm against a real filled
 * work log before trusting these for a GMP submission. */
function computeWorkLogSummary(entries: WorkLogEntry[]) {
  const withDate = entries.filter((e) => e.date);
  const productionDays = new Set(withDate.map((e) => fmtDate(e.date))).size;
  const operatorsWorked = new Set(entries.filter((e) => e.operatorName).map((e) => e.operatorName)).size;
  const sumHours = (pred: (e: WorkLogEntry) => boolean) => entries.filter(pred).reduce((s, e) => s + (e.totalHours ?? 0), 0);

  const productionHours = sumHours((e) => e.processNumber !== null && [1, 2, 3, 4].includes(e.processNumber));
  const cleaningHours = sumHours((e) => e.processNumber === 6);
  const breakdownHours = sumHours((e) => e.processNumber === 7);
  const reworkHours = sumHours((e) => e.processNumber === 5);
  const personnelHours = productionHours + cleaningHours + reworkHours;
  const operatorHours = productionHours * operatorsWorked;
  const avgHoursPerDay = productionDays > 0 ? personnelHours / productionDays : null;

  return { productionDays, operatorsWorked, productionHours, cleaningHours, breakdownHours, reworkHours, personnelHours, operatorHours, avgHoursPerDay };
}

const HEALTH_SAFETY_INTRO = [
  "Operators are responsible for all quality checks in this document and ensuring that correct batch document practices are followed",
  "ALL personnel are responsible for the quality of ALL products manufactured at Eagle Labs.",
  "All personnel must ensure they have been trained in the applicable procedures before continuing with their issued work order",
  "Report any reactions to chemicals to your supervisor immediately",
  "Raise any concerns to your supervisor or manager",
];

const HEALTH_SAFETY_SECTIONS: { title: string; items: string[] }[] = [
  {
    title: "Personal protective equipment (PPE)",
    items: [
      "Please ensure to wear appropriate PPE as required",
      "Wear safety glasses, gloves, dust masks, ear protection, safety footwear and protective gowning at all times when handling chemicals, raw materials and working on machinery",
    ],
  },
  {
    title: "Plant, machinery and equipment",
    items: [
      "Ensure correct safety and setup checks are followed; maintenance and calibration are up to date and checked; safety switches and guards are in correct working order",
      "Dust or fume extraction arms are in correct positions and working correctly",
      "Take appropriate care and use correct lifting procedures when lifting any materials and equipment",
      "Take care when handling and using any electrical equipment",
      "Ensure gas cylinders are secured and stored correctly and are only operated by authorised personnel",
    ],
  },
  {
    title: "Housekeeping and Hygiene",
    items: ["Ensure all workspaces are clear, tidy and free of obstruction and waste and that gowning and personal hygiene procedures are followed"],
  },
  {
    title: "Emergency management",
    items: ["Ensure access to all fire safety equipment is unobstructed", "Report any emergency to your supervisor and/or Manager immediately"],
  },
  {
    title: "Personal Hygiene and Prohibited Items",
    items: [
      "Ensure no personal items, including jewellery (rings, earrings, necklaces, bracelets, watches), mobile phones, electronic devices (smartwatches, tablets), music devices (earphones, headphones, Bluetooth devices), perfumes, cosmetics, food, drinks, chewing gum, and loose items (coins, keys, non-approved pens), are brought into the production area, and that all personal belongings are stored in designated lockers before entry.",
    ],
  },
];

const DISPENSING_BLENDING_INSTRUCTIONS = [
  "Verify that the blender and all associated equipment are clean, dry, sanitised, and released for use.",
  "Inspect the blender prior to use: ensure rubber seals are clean and in good condition; confirm the bin valve is tightly closed; ensure the bin lid is properly fitted and securely locked.",
  "Ensure all raw materials have been weighed, identified, and approved according to the Batch Manufacturing Record (BMR).",
  "Sieve silica and magnesium stearate as fine as possible before use.",
  "Visually inspect all powders and confirm they are free from lumps or clumps prior to charging into the blender. Sieve if required.",
  "Report any abnormality to the Supervisor and obtain approval before proceeding.",
  "Load all powders (except magnesium stearate) into the blender.",
  "Securely close the blender lid and ensure all guards and safety devices are in place.",
  "Start the blender and set the blending time to 20 minutes.",
  "After starting the blender, ensure all doors are properly closed and exit the room.",
  "After 20 minutes, stop the blender and add the required quantity of magnesium stearate.",
  "Restart the blender and mix for an additional 5 minutes only.",
  "After a total blending time of 25 minutes, stop the blender and inspect the blend for uniformity and powder consistency.",
  "Before discharging the powder: perform blend uniformity testing as required; obtain Supervisor approval before proceeding.",
  "Dispense materials into clean, dry, sanitised, and labelled containers. Record the actual weight as displayed on the scale.",
  "Transfer the blend into clean, sanitised Bulk Product Storage Drums and ensure all internal surfaces and lids are sanitised prior to use.",
  "Collect one (01) representative sample (~50 g) from each blend using a clean white sample bottle and submit it to QA.",
  "Complete all required GMP documentation, including blend times, weights, sampling records, and operator signatures.",
  "Return all excess raw materials to the warehouse and store them in designated locations according to approved storage requirements.",
  "Clean the blender and all associated equipment according to the approved cleaning procedure.",
  "Inspect the area and ensure all equipment, tools, materials, and documentation are returned to their designated locations.",
  "Leave the blending room clean, tidy, and ready for the next production batch.",
];

async function renderBatchRecordPdf(id: string) {
  const batch = await prisma.batchRecord.findUnique({
    where: { id },
    include: {
      workLogEntries: { orderBy: { rowNumber: "asc" } },
      operators: { orderBy: { rowNumber: "asc" } },
      equipment: { orderBy: { rowNumber: "asc" } },
      lineClearance: true,
      mixes: { orderBy: { mixNumber: "asc" }, include: { dispensingLines: { orderBy: { order: "asc" } }, drums: true } },
      warehouseReturns: { orderBy: { order: "asc" } },
      materialRequests: { orderBy: { order: "asc" } },
    },
  });
  if (!batch) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const doc = new PDFDocument({ size: "A4", margin: MARGIN, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  // ---- Page 1: document control header + Work Log ----
  documentControlBox(doc, batch);
  docTitle(doc, "WORK LOG");
  paragraph(doc, `Product Name: ${batch.productName}    Batch Number: ${batch.batchNumber}`, { bold: true });
  doc.y += 4;

  drawTable(
    doc,
    [
      { header: "#", width: 20 },
      { header: "Date", width: 55 },
      { header: "Operator Name", width: 105 },
      { header: "Process #*", width: 45 },
      { header: "Start Time", width: 50 },
      { header: "Finish Time", width: 50 },
      { header: "Break (min)", width: 50 },
      { header: "Total Prod. Hours", width: 60 },
      { header: "Sign", width: 88 },
    ],
    batch.workLogEntries.map((w, i) => [
      String(i + 1),
      fmtDate(w.date),
      w.operatorName ?? "—",
      w.processNumber ? `${w.processNumber} ${PROCESS_LABEL[w.processNumber] ?? ""}`.trim() : "—",
      w.startTime ?? "—",
      w.finishTime ?? "—",
      w.breakMinutes?.toString() ?? "—",
      w.totalHours?.toString() ?? "—",
      w.sign ?? "—",
    ])
  );

  drawTable(
    doc,
    [
      { header: "1", width: 20 },
      { header: "Dispensing", width: 111 },
      { header: "2", width: 20 },
      { header: "Blending", width: 111 },
      { header: "3", width: 20 },
      { header: "Polishing", width: 110 },
      { header: "4", width: 20 },
      { header: "Coating", width: 111 },
    ],
    [
      ["5", "Rework", "6", "Cleaning", "7", "Breakdown", "8", "Other"],
    ],
    { rowHeight: 14, fontSize: 7 }
  );
  paragraph(doc, "* Production Process — see legend above.", { size: 7 });

  // ---- Page 2: Notes + Work Log Summary ----
  newPage(doc);
  runningHeader(doc);
  sectionHeader(doc, "Notes");
  ensureSpace(doc, 60);
  const notesY = doc.y;
  doc.rect(MARGIN, notesY, CONTENT_WIDTH, 60).lineWidth(0.5).stroke(COLOR.border);
  doc.font("Helvetica").fontSize(8.5).fillColor(COLOR.text).text(batch.notes || "—", MARGIN + 6, notesY + 6, { width: CONTENT_WIDTH - 12, height: 48 });
  resetCursor(doc, notesY + 60 + 10);

  sectionHeader(doc, "Work Log Summary");
  const summary = computeWorkLogSummary(batch.workLogEntries);
  fieldRows(doc, [
    ["Number of Production Days", String(summary.productionDays)],
    ["Number of Operators Worked", String(summary.operatorsWorked)],
    ["Total Production Hours", summary.productionHours.toFixed(2)],
    ["Total Cleaning Hours", summary.cleaningHours.toFixed(2)],
    ["Total Breakdown Hours", summary.breakdownHours.toFixed(2)],
    ["Total Rework Hours", summary.reworkHours.toFixed(2)],
    ["Total Personnel Hours (Production + Cleaning + Rework)", summary.personnelHours.toFixed(2)],
    ["Total Operator Hours (Hours × No. of Operators)", summary.operatorHours.toFixed(2)],
    ["Average Hours per Day", summary.avgHoursPerDay !== null ? summary.avgHoursPerDay.toFixed(2) : "—"],
  ]);

  // ---- Page 3: Health and Safety Guidelines ----
  newPage(doc);
  runningHeader(doc);
  sectionHeader(doc, "Health and Safety Guidelines");
  paragraph(doc, "SAFETY & NOTES", { bold: true, size: 9 });
  bullets(doc, HEALTH_SAFETY_INTRO);
  doc.y += 4;
  paragraph(
    doc,
    "All staff have a responsibility and the authority to ensure that a safe work environment exists and that all current Occupational Health and Safety Regulations are followed. Ensure the below basic reminders are followed:"
  );
  for (const section of HEALTH_SAFETY_SECTIONS) {
    doc.y += 2;
    paragraph(doc, section.title, { bold: true, size: 8.5 });
    bullets(doc, section.items);
  }

  // ---- Page 4: Operators' Declaration + Equipment Record ----
  newPage(doc);
  runningHeader(doc);
  sectionHeader(doc, "Operators' Declaration");
  paragraph(
    doc,
    "I read and understood the Health and Safety Guidelines. I have read and understood the associated with the required manufacturing processes. I have been trained in these operations."
  );
  doc.y += 4;
  drawTable(
    doc,
    [
      { header: "Manufacturing / Processing Step", width: 350 },
      { header: "Confirmed", width: 173 },
    ],
    [
      ["Encapsulation", batch.declEncapsulation ? "✓" : ""],
      ["Blending/Mixing", batch.declBlendingMixing ? "✓" : ""],
      ["Dispensing", batch.declDispensing ? "✓" : ""],
      ["Polishing", batch.declPolishing ? "✓" : ""],
      ["Coating", batch.declCoating ? "✓" : ""],
    ]
  );

  paragraph(doc, "Operator(s)", { bold: true, size: 9 });
  drawTable(
    doc,
    [
      { header: "#", width: 20 },
      { header: "Name", width: 170 },
      { header: "Signature", width: 170 },
      { header: "Date", width: 163 },
    ],
    batch.operators.map((o, i) => [String(i + 1), o.name ?? "—", o.signature ?? "—", fmtDate(o.date)])
  );

  sectionHeader(doc, "Equipment Record — Completed by Operator(s)");
  paragraph(doc, "Record ALL equipment, auxiliaries, scales used to carry out the required operations, including testing equipment.", { size: 7.5 });
  drawTable(
    doc,
    [
      { header: "EQ No.", width: 45 },
      { header: "Item Name", width: 160 },
      { header: "Yes", width: 35 },
      { header: "No", width: 35 },
      { header: "N/A", width: 35 },
      { header: "Notes", width: 213 },
    ],
    batch.equipment.map((e) => [
      e.eqNumber ?? "—",
      e.itemName ?? "—",
      e.calibrationUpdated === "YES" ? "✓" : "",
      e.calibrationUpdated === "NO" ? "✓" : "",
      e.calibrationUpdated === "N/A" ? "✓" : "",
      e.notes ?? "—",
    ])
  );

  // ---- Page 5: Line Clearance Checklist ----
  newPage(doc);
  runningHeader(doc);
  sectionHeader(doc, "Line Clearance Checklist");
  paragraph(doc, "Must be carried out and completed for every room to be used within a day of the start of the batch.", { size: 7.5 });
  const lc = batch.lineClearance;
  fieldRows(doc, [
    ["Room No.", lc?.roomNumber ?? "—"],
    ["1. Type of ROOM clean", lc?.roomCleanType ? CLEAN_TYPE_LABEL[lc.roomCleanType] ?? lc.roomCleanType : "—"],
    ["4. Type of EQUIPMENT clean", lc?.equipmentCleanType ? CLEAN_TYPE_LABEL[lc.equipmentCleanType] ?? lc.equipmentCleanType : "—"],
  ]);
  paragraph(doc, "2. The room is clean, including all surfaces, floors, walls, doors, filters, grilles, bins.", { size: 7.5 });
  paragraph(doc, "3. The type of room & equipment clean is correct and is within cleaning validity period.", { size: 7.5 });
  doc.y += 4;
  paragraph(doc, "I hereby certify that I have completed all checks mentioned above.", { size: 7.5 });
  fieldRows(doc, [
    ["Performed by (Sign) / Date / Time", `${lc?.performedBySign ?? "—"}  /  ${fmtDate(lc?.performedByDate)}  /  ${lc?.performedByTime ?? "—"}`],
  ]);
  paragraph(doc, "Verification — Completed by Blending supervisor. I verify that the line is clear and hereby approve the line as ready for production.", { size: 7.5 });
  fieldRows(doc, [
    ["Performed by (Sign) / Date / Time", `${lc?.verifiedBySign ?? "—"}  /  ${fmtDate(lc?.verifiedByDate)}  /  ${lc?.verifiedByTime ?? "—"}`],
  ]);

  sectionHeader(doc, "Environmental Conditions Checks");
  paragraph(doc, "Probiotic Product/Materials — ROOM RH is NMT 35%RH and Temperature is NMT 25°C before starting.", { size: 7.5 });
  fieldRows(doc, [
    ["Probiotic Product/Materials", yesNo(lc?.probioticProduct ?? false)],
    ["Room %RH / Time", `${lc?.roomRhPercent ?? "—"}%  /  ${lc?.roomRhTime ?? "—"}`],
    ["Room Temperature / Time", `${lc?.roomTemperature ?? "—"}°C  /  ${lc?.roomTempTime ?? "—"}`],
    ["Room Use Approval — Completed by Blending Supervisor (Sign / Date)", `${lc?.roomUseApprovalSign ?? "—"}  /  ${fmtDate(lc?.roomUseApprovalDate)}`],
  ]);

  sectionHeader(doc, "Material Checks — Checked by Operator");
  fieldRows(doc, [
    ["All materials on the pallet are identified for the correct Product Code and Batch No./Work Order No.", yesNo(lc?.materialsIdentifiedChecked ?? false)],
    ["All materials received and brought to room have been tagged with PASS labels by Warehouse.", yesNo(lc?.materialsPassLabelledChecked ?? false)],
  ]);

  // ---- Page 6: Dispensing & Blending Instructions ----
  newPage(doc);
  runningHeader(doc);
  sectionHeader(doc, "Dispensing & Blending Instructions");
  bullets(doc, DISPENSING_BLENDING_INSTRUCTIONS);

  // ---- Per-mix pages ----
  for (const mix of batch.mixes) {
    newPage(doc);
    runningHeader(doc);
    fieldRows(doc, [["Mix No.", `${String(mix.mixNumber).padStart(2, "0")} of ${String(batch.numberOfMixes).padStart(2, "0")}`]], 150);
    paragraph(
      doc,
      "Check each UIN is correct as per BOM. Weigh and dispense the following materials. After weighing, ask the Supervisor to independently verify the identity and amount of each material.",
      { size: 7.5 }
    );

    const totalReq = mix.dispensingLines.reduce((s, l) => s + l.requiredQtyKg, 0);
    drawTable(
      doc,
      [
        { header: "No.", width: 18 },
        { header: "RM", width: 28 },
        { header: "AAN", width: 130 },
        { header: "UIN", width: 45 },
        { header: "Amt Req. kg/mix", width: 60 },
        { header: "Actual kg", width: 65 },
        { header: "Performed by (Sign/Date)", width: 90 },
        { header: "Verified by (Sign/Date)", width: 87 },
      ],
      mix.dispensingLines.map((l, i) => [
        String(i + 1),
        l.rmNumber ?? "RM",
        l.ingredientName,
        l.uin ?? "—",
        l.requiredQtyKg.toFixed(3),
        l.actualQtyDispensedKg?.toFixed(3) ?? "—",
        l.performedBySign ? `${l.performedBySign} / ${fmtDate(l.performedByDate)}` : "—",
        l.verifiedBySign ? `${l.verifiedBySign} / ${fmtDate(l.verifiedByDate)}` : "—",
      ])
    );
    fieldRows(doc, [["TOTAL WEIGHT, Kg (A)", totalReq.toFixed(3)]], 200);

    fieldRows(doc, [
      ["Record Date/Time Dispensing Started (Operator)", `${fmtDate(mix.dispensingStartDate)}  /  ${mix.dispensingStartTime ?? "—"}  /  ${mix.dispensingStartSign ?? "—"}`],
      ["Record Date/Time Dispensing Completed (Operator)", `${fmtDate(mix.dispensingEndDate)}  /  ${mix.dispensingEndTime ?? "—"}  /  ${mix.dispensingEndSign ?? "—"}`],
      ["Record Date/Time Blending Started (Operator)", `${fmtDate(mix.blendingStartDate)}  /  ${mix.blendingStartTime ?? "—"}  /  ${mix.blendingStartSign ?? "—"}`],
      ["Record Date/Time Blending Completed (Operator)", `${fmtDate(mix.blendingEndDate)}  /  ${mix.blendingEndTime ?? "—"}  /  ${mix.blendingEndSign ?? "—"}`],
    ]);

    sectionHeader(doc, "Blend Identification — Completed by Operator");
    const totalDrumWeight = mix.drums.reduce((s, d) => s + (d.netWeightKg ?? 0), 0);
    drawTable(
      doc,
      [
        { header: "Drum No.", width: 120 },
        { header: "Net Weight per Drum, Kg", width: 150 },
        { header: "Pass Labels Attached", width: 253 },
      ],
      mix.drums.map((d) => [d.drumNumber ?? "—", d.netWeightKg?.toFixed(2) ?? "—", yesNo(d.passLabelAttached)])
    );
    fieldRows(doc, [["Total Kg (B)", totalDrumWeight.toFixed(2)]], 200);

    const A = mix.dispensingLines.reduce((s, l) => s + (l.actualQtyDispensedKg ?? l.requiredQtyKg), 0);
    const yieldPct = A > 0 && totalDrumWeight > 0 ? (totalDrumWeight / A) * 100 : null;
    const bulkDensity = mix.bulkSampleWeightG && mix.bulkVolumeMl ? mix.bulkSampleWeightG / mix.bulkVolumeMl : null;
    const tappedDensity = mix.bulkSampleWeightG && mix.tappedVolumeMl ? mix.bulkSampleWeightG / mix.tappedVolumeMl : null;

    sectionHeader(doc, "Mix Reconciliation");
    fieldRows(doc, [
      ["Total ACTUAL Weight of raw materials dispensed (A), Kg", A.toFixed(2)],
      ["Total Net Weight of Mix in Drums Produced after Blending (B), Kg", totalDrumWeight.toFixed(2)],
      ["Total Net Weight of Mix as Samples, Rejects, Spills (D), Kg", mix.samplesRejectsSpillsKg?.toFixed(2) ?? "—"],
      ["Mix Yield [ (B) ÷ (A) ] × 100 (R1), %", yieldPct !== null ? yieldPct.toFixed(2) : "—"],
      ["Reconciliation and Yield Limits", "99-101%"],
    ]);
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(COLOR.danger).text("NOTE: If results are OOS, notify the Supervisor immediately.", MARGIN, doc.y);
    resetCursor(doc, doc.y + 12);
    doc.fillColor(COLOR.text);

    drawTable(
      doc,
      [
        { header: "Weight of sample, g (M)", width: 105 },
        { header: "Bulk Volume, ml (V1)", width: 105 },
        { header: "Tapped Volume, ml (V2)", width: 105 },
        { header: "Bulk Density, g/ml", width: 104 },
        { header: "Tapped Density, g/ml", width: 104 },
      ],
      [
        [
          mix.bulkSampleWeightG?.toString() ?? "—",
          mix.bulkVolumeMl?.toString() ?? "—",
          mix.tappedVolumeMl?.toString() ?? "—",
          bulkDensity !== null ? bulkDensity.toFixed(3) : "—",
          tappedDensity !== null ? tappedDensity.toFixed(3) : "—",
        ],
      ]
    );

    fieldRows(doc, [
      ["Mixing/Blending Completed (Operator) — Date / Time / Sign", `${fmtDate(mix.mixCompletedDate)}  /  ${mix.mixCompletedTime ?? "—"}  /  ${mix.mixCompletedSign ?? "—"}`],
      ["Verified by (Supervisor) — Date / Time / Sign", `${fmtDate(mix.verifiedByDate)}  /  ${mix.verifiedByTime ?? "—"}  /  ${mix.verifiedBySign ?? "—"}`],
    ]);
  }

  // ---- Warehouse Return ----
  newPage(doc);
  runningHeader(doc);
  sectionHeader(doc, "Warehouse Return");
  const totalKgPerBatch = batch.warehouseReturns.reduce((s, w) => s + (w.kgPerBatch ?? 0), 0);
  drawTable(
    doc,
    [
      { header: "RM / AAN", width: 150 },
      { header: "kg/batch", width: 55 },
      { header: "UIN(s)", width: 60 },
      { header: "Qty Used", width: 60 },
      { header: "Actual Qty Returned", width: 80 },
      { header: "Operator Sign", width: 60 },
      { header: "Date", width: 58 },
    ],
    batch.warehouseReturns.map((w) => [
      w.ingredientName,
      w.kgPerBatch?.toFixed(3) ?? "—",
      w.uin ?? "—",
      w.qtyUsedKg?.toFixed(2) ?? "—",
      w.actualQtyReturnedKg?.toFixed(2) ?? "—",
      w.operatorSign ?? "—",
      fmtDate(w.operatorDate),
    ])
  );
  fieldRows(doc, [["TOTAL WEIGHT", totalKgPerBatch.toFixed(2)]], 200);

  // ---- Raw Materials Request Document ----
  newPage(doc);
  runningHeader(doc);
  docTitle(doc, "RAW MATERIALS REQUEST DOCUMENT");
  const totalBatchSize = batch.numberOfMixes * batch.batchSizePerMix;
  fieldRows(doc, [
    ["Product Name", batch.productName],
    ["Batch No.", batch.batchNumber],
    ["No. of Mixes", String(batch.numberOfMixes)],
    ["Batch Size per Mix", `${batch.batchSizePerMix.toFixed(2)} ${batch.batchSizeUnit}`],
    ["Total Batch Size", `${totalBatchSize.toFixed(2)} ${batch.batchSizeUnit}`],
  ]);

  const totalReleased = batch.materialRequests.reduce((s, m) => s + (m.kgPerBatch ?? 0), 0);
  drawTable(
    doc,
    [
      { header: "RM / AAN", width: 150 },
      { header: "kg/batch", width: 55 },
      { header: "UIN(s)", width: 60 },
      { header: "Qty Released", width: 60 },
      { header: "Actual Qty Received", width: 80 },
      { header: "Operator Sign", width: 60 },
      { header: "Date", width: 58 },
    ],
    batch.materialRequests.map((m) => [
      m.ingredientName,
      m.kgPerBatch?.toFixed(3) ?? "—",
      m.uin ?? "—",
      m.qtyReleasedKg?.toFixed(2) ?? "—",
      m.actualQtyReceivedKg?.toFixed(2) ?? "—",
      m.operatorSign ?? "—",
      fmtDate(m.operatorDate),
    ])
  );
  fieldRows(doc, [["TOTAL WEIGHT", totalReleased.toFixed(2)]], 200);

  fieldRows(doc, [
    ["Released By (Warehouse) / Date", `${batch.releasedByWarehouse ?? "—"}  /  ${fmtDate(batch.releasedDate)}`],
    ["Checked By", batch.requestCheckedBy ?? "—"],
    ["AILS No. / Pallet No.", `${batch.ailsNumber ?? "—"}  /  ${batch.palletNumber ?? "—"}`],
  ]);

  // Footer (page N of M) on every buffered page -- the footer sits inside the page's bottom margin
  // zone, and pdfkit auto-paginates any doc.text() call that would land there; zeroing the bottom
  // margin for this page just before drawing stops it from silently inserting a blank page each time.
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0;
    const footerY = doc.page.height - 30;
    doc.font("Helvetica").fontSize(7).fillColor(COLOR.muted);
    doc.text(`${batch.productName} — Batch ${batch.batchNumber} — GMP Controlled Document — Confidential`, MARGIN, footerY, { width: 340, lineBreak: false });
    doc.text(`Page ${i - range.start + 1} of ${range.count}`, doc.page.width - MARGIN - 150, footerY, { width: 150, align: "right", lineBreak: false });
  }

  doc.end();
  const buffer = await done;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${batch.productName.replace(/[^a-z0-9]/gi, "_")}_${batch.batchNumber}_BMR.pdf"`,
    },
  });
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const { id } = await params;
  return renderBatchRecordPdf(id);
}
