import Link from 'next/link';
import { Shield } from 'lucide-react';

export default function AdminPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-6">
      <div className="w-16 h-16 rounded-full bg-mint/10 flex items-center justify-center mb-6">
        <Shield className="w-8 h-8 text-mint" />
      </div>
      <h1 className="text-2xl font-bold mb-2">Mission Control</h1>
      <p className="text-white/50 text-center mb-8">
        Super Admin dashboard coming soon.
      </p>
      <nav className="flex flex-col gap-3 text-sm">
        <Link href="/admin/rates" className="text-mint hover:underline">Meralco Rate Editor</Link>
        <Link href="/admin/growth" className="text-mint hover:underline">Revenue &amp; Growth</Link>
        <Link href="/admin/ai-costs" className="text-mint hover:underline">OpenAI Cost Tracker</Link>
        <Link href="/admin/health" className="text-mint hover:underline">System Health</Link>
        <Link href="/admin/analytics" className="text-mint hover:underline">Global Analytics</Link>
      </nav>
    </div>
  );
}
