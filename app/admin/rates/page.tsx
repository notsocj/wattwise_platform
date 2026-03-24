import { DollarSign } from 'lucide-react';

export default function AdminRatesPage() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <DollarSign className="h-6 w-6 text-mint" />
        <h1 className="text-2xl font-bold">Meralco Rate Editor</h1>
      </div>
      <p className="text-white/50 mb-8">
        Manage unbundled Meralco billing rates across all users.
      </p>
      <div className="rounded-lg border border-white/10 bg-surface p-6">
        <p className="text-white/40 text-sm">
          Rate form (Generation, Transmission, System Loss, Distribution, Subsidies, Government Taxes, Universal Charges) and history table will be displayed here.
        </p>
      </div>
    </div>
  );
}
