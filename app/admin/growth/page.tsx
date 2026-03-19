import Link from 'next/link';
import { TrendingUp } from 'lucide-react';

export default function AdminGrowthPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-6">
      <div className="w-16 h-16 rounded-full bg-mint/10 flex items-center justify-center mb-6">
        <TrendingUp className="w-8 h-8 text-mint" />
      </div>
      <h1 className="text-2xl font-bold mb-2">Revenue &amp; Growth</h1>
      <p className="text-white/50 text-center mb-8">
        User growth charts and MRR tracking coming soon.
      </p>
      <Link href="/admin" className="text-mint hover:underline text-sm">Back to Admin</Link>
    </div>
  );
}
