import { useMemo, useState } from "react";
import { BadgeCheck, Plus, Search } from "lucide-react";
import { useTaw } from "../state/TawStore";
import { Badge, Card, EmptyState, Field, Modal, PageHead } from "../components/ui";
import { num } from "../lib/utils";

export function CatalogPage() {
  const { state, addCatalogItem } = useTaw();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ make: "", model: "", yearRange: "", bodyType: "", lengthMm: 0, minWeightKg: 0, maxWeightKg: 0 });

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return state.catalog;
    return state.catalog.filter((item) => `${item.make} ${item.model} ${item.bodyType}`.toLowerCase().includes(needle));
  }, [state.catalog, query]);

  const makes = [...new Set(state.catalog.map((item) => item.make))].length;

  function save() {
    if (!form.make || !form.model || form.lengthMm <= 0) return;
    addCatalogItem(form);
    setOpen(false);
    setForm({ make: "", model: "", yearRange: "", bodyType: "", lengthMm: 0, minWeightKg: 0, maxWeightKg: 0 });
  }

  return (
    <>
      <PageHead
        title="Vehicle directory"
        subtitle={`${state.catalog.length} Sri Lankan models · ${makes} makes · maintained by the developer`}
        action={<button className="btn btn-brand btn-sm" onClick={() => setOpen(true)}><Plus size={14} /> Add model</button>}
      />
      <div className="toolbar">
        <div className="search-wrap"><Search /><input className="input" placeholder="Search make, model or body type…" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
      </div>
      <div className="alert-strip alert-info">
        <BadgeCheck size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
        Dispatch reads these dimensions automatically. Unlisted loads can still be entered manually.
      </div>
      {filtered.length === 0 ? (
        <Card><EmptyState message="No vehicle models match this search." /></Card>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Make / model</th><th>Length</th><th>Weight</th><th>Type</th></tr></thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="cell-title">{item.make} {item.model}</div>
                      <div className="cell-sub">{item.yearRange} {item.custom && <Badge tone="info">Custom</Badge>}</div>
                    </td>
                    <td className="mono">{item.lengthMm.toLocaleString()} mm</td>
                    <td className="cell-sub">{item.minWeightKg.toLocaleString()}–{item.maxWeightKg.toLocaleString()} kg</td>
                    <td className="cell-sub">{item.bodyType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {open && (
        <Modal
          title="Add a vehicle model"
          subtitle="Used by smart dispatch for automatic specification lookup"
          onClose={() => setOpen(false)}
          footer={<><button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button><button className="btn btn-brand" disabled={!form.make || !form.model} onClick={save}>Add model</button></>}
        >
          <div className="form-grid">
            <Field label="Make"><input className="input" value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} /></Field>
            <Field label="Model"><input className="input" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></Field>
            <Field label="Year range"><input className="input" value={form.yearRange} onChange={(e) => setForm({ ...form, yearRange: e.target.value })} placeholder="2015–2024" /></Field>
            <Field label="Body type"><input className="input" value={form.bodyType} onChange={(e) => setForm({ ...form, bodyType: e.target.value })} /></Field>
            <Field label="Length (mm)"><input className="input" type="number" value={form.lengthMm || ""} onChange={(e) => setForm({ ...form, lengthMm: num(e.target.value) })} /></Field>
            <Field label="Min weight (kg)"><input className="input" type="number" value={form.minWeightKg || ""} onChange={(e) => setForm({ ...form, minWeightKg: num(e.target.value) })} /></Field>
            <Field label="Max weight (kg)" full><input className="input" type="number" value={form.maxWeightKg || ""} onChange={(e) => setForm({ ...form, maxWeightKg: num(e.target.value) })} /></Field>
          </div>
        </Modal>
      )}
    </>
  );
}
