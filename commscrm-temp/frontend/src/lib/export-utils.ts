import { utils, writeFile } from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface ExportSheet {
  name: string;
  headers: string[];
  rows: (string | number | null)[][];
}

export function exportToExcel(filename: string, sheets: ExportSheet[]): void {
  const wb = utils.book_new();
  for (const sheet of sheets) {
    const ws = utils.aoa_to_sheet([sheet.headers, ...sheet.rows.map((r) => r.map((c) => c ?? ""))]);
    const colWidths = sheet.headers.map((h, i) => ({
      wch: Math.max(h.length, ...sheet.rows.map((r) => String(r[i] ?? "").length)) + 2,
    }));
    ws["!cols"] = colWidths;
    utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
  }
  writeFile(wb, `${filename}.xlsx`);
}

export function exportToPdf(filename: string, title: string, sheets: ExportSheet[]): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFontSize(18);
  doc.setTextColor(40, 40, 40);
  doc.text(title, 14, 18);

  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(`Generated: ${new Date().toLocaleString()}  |  CommsCRM`, 14, 26);

  let startY = 34;

  sheets.forEach((sheet, idx) => {
    if (sheets.length > 1) {
      doc.setFontSize(11);
      doc.setTextColor(60, 60, 60);
      doc.text(sheet.name, 14, startY);
      startY += 5;
    }

    autoTable(doc, {
      head: [sheet.headers],
      body: sheet.rows.map((r) => r.map((c) => (c === null || c === undefined ? "—" : String(c)))),
      startY,
      margin: { left: 14, right: 14 },
      styles: { fontSize: 8.5, cellPadding: 3 },
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      tableLineColor: [220, 220, 220],
      tableLineWidth: 0.1,
    });

    startY = (doc as any).lastAutoTable.finalY + 12;

    if (idx < sheets.length - 1 && startY > 170) {
      doc.addPage();
      startY = 16;
    }
  });

  doc.save(`${filename}.pdf`);
}
