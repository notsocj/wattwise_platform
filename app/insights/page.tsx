import Link from 'next/link';
import { BarChart3 } from 'lucide-react';

export default function InsightsPage() {
  return (
    <div className="min-h-screen bg-base text-white flex flex-col items-center justify-center px-6">
      <div className="w-16 h-16 rounded-full bg-mint/10 flex items-center justify-center mb-6">
        <BarChart3 className="w-8 h-8 text-mint" />
      </div>
      <h1 className="text-2xl font-bold mb-2">Insights Dashboard</h1>
      <p className="text-white/50 text-center mb-8">
        AI coaching feed, trend charts, and financial forecast coming soon.
      </p>
      <Link
        href="/dashboard"
        className="text-mint hover:underline text-sm"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
