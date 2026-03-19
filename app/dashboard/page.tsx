import Link from 'next/link';
import { Zap } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-base text-white flex flex-col items-center justify-center px-6">
      <div className="w-16 h-16 rounded-full bg-mint/10 flex items-center justify-center mb-6">
        <Zap className="w-8 h-8 text-mint" />
      </div>
      <h1 className="text-2xl font-bold mb-2">Home Dashboard</h1>
      <p className="text-white/50 text-center mb-8">
        Fleet view and device grid coming soon.
      </p>
      <Link
        href="/onboarding"
        className="text-mint hover:underline text-sm"
      >
        Back to Home
      </Link>
    </div>
  );
}
