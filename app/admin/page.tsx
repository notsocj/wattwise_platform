import { Shield } from 'lucide-react';

export default function AdminPage() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <Shield className="h-6 w-6 text-mint" />
        <h1 className="text-2xl font-bold">Overview</h1>
      </div>
      <p className="text-white/50 mb-8">
        Platform summary, key metrics, and quick actions.
      </p>
      <div className="rounded-lg border border-white/10 bg-surface p-6">
        <p className="text-white/40 text-sm">
          Sales and adopted devices charts will be displayed here.
        </p>
      </div>
    </div>
  );
}
