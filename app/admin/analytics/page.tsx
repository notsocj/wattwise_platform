import { Globe } from 'lucide-react';

export default function AdminAnalyticsPage() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <Globe className="h-6 w-6 text-mint" />
        <h1 className="text-2xl font-bold">Global Energy Analytics</h1>
      </div>
      <p className="text-white/50 mb-8">
        Platform-wide energy impact: total kWh monitored and estimated savings.
      </p>
      <div className="rounded-lg border border-white/10 bg-surface p-6">
        <p className="text-white/40 text-sm">
          Total kWh, total users, total devices, estimated savings, and daily consumption chart will be displayed here.
        </p>
      </div>
    </div>
  );
}
