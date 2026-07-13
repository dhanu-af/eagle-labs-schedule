import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const type = request.nextUrl.searchParams.get("type");
  const workbook = new ExcelJS.Workbook();

  if (type === "supervisor") {
    const rows = await prisma.supervisorPreOpCheck.findMany({ orderBy: { date: "desc" } });
    const sheet = workbook.addWorksheet("Supervisor Pre-Op Checks");
    sheet.columns = [
      { header: "Date", key: "date", width: 12 },
      { header: "Room", key: "room", width: 20 },
      { header: "Room Cleanliness", key: "roomCleanliness", width: 16 },
      { header: "Equipment Readiness", key: "equipmentReadiness", width: 18 },
      { header: "Safety/PPE", key: "safetyPpeVerified", width: 12 },
      { header: "Calibration Status", key: "calibrationStatus", width: 20 },
      { header: "Comments", key: "comments", width: 30 },
      { header: "Submitted By", key: "submittedByName", width: 18 },
      { header: "Designation", key: "submittedByRole", width: 14 },
      { header: "Signed At", key: "submittedAt", width: 20 },
      { header: "Signature", key: "signature", width: 18 },
      { header: "Status", key: "status", width: 12 },
    ];
    sheet.getRow(1).font = { bold: true };
    for (const r of rows) {
      sheet.addRow({ ...r, date: r.date.toISOString().slice(0, 10), submittedAt: r.submittedAt.toLocaleString("en-AU") });
    }
  } else if (type === "qa") {
    const rows = await prisma.qaPreOpCheck.findMany({ orderBy: { date: "desc" } });
    const sheet = workbook.addWorksheet("QA Pre-Op Checks");
    sheet.columns = [
      { header: "Date", key: "date", width: 12 },
      { header: "Room", key: "room", width: 20 },
      { header: "QA Room Inspection", key: "qaRoomInspection", width: 18 },
      { header: "Equipment Verification", key: "equipmentVerification", width: 20 },
      { header: "GMP Compliance", key: "gmpCompliance", width: 16 },
      { header: "Environmental Condition", key: "environmentalCondition", width: 20 },
      { header: "Comments", key: "comments", width: 30 },
      { header: "Submitted By", key: "submittedByName", width: 18 },
      { header: "Designation", key: "submittedByRole", width: 14 },
      { header: "Signed At", key: "submittedAt", width: 20 },
      { header: "Status", key: "status", width: 12 },
    ];
    sheet.getRow(1).font = { bold: true };
    for (const r of rows) {
      sheet.addRow({ ...r, date: r.date.toISOString().slice(0, 10), submittedAt: r.submittedAt.toLocaleString("en-AU") });
    }
  } else if (type === "environmental") {
    const rows = await prisma.environmentalCheck.findMany({ orderBy: { date: "desc" } });
    const sheet = workbook.addWorksheet("RH & Temperature Checks");
    sheet.columns = [
      { header: "Date", key: "date", width: 12 },
      { header: "Area", key: "area", width: 16 },
      { header: "Temp °C", key: "temperature", width: 10 },
      { header: "RH %", key: "humidity", width: 10 },
      { header: "Result", key: "result", width: 10 },
      { header: "Remarks", key: "remarks", width: 24 },
      { header: "Submitted By", key: "submittedByName", width: 18 },
      { header: "Supervisor Approved By", key: "supervisorApprovedByName", width: 20 },
      { header: "QA Approved By", key: "qaApprovedByName", width: 18 },
      { header: "Status", key: "status", width: 12 },
    ];
    sheet.getRow(1).font = { bold: true };
    for (const r of rows) {
      sheet.addRow({
        ...r,
        date: r.date.toISOString().slice(0, 10),
        result: r.passFail ? "Pass" : "OOS",
      });
    }
  } else if (type === "clearance") {
    const rows = await prisma.lineClearance.findMany({ orderBy: { date: "desc" } });
    const sheet = workbook.addWorksheet("Line Clearance");
    sheet.columns = [
      { header: "Date", key: "date", width: 12 },
      { header: "Line", key: "line", width: 20 },
      { header: "Prev Batch Cleared", key: "previousBatchCleared", width: 16 },
      { header: "Material Cleared", key: "materialCleared", width: 16 },
      { header: "Label/Pkg Cleared", key: "labelPackagingCleared", width: 16 },
      { header: "Equipment Cleared", key: "equipmentCleared", width: 16 },
      { header: "Docs Verified", key: "documentationVerified", width: 14 },
      { header: "Comments", key: "comments", width: 30 },
      { header: "Submitted By", key: "submittedByName", width: 18 },
      { header: "Supervisor Approved By", key: "supervisorApprovedByName", width: 20 },
      { header: "QA Approved By", key: "qaApprovedByName", width: 18 },
      { header: "Status", key: "status", width: 12 },
    ];
    sheet.getRow(1).font = { bold: true };
    for (const r of rows) {
      sheet.addRow({ ...r, date: r.date.toISOString().slice(0, 10) });
    }
  } else if (type === "postop") {
    const rows = await prisma.postOpCheck.findMany({ orderBy: { date: "desc" } });
    const sheet = workbook.addWorksheet("Post-Op Checks");
    sheet.columns = [
      { header: "Date", key: "date", width: 12 },
      { header: "Item", key: "item", width: 20 },
      { header: "Cleaning Type", key: "cleaningType", width: 18 },
      { header: "Verification Status", key: "cleaningVerificationStatus", width: 22 },
      { header: "Comments", key: "comments", width: 30 },
      { header: "Submitted By", key: "submittedByName", width: 18 },
      { header: "Verified By", key: "verifiedByName", width: 18 },
      { header: "Status", key: "status", width: 12 },
    ];
    sheet.getRow(1).font = { bold: true };
    for (const r of rows) {
      sheet.addRow({ ...r, date: r.date.toISOString().slice(0, 10) });
    }
  } else if (type === "worklog") {
    const rows = await prisma.workLog.findMany({ orderBy: { startDate: "desc" } });
    const sheet = workbook.addWorksheet("Work Log");
    sheet.columns = [
      { header: "Room", key: "room", width: 20 },
      { header: "OP Name", key: "opName", width: 18 },
      { header: "Start Date", key: "startDate", width: 12 },
      { header: "Start Time", key: "startTime", width: 12 },
      { header: "Product Name", key: "productName", width: 20 },
      { header: "Product Code", key: "productCode", width: 16 },
      { header: "Batch Number", key: "batchNumber", width: 16 },
      { header: "Activity", key: "activity", width: 20 },
      { header: "End Date", key: "endDate", width: 12 },
      { header: "End Time", key: "endTime", width: 12 },
      { header: "OP Name (Closing)", key: "closingOpName", width: 18 },
      { header: "Sign", key: "signature", width: 18 },
      { header: "Supervisor Approved By", key: "supervisorApprovedByName", width: 20 },
      { header: "Comments", key: "comments", width: 30 },
      { header: "Status", key: "status", width: 12 },
    ];
    sheet.getRow(1).font = { bold: true };
    for (const r of rows) {
      sheet.addRow({
        ...r,
        startDate: r.startDate.toISOString().slice(0, 10),
        endDate: r.endDate ? r.endDate.toISOString().slice(0, 10) : "",
      });
    }
  } else {
    return NextResponse.json({ error: "Unknown export type" }, { status: 400 });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="checks-${type}.xlsx"`,
    },
  });
}
