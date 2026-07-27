import { FlaskConical } from "lucide-react";
import DemoUnitsClient from "@/components/admin/DemoUnitsClient";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function DemoUnitsPage() {
  const admin = createAdminClient();
  const [{ data: units, error: unitError }, { data: people, error: peopleError }] = await Promise.all([
    admin
      .from("demo_device_simulations")
      .select("device_id,is_active,simulated_watts,simulated_voltage_v,energy_kwh,last_generated_at,devices(id,device_name,mac_address,owner_id,user_id,tenant_id,appliance_type,is_online)")
      .order("created_at", { ascending: false }),
    admin.from("profiles").select("id,full_name,email,role").order("full_name"),
  ]);

  if (unitError || peopleError) throw new Error(unitError?.message ?? peopleError?.message);

  const normalizedUnits = (units ?? []).map((unit) => ({
    ...unit,
    devices: Array.isArray(unit.devices) ? unit.devices[0] ?? null : unit.devices,
  }));

  return <div>
    <div className="mb-2 flex items-center gap-3"><FlaskConical className="h-6 w-6 text-mint" /><h1 className="text-2xl font-bold">Demo Units</h1></div>
    <p className="mb-6 max-w-3xl text-white/55">Create a controllable simulated meter for a user or tenant. Its readings enter the same dashboard, reports, costs, and budget workflow as a physical WattWise unit.</p>
    <DemoUnitsClient units={normalizedUnits} people={people ?? []} />
  </div>;
}
