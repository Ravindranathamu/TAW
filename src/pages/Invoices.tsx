import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Download, FileText, Plus, Send } from "lucide-react";
import { useTaw } from "../state/TawStore";
import { Badge, Card, EmptyState, Field, Modal, PageHead, StatCard } from "../components/ui";
import { copyToClipboard, money, shortDate } from "../lib/utils";
import { downloadInvoice, whatsappLink } from "../lib/invoice";

export function InvoicesPage() {
  const { state, issueInvoice, saveInvoice, notify } = useTaw();
  const [open, setOpen] = useState(false);
  const [tripId, setTripId] = useState("");
  const [tin, setTin] = useState("");
  const [kind, setKind] = useState<"RECEIPT" | "TAX_INVOICE">("TAX_INVOICE");
  const invoices = useMemo(() => [...state.invoices].sort((a, b) => b.date.localeCompare(a.date)), [state.invoices]);
  const completed = state.trips.filter((t) => t.status === "COMPLETED" && !state.invoices.some((i) => i.tripId === t.id));
  const vat = invoices.reduce((s, i) => s + i.vatAmount, 0);
  const outstanding = invoices.filter((i) => i.paymentStatus === "UNPAID" || i.paymentStatus === "PENDING_CORPORATE").reduce((s, i) => s + i.total, 0);

  function issue() {
    const invoice = issueInvoice(tripId, kind, tin, state.invoices.length + 1);
    if (!invoice) return;
    downloadInvoice(state.company, invoice);
    setOpen(false);
    setTripId("");
    setTin("");
  }

  return (
    <>
      <PageHead title="Invoices" subtitle="IRD Gazette serials, VAT 18%, duplicates and delivery" action={<button className="btn btn-brand btn-sm" onClick={() => setOpen(true)}><Plus size={14} /> Issue invoice</button>} />
      <div className="grid grid-2">
        <StatCard label="VAT collected" value={money(vat)} foot={`${state.company.vatRate}% on service charges`} icon={<FileText size={16} />} />
        <StatCard label="Outstanding" value={money(outstanding)} foot="Unpaid / corporate pending" icon={<FileText size={16} />} tone={outstanding ? "amber" : "teal"} />
      </div>
      <Card title="Invoice register" padded={false}>
        {invoices.length === 0 ? <EmptyState message="No invoices issued yet." /> : (
          <div style={{ padding: "4px 14px 12px" }}>
            {invoices.map((inv) => (
              <div key={inv.id} style={{ padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div>
                    <div className="mono" style={{ fontWeight: 700, fontSize: 12 }}>{inv.serial}</div>
                    <div className="cell-sub">{inv.customerName} · {shortDate(inv.date)} · {inv.kind.replace("_", " ")}</div>
                  </div>
                  <strong style={{ fontSize: 13 }}>{money(inv.total)}</strong>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  <Badge tone={inv.paymentStatus === "UNPAID" || inv.paymentStatus === "PENDING_CORPORATE" ? "warn" : "ok"}>{inv.paymentStatus.replace(/_/g, " ")}</Badge>
                  <Badge tone={inv.copyType === "ORIGINAL" ? "info" : "neutral"}>{inv.copyType}</Badge>
                  <select className="select" style={{ width: 150, minHeight: 34, fontSize: 11 }} value={inv.paymentStatus} onChange={(e) => saveInvoice({ ...inv, paymentStatus: e.target.value as typeof inv.paymentStatus })}>
                    <option value="UNPAID">Unpaid</option><option value="PENDING_CORPORATE">Pending corporate</option><option value="PAID_CASH">Paid cash</option><option value="PAID_BANK">Paid bank</option>
                  </select>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => downloadInvoice(state.company, inv)}><Download size={12} /> PDF</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => { void copyToClipboard(inv.serial); notify({ tone: "ok", text: "Serial copied." }); }}><Copy size={12} /> Serial</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => {
                    const dupe = { ...inv, id: `${inv.id}_dup_${Date.now()}`, copyType: "DUPLICATE" as const };
                    downloadInvoice(state.company, dupe);
                  }}><FileText size={12} /> Duplicate</button>
                  <a className="btn btn-ghost btn-sm" target="_blank" rel="noreferrer" href={whatsappLink(inv.customerPhone, `${state.company.name} invoice ${inv.serial} — ${money(inv.total)}. Thank you.`)}><Send size={12} /> WhatsApp</a>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      {open && (
        <Modal title="Issue an invoice" subtitle="Select a completed trip" onClose={() => setOpen(false)} footer={<><button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button><button className="btn btn-brand" disabled={!tripId} onClick={issue}><Download size={14} /> Issue &amp; download</button></>}>
          <div className="form-grid">
            <Field label="Trip" full>
              <select className="select" value={tripId} onChange={(e) => setTripId(e.target.value)}>
                <option value="">Select a completed trip…</option>
                {completed.map((t) => <option key={t.id} value={t.id}>{t.code} · {t.customerName} · {money(t.price.finalQuote)}</option>)}
                {state.trips.filter((t) => t.status === "COMPLETED").map((t) => <option key={`existing-${t.id}`} value={t.id}>{t.code} · {t.customerName} · reissue</option>)}
              </select>
            </Field>
            <Field label="Type"><select className="select" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}><option value="TAX_INVOICE">Tax invoice (VAT)</option><option value="RECEIPT">Receipt (no VAT)</option></select></Field>
            <Field label="Customer TIN"><input className="input" value={tin} onChange={(e) => setTin(e.target.value.replace(/\D/g, ""))} maxLength={9} /></Field>
          </div>
          <p className="sub" style={{ marginTop: 12 }}><Link to="/settings">Company TIN</Link>: {state.company.tin || "not set"} · VAT {state.company.vatRate}%</p>
        </Modal>
      )}
    </>
  );
}
