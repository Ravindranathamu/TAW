import { jsPDF } from "jspdf";
import type { Company, Invoice, InvoiceLine, Trip } from "../types";
import { money, shortDate } from "./utils";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** IRD Gazette 2481/22 serial: YYMMM_QQQQ_XXXXX e.g. 26NOV_TAW_00042 */
export function invoiceSerial(company: Company, date = new Date(), sequence = 1): string {
  const yy = String(date.getFullYear()).slice(-2);
  const mmm = MONTHS[date.getMonth()];
  const qqqq = company.registeredName
    .replace(/[^A-Za-z]/g, "")
    .slice(0, 4)
    .toUpperCase()
    .padEnd(4, "T");
  return `${yy}${mmm}_${qqqq}_${String(sequence).padStart(5, "0")}`;
}

export function invoiceLineForTrip(trip: Trip): InvoiceLine[] {
  const lines: InvoiceLine[] = [
    {
      description: `Vehicle Carrier Towing Service – ${trip.customerVehicle.make} ${trip.customerVehicle.model} (${trip.customerVehicle.plate || "N/A"}) from ${trip.route.from} to ${trip.route.to}`,
      quantity: 1,
      unitPrice: trip.price.serviceSubtotal,
      vatApplicable: true,
    },
  ];
  if (trip.price.highwayTolls > 0) {
    lines.push({
      description: `Highway / Expressway Toll (pass-through)${trip.route.returnToll ? " incl. return" : ""}`,
      quantity: 1,
      unitPrice: trip.price.highwayTolls,
      vatApplicable: false,
    });
  }
  return lines;
}

export function buildInvoice(
  company: Company,
  trip: Trip,
  opts: { sequence: number; kind: Invoice["kind"]; customerTin?: string; copyType?: Invoice["copyType"] },
): Invoice {
  const lines = invoiceLineForTrip(trip);
  const vatable = lines.filter((l) => l.vatApplicable).reduce((s, l) => s + l.unitPrice, 0);
  const nonVatable = lines.filter((l) => !l.vatApplicable).reduce((s, l) => s + l.unitPrice, 0);
  const vatAmount = opts.kind === "TAX_INVOICE" ? Math.round(vatable * (company.vatRate / 100)) : 0;
  const total = Math.round(vatable + nonVatable + vatAmount);
  return {
    id: `inv_${trip.id}`,
    tripId: trip.id,
    kind: opts.kind,
    serial: invoiceSerial(company, new Date(), opts.sequence),
    date: new Date().toISOString(),
    supplyDate: trip.completedAt ?? new Date().toISOString(),
    placeOfSupply: `${trip.route.from} → ${trip.route.to}`,
    customerName: trip.customerName,
    customerTin: opts.customerTin ?? "",
    customerAddress: "",
    customerPhone: trip.customerPhone,
    lines,
    subtotal: Math.round(vatable + nonVatable),
    vatAmount,
    total,
    paymentStatus: trip.paymentStatus,
    copyType: opts.copyType ?? "ORIGINAL",
  };
}

export function invoicePdf(company: Company, invoice: Invoice) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  doc.setFillColor(12, 122, 107);
  doc.rect(0, 0, W, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(company.name.toUpperCase(), 14, 12);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`${company.address}  ·  ${company.phone}  ·  TIN ${company.tin}`, 14, 19);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(invoice.kind === "TAX_INVOICE" ? "TAX INVOICE" : "RECEIPT", W - 14, 14, { align: "right" });
  if (invoice.copyType === "DUPLICATE") {
    doc.setFontSize(8);
    doc.text("DUPLICATE COPY", W - 14, 20, { align: "right" });
  }

  doc.setTextColor(20, 30, 34);
  doc.setFontSize(9);
  doc.text(`Serial: ${invoice.serial}`, 14, 38);
  doc.text(`Invoice date: ${shortDate(invoice.date)}`, 14, 44);
  doc.text(`Date of supply: ${shortDate(invoice.supplyDate)}`, 14, 50);
  doc.text(`Place of supply: ${invoice.placeOfSupply}`, 14, 56);
  doc.text(`Customer: ${invoice.customerName}`, 14, 66);
  doc.text(`Tel: ${invoice.customerPhone}   TIN: ${invoice.customerTin || "—"}`, 14, 72);

  let y = 88;
  doc.setFillColor(238, 245, 244);
  doc.rect(14, y - 6, W - 28, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.text("DESCRIPTION", 16, y);
  doc.text("QTY", 150, y, { align: "right" });
  doc.text("AMOUNT (LKR)", W - 16, y, { align: "right" });
  y += 9;

  doc.setFont("helvetica", "normal");
  for (const line of invoice.lines) {
    const words = doc.splitTextToSize(line.description, 118);
    doc.text(words, 16, y);
    doc.text(String(line.quantity), 150, y, { align: "right" });
    doc.text(money(line.unitPrice).replace("LKR ", ""), W - 16, y, { align: "right" });
    y += Math.max(10, words.length * 5 + 4);
  }
  y += 4;
  doc.line(14, y, W - 14, y);
  y += 8;
  doc.text("Value excluding VAT", 150, y, { align: "right" });
  doc.text(money(invoice.subtotal).replace("LKR ", ""), W - 16, y, { align: "right" });
  y += 7;
  doc.text(`VAT ${company.vatRate}%`, 150, y, { align: "right" });
  doc.text(money(invoice.vatAmount).replace("LKR ", ""), W - 16, y, { align: "right" });
  y += 9;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("TOTAL CONSIDERATION", 150, y, { align: "right" });
  doc.text(money(invoice.total).replace("LKR ", ""), W - 16, y, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(110, 120, 125);
  doc.text("Thank you for choosing TAW Vehicle Carrier Services.", W / 2, 282, { align: "center" });
  doc.text("This is a computer-generated document.", W / 2, 288, { align: "center" });
  return doc;
}

export function downloadInvoice(company: Company, invoice: Invoice) {
  invoicePdf(company, invoice).save(`${invoice.serial}_${invoice.copyType}.pdf`);
}

export function whatsappLink(phone: string, text: string) {
  const cleaned = phone.replace(/[^0-9]/g, "");
  const intl = cleaned.startsWith("0") ? `94${cleaned.slice(1)}` : cleaned;
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
}

export function quoteMessage(company: Company, trip: Trip) {
  return [
    `*${company.name} — Towing Quotation*`,
    `Vehicle: ${trip.customerVehicle.make} ${trip.customerVehicle.model} (${trip.customerVehicle.plate || "—"})`,
    `Route: ${trip.route.from} → ${trip.route.to}`,
    `Distance: ${trip.route.distanceKm} km`,
    `Service charge: ${money(trip.price.serviceSubtotal)}`,
    ...(trip.price.highwayTolls ? [`Highway tolls: ${money(trip.price.highwayTolls)}`] : []),
    `*Total: ${money(trip.price.finalQuote)}*`,
    "Valid for 7 days. Confirm to dispatch.",
  ].join("\n");
}
