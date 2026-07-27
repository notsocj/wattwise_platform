import { Shield } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';

export default async function AdminPage() {
  const admin = createAdminClient();
  const [users, devices, online, disabled, warnings, cutoffs] = await Promise.all([
    admin.from('profiles').select('*', { count: 'exact', head: true }),
    admin.from('devices').select('*', { count: 'exact', head: true }),
    admin.from('devices').select('*', { count: 'exact', head: true }).eq('is_online', true),
    admin.from('profiles').select('*', { count: 'exact', head: true }).not('disabled_at', 'is', null),
    admin.from('device_budget_events').select('*', { count: 'exact', head: true }).in('event_type', ['warning_80','warning_90']),
    admin.from('device_budget_events').select('*', { count: 'exact', head: true }).eq('event_type', 'auto_cutoff'),
  ]);
  const cards = [['Users', users.count], ['Devices', devices.count], ['Online devices', online.count], ['Disabled users', disabled.count], ['Warnings', warnings.count], ['Cutoffs', cutoffs.count]];
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <Shield className="h-6 w-6 text-mint" />
        <h1 className="text-2xl font-bold">Overview</h1>
      </div>
      <p className="text-white/50 mb-8">
        Platform summary, key metrics, and quick actions.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{cards.map(([label, value]) => <div key={label} className="rounded-lg border border-white/10 bg-surface p-5"><p className="text-sm text-white/50">{label}</p><p className="mt-2 text-3xl font-semibold text-white">{value ?? 0}</p></div>)}</div>
    </div>
  );
}
