"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Play, RotateCcw, Square, Zap } from "lucide-react";

type Person = { id: string; full_name: string | null; email: string; role: string };
type Unit = {
  device_id: string;
  is_active: boolean;
  simulated_watts: number;
  simulated_voltage_v: number;
  energy_kwh: number;
  last_generated_at: string | null;
  devices: {
    id: string;
    device_name: string;
    mac_address: string;
    owner_id: string | null;
    user_id: string | null;
    tenant_id: string | null;
    appliance_type: string | null;
    is_online: boolean;
  } | null;
};

const fieldClass = "mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white";
const buttonClass = "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

function displayPerson(person: Person | undefined) {
  return person ? person.full_name || person.email : "Unassigned";
}

export default function DemoUnitsClient({ units, people }: { units: Unit[]; people: Person[] }) {
  const router = useRouter();
  const owners = people.filter((person) => person.role !== "tenant");
  const tenants = people.filter((person) => person.role === "tenant");
  const [submitting, setSubmitting] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function createUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSubmitting(true);
    setMessage(null);
    const response = await fetch("/api/admin/demo-units", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        device_name: form.get("device_name"),
        owner_id: form.get("owner_id"),
        tenant_id: form.get("tenant_id") || null,
        appliance_type: form.get("appliance_type"),
        simulated_watts: form.get("simulated_watts"),
        simulated_voltage_v: form.get("simulated_voltage_v"),
        reason: "Created from demo unit control panel",
      }),
    });
    const payload = await response.json();
    setSubmitting(false);
    if (!response.ok) {
      setMessage(payload.error || "Unable to create the demo unit.");
      return;
    }
    formElement.reset();
    setMessage("Demo unit created. Start it, then use Run now to generate its first reading.");
    router.refresh();
  }

  async function updateUnit(deviceId: string, body: Record<string, unknown>) {
    setRunningId(deviceId);
    setMessage(null);
    const response = await fetch(`/api/admin/demo-units/${deviceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    setRunningId(null);
    if (!response.ok) {
      setMessage(payload.error || "Unable to update the demo unit.");
      return;
    }
    router.refresh();
  }

  async function runUnit(deviceId: string) {
    setRunningId(deviceId);
    setMessage(null);
    const response = await fetch(`/api/admin/demo-units/${deviceId}/run`, { method: "POST" });
    const payload = await response.json();
    setRunningId(null);
    if (!response.ok) {
      setMessage(payload.error || "Unable to generate telemetry.");
      return;
    }
    setMessage("Telemetry generated and stored in energy logs.");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-mint/20 bg-mint/5 p-5">
        <div className="flex gap-3">
          <Zap className="mt-0.5 h-5 w-5 shrink-0 text-mint" />
          <div>
            <h2 className="font-semibold">Virtual WattWise unit</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-white/60">This creates a normal device and writes the same cumulative telemetry format that ESP hardware uses. It is intended for demos and testing only; it never controls a physical relay.</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-surface p-5">
        <h2 className="text-lg font-semibold">Create and assign a demo unit</h2>
        <form onSubmit={createUnit} className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="text-sm">Device name<input required name="device_name" placeholder="Panel demo aircon" className={fieldClass} /></label>
          <label className="text-sm">Owner<select required name="owner_id" defaultValue="" className={fieldClass}><option value="" disabled>Select an owner</option>{owners.map((person) => <option key={person.id} value={person.id}>{displayPerson(person)} · {person.role}</option>)}</select></label>
          <label className="text-sm">Tenant (optional)<select name="tenant_id" defaultValue="" className={fieldClass}><option value="">No tenant</option>{tenants.map((person) => <option key={person.id} value={person.id}>{displayPerson(person)}</option>)}</select></label>
          <label className="text-sm">Appliance type<input name="appliance_type" defaultValue="aircon" className={fieldClass} /></label>
          <label className="text-sm">Simulated watts<input required name="simulated_watts" type="number" min="0" max="5000" step="1" defaultValue="100" className={fieldClass} /></label>
          <label className="text-sm">Simulated voltage<input required name="simulated_voltage_v" type="number" min="180" max="260" step="0.1" defaultValue="230" className={fieldClass} /></label>
          <div className="flex items-end"><button disabled={submitting} className={`${buttonClass} w-full bg-mint text-black hover:bg-mint/90`}>{submitting ? "Creating…" : "Create demo unit"}</button></div>
        </form>
      </section>

      {message && <p className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">{message}</p>}

      <section className="overflow-x-auto rounded-xl border border-white/10 bg-surface">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-white/10 text-white/50"><tr>{["Device", "Assigned owner", "Tenant", "Watts", "Generated kWh", "State", "Last reading", "Actions"].map((heading) => <th key={heading} className="p-4 font-medium">{heading}</th>)}</tr></thead>
          <tbody>
            {units.map((unit) => {
              const device = unit.devices;
              const busy = runningId === unit.device_id;
              return <tr key={unit.device_id} className="border-b border-white/5 last:border-0">
                <td className="p-4"><p className="font-medium">{device?.device_name ?? "Missing device"}</p><p className="mt-1 font-mono text-xs text-white/40">{device?.mac_address}</p></td>
                <td className="p-4">{displayPerson(people.find((person) => person.id === (device?.owner_id ?? device?.user_id)))}</td>
                <td className="p-4">{displayPerson(people.find((person) => person.id === device?.tenant_id))}</td>
                <td className="p-4">{Number(unit.simulated_watts).toFixed(0)} W</td>
                <td className="p-4">{Number(unit.energy_kwh).toFixed(4)} kWh</td>
                <td className="p-4"><span className={unit.is_active ? "text-mint" : "text-white/45"}>{unit.is_active ? "Running" : "Paused"}</span></td>
                <td className="p-4 text-white/60">{unit.last_generated_at ? new Date(unit.last_generated_at).toLocaleString() : "No reading yet"}</td>
                <td className="p-4"><div className="flex flex-wrap gap-2">
                  <button disabled={busy} onClick={() => updateUnit(unit.device_id, { is_active: !unit.is_active, reason: unit.is_active ? "Paused demo unit" : "Started demo unit" })} className={`${buttonClass} border border-white/15 hover:bg-white/5`}>{unit.is_active ? <><Square className="h-3.5 w-3.5" />Pause</> : <><Play className="h-3.5 w-3.5" />Start</>}</button>
                  <button disabled={busy || !unit.is_active} onClick={() => runUnit(unit.device_id)} className={`${buttonClass} border border-mint/30 text-mint hover:bg-mint/10`}><Play className="h-3.5 w-3.5" />Run now</button>
                  <button disabled={busy} onClick={() => { if (window.confirm("Reset this simulated meter to 0 kWh? Existing energy log history remains for auditability.")) updateUnit(unit.device_id, { reset_energy: true, reason: "Reset simulated meter baseline" }); }} className={`${buttonClass} border border-white/15 text-white/70 hover:bg-white/5`}><RotateCcw className="h-3.5 w-3.5" />Reset</button>
                </div></td>
              </tr>;
            })}
            {!units.length && <tr><td colSpan={8} className="p-8 text-center text-white/50">No demo units yet. Create one above to begin.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
