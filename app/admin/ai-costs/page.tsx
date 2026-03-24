import { Brain } from 'lucide-react';

export default function AdminAiCostsPage() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <Brain className="h-6 w-6 text-mint" />
        <h1 className="text-2xl font-bold">OpenAI Cost Tracker</h1>
      </div>
      <p className="text-white/50 mb-8">
        Monitor token usage, estimated USD costs, and insight generation volume.
      </p>
      <div className="rounded-lg border border-white/10 bg-surface p-6">
        <p className="text-white/40 text-sm">
          Daily token usage chart, total insights generated, and cost breakdown by insight type will be displayed here.
        </p>
      </div>
    </div>
  );
}
