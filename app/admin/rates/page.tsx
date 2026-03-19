import Link from 'next/link';
import { DollarSign } from 'lucide-react';

export default function AdminRatesPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-6">
      <div className="w-16 h-16 rounded-full bg-mint/10 flex items-center justify-center mb-6">
        <DollarSign className="w-8 h-8 text-mint" />
      </div>
      <h1 className="text-2xl font-bold mb-2">Meralco Rate Editor</h1>
      <p className="text-white/50 text-center mb-8">
        Unbundled rate management form coming soon.
      </p>
      <Link href="/admin" className="text-mint hover:underline text-sm">Back to Admin</Link>
    </div>
  );
}
