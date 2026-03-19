import Link from 'next/link';
import { Cpu } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function DeviceDetailPage(_props: {
  params: Promise<{ deviceId: string }>;
}) {
  return (
    <div className="min-h-screen bg-base text-white flex flex-col items-center justify-center px-6">
      <div className="w-16 h-16 rounded-full bg-mint/10 flex items-center justify-center mb-6">
        <Cpu className="w-8 h-8 text-mint" />
      </div>
      <h1 className="text-2xl font-bold mb-2">Device Detail</h1>
      <p className="text-white/50 text-center mb-8">
        Power gauges, relay control, and diagnostics coming soon.
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
