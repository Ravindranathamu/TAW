import { useMemo, useState } from "react";
import { Banknote, Plus, Receipt, TrendingUp, Users } from "lucide-react";
import { useTaw } from "../state/TawStore";
import { Badge, Card, EmptyState, Field, Modal, PageHead, StatCard } from "../components/ui";
import { money, monthKey, num, shortDate, uid } from "../lib/utils";
import type { Expense, PayrollEntry } from "../types";

const emptyExpense = (): Expense => ({ id: uid(), date: new Date().toISOString().slice(0, 10), category: "Office", amount: 0, note: "" });

export function FinancePage() {
  const { state, savePayroll, addExpense, notify } = useTaw();
  const [month, setMonth] = useState(monthKey());
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expense, setExpense] = useState(emptyExpense());
  const [payroll, setPayroll] = useState<PayrollEntry | null>(null);

  const monthlyTrips = state.trips.filter((t) => t.status === "COMPLETED" && t.completedAt?.startsWith(month));
  const revenue = monthlyTrips.reduce((s, t) => s + t.price.finalQuote, 0);
  const fuelCost = state.fuelLogs.filter((f) => f.date.startsWith(month)).reduce((s, f) => s + f.cost, 0);
  const maintenanceCost = state.maintenance.filter((m) => m.date.startsWith(month)).reduce((s, m) => s + m.totalCost, 0);
  const wages = state.payroll.filter((p) => p.month === month).reduce((s, p) => s + p.net, 0);
  const partnerPayout = state.partnerJobs.filter((j) => j.createdAt.startsWith(month)).reduce((s, j) => s + j.partnerPayout + j.commission, 0);
  const expenses = state.expenses.filter((e) => e.date.startsWith(month)).reduce((s, e) => s + e.amount, 0);
  const profit = revenue - fuelCost - maintenanceCost - wages - partnerPayout - expenses;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  const payrollEntries = useMemo(() => state.payroll.filter((p) => p.month === month), [state.payroll, month]);

  function newPayroll() {
    const first = state.staff.find((s) => s.role !== "HELPER" && s.active);
    setPayroll({ id: uid(), staffId: first?.id ?? "", month, base: first?.monthlySalary ?? 0, batta: 0, deductions: 0, net: first?.monthlySalary ?? 0, paid: false });
  }

  return (
    <>
      <PageHead title="Finance & P&L" subtitle="Trip revenue, fuel, maintenance, payroll, partner settlements and expenses" />
      <div className="toolbar">
        <input className="input" type="month" style={{ maxWidth: 180 }} value={month} onChange={(e) => setMonth(e.target.value)} />
        <button className="btn btn-brand btn-sm" onClick={() => { setExpense(emptyExpense()); setExpenseOpen(true); }}><Plus size={14} /> Expense</button>
      </div>
      <div className="grid grid-2">
        <StatCard label="Revenue" value={money(revenue)} foot={`${monthlyTrips.length} completed trips`} icon={<TrendingUp size={16} />} />
        <StatCard label="Net profit" value={money(profit)} foot={`${margin.toFixed(1)}% margin`} icon={<Banknote size={16} />} tone={profit >= 0 ? "teal" : "red"} />
      </div>
      <Card title="Profit &amp; loss" subtitle={month}>
        <div className="kv" style={{ fontSize: 12.5 }}>
          <dt>Trip revenue</dt><dd style={{ color: "var(--ok)" }}>+{money(revenue)}</dd>
          <dt>Fuel</dt><dd>−{money(fuelCost)}</dd>
          <dt>Maintenance &amp; parts</dt><dd>−{money(maintenanceCost)}</dd>
          <dt>Driver wages &amp; batta</dt><dd>−{money(wages)}</dd>
          <dt>Partner payouts &amp; commission</dt><dd>−{money(partnerPayout)}</dd>
          <dt>Other expenses</dt><dd>−{money(expenses)}</dd>
          <dt style={{ fontWeight: 800 }}>Net</dt><dd style={{ fontWeight: 800, color: profit >= 0 ? "var(--ok)" : "var(--danger)" }}>{money(profit)}</dd>
        </div>
      </Card>

      <Card title="Payroll" subtitle="Permanent salaries, temporary trip wages and helper batta" action={<button className="btn btn-ghost btn-sm" onClick={newPayroll}><Plus size={13} /> Add entry</button>} padded={false}>
        {payrollEntries.length === 0 ? <EmptyState message="No payroll entries for this month." /> : (
          <div style={{ padding: "4px 14px 12px" }}>
            {payrollEntries.map((p) => {
              const person = state.staff.find((s) => s.id === p.staffId);
              const tripWages = state.trips.filter((t) => t.status === "COMPLETED" && (t.staffId === p.staffId || t.helperIds.includes(p.staffId))).reduce((s) => s + (person?.perTripWage ?? 0) + (person?.battaPerTrip ?? 0), 0);
              return (
                <div key={p.id} className="alert-item">
                  <span style={{ flex: 1 }}>
                    <strong>{person?.name ?? "Unknown crew"}</strong>
                    <small>Base {money(p.base)} · batta {money(p.batta)} · trip wages {money(tripWages)} · deductions {money(p.deductions)}</small>
                  </span>
                  <div style={{ textAlign: "right" }}>
                    <strong>{money(p.net)}</strong>
                    <button className="btn btn-ghost btn-sm" style={{ marginTop: 4 }} onClick={() => { savePayroll({ ...p, paid: !p.paid, paidAt: !p.paid ? new Date().toISOString() : undefined }); notify({ tone: "ok", text: p.paid ? "Marked unpaid." : "Marked paid." }); }}>{p.paid ? "Paid" : "Mark paid"}</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card title="Expenses" padded={false}>
        {state.expenses.filter((e) => e.date.startsWith(month)).length === 0 ? <EmptyState message="No expenses recorded for this month." /> : (
          <div style={{ padding: "4px 14px 12px" }}>
            {state.expenses.filter((e) => e.date.startsWith(month)).map((e) => (
              <div key={e.id} className="alert-item">
                <Receipt size={14} style={{ color: "var(--ink-3)", marginTop: 3 }} />
                <span style={{ flex: 1 }}><strong>{e.category}</strong><small>{shortDate(e.date)} · {e.note}{e.vehicleId ? ` · ${state.vehicles.find((v) => v.id === e.vehicleId)?.plate ?? ""}` : ""}</small></span>
                <strong>{money(e.amount)}</strong>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Partner settlement summary" subtitle="Subcontracted jobs and commissions">
        <div className="kv">
          <dt>Total partner payouts</dt><dd>{money(partnerPayout)}</dd>
          <dt>Open jobs</dt><dd>{state.partnerJobs.filter((j) => !j.settled).length}</dd>
          <dt>Crew on payroll</dt><dd><Users size={12} style={{ verticalAlign: -2 }} /> {payrollEntries.length}</dd>
        </div>
      </Card>

      {expenseOpen && (
        <Modal title="Add expense" onClose={() => setExpenseOpen(false)} footer={<><button className="btn btn-ghost" onClick={() => setExpenseOpen(false)}>Cancel</button><button className="btn btn-brand" disabled={expense.amount <= 0} onClick={() => { addExpense(expense); setExpenseOpen(false); }}>Save expense</button></>}>
          <div className="form-grid">
            <Field label="Date"><input className="input" type="date" value={expense.date} onChange={(e) => setExpense({ ...expense, date: e.target.value })} /></Field>
            <Field label="Category"><input className="input" value={expense.category} onChange={(e) => setExpense({ ...expense, category: e.target.value })} /></Field>
            <Field label="Amount"><input className="input" type="number" value={expense.amount || ""} onChange={(e) => setExpense({ ...expense, amount: num(e.target.value) })} /></Field>
            <Field label="Linked truck"><select className="select" value={expense.vehicleId ?? ""} onChange={(e) => setExpense({ ...expense, vehicleId: e.target.value || undefined })}><option value="">None</option>{state.vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate}</option>)}</select></Field>
            <Field label="Note" full><input className="input" value={expense.note} onChange={(e) => setExpense({ ...expense, note: e.target.value })} /></Field>
          </div>
        </Modal>
      )}

      {payroll && (
        <Modal title="Payroll entry" subtitle={state.staff.find((s) => s.id === payroll.staffId)?.name ?? "Crew"} onClose={() => setPayroll(null)} footer={<><button className="btn btn-ghost" onClick={() => setPayroll(null)}>Cancel</button><button className="btn btn-brand" onClick={() => { savePayroll({ ...payroll, net: payroll.base + payroll.batta - payroll.deductions }); setPayroll(null); }}>Save entry</button></>}>
          <div className="form-grid">
            <Field label="Crew member" full><select className="select" value={payroll.staffId} onChange={(e) => setPayroll({ ...payroll, staffId: e.target.value })}>{state.staff.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
            <Field label="Month"><input className="input" type="month" value={payroll.month} onChange={(e) => setPayroll({ ...payroll, month: e.target.value })} /></Field>
            <Field label="Base"><input className="input" type="number" value={payroll.base} onChange={(e) => setPayroll({ ...payroll, base: num(e.target.value) })} /></Field>
            <Field label="Batta"><input className="input" type="number" value={payroll.batta} onChange={(e) => setPayroll({ ...payroll, batta: num(e.target.value) })} /></Field>
            <Field label="Deductions"><input className="input" type="number" value={payroll.deductions} onChange={(e) => setPayroll({ ...payroll, deductions: num(e.target.value) })} /></Field>
          </div>
          <p className="sub" style={{ marginTop: 12 }}>Net: <strong>{money(payroll.base + payroll.batta - payroll.deductions)}</strong></p>
          <Badge tone={payroll.paid ? "ok" : "warn"}>{payroll.paid ? "Paid" : "Pending"}</Badge>
        </Modal>
      )}
    </>
  );
}
