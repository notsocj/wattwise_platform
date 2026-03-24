import { HeartPulse } from 'lucide-react';

export default function AdminHealthPage() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <HeartPulse className="h-6 w-6 text-mint" />
        <h1 className="text-2xl font-bold">System Health</h1>
      </div>
      <p className="text-white/50 mb-8">
        Database storage usage, device fleet status, and Supabase Free Tier monitoring.
      </p>
      <div className="rounded-lg border border-white/10 bg-surface p-6">
        <p className="text-white/40 text-sm">
          Storage progress bar, online/offline device counts, and device health table will be displayed here.
        </p>
      </div>
    </div>
  );
}
