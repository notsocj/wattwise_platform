import { TrendingUp } from 'lucide-react';

export default function AdminGrowthPage() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <TrendingUp className="h-6 w-6 text-mint" />
        <h1 className="text-2xl font-bold">Revenue & Growth</h1>
      </div>
      <p className="text-white/50 mb-8">
        User adoption, active devices, and hypothetical MRR tracking.
      </p>
      <div className="rounded-lg border border-white/10 bg-surface p-6">
        <p className="text-white/40 text-sm">
          30-day user growth chart, total users, active devices, and new user metrics will be displayed here.
        </p>
      </div>
    </div>
  );
}
