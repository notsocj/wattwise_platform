import { Brain } from "@/components/ui/icons";
import AdminChart from "@/components/admin/AdminChart";
import { AdminPageHeader, AdminSection, StatCard, lastManilaDays, manilaDayKey, shortDayLabel } from "@/components/admin/AdminUi";
import { OPENAI_CHAT_MODEL, OPENAI_PRICE_PER_MILLION_TOKENS } from "@/lib/openai";
import { createAdminClient } from "@/lib/supabase/admin";

type InsightRow = {
  prompt_tokens: number | null;
  completion_tokens: number | null;
  insight_type: string | null;
  created_at: string;
};

function costUsd(prompt: number, completion: number) {
  return (
    (prompt * OPENAI_PRICE_PER_MILLION_TOKENS.input + completion * OPENAI_PRICE_PER_MILLION_TOKENS.output) / 1_000_000
  );
}

function usd(value: number) {
  return `$${value.toFixed(value < 1 ? 4 : 2)}`;
}

export default async function AdminAiCostsPage() {
  const { data } = await createAdminClient()
    .from("ai_insights")
    .select("prompt_tokens,completion_tokens,insight_type,created_at")
    .order("created_at", { ascending: false })
    .limit(20000)
    .returns<InsightRow[]>();
  const rows = data ?? [];

  let prompt = 0;
  let completion = 0;
  const byType = new Map<string, { count: number; tokens: number; cost: number }>();
  const byDay = new Map<string, { tokens: number; cost: number }>();
  for (const row of rows) {
    const p = Number(row.prompt_tokens) || 0;
    const c = Number(row.completion_tokens) || 0;
    const cost = costUsd(p, c);
    prompt += p;
    completion += c;
    const type = row.insight_type ?? "unknown";
    const typeTotal = byType.get(type) ?? { count: 0, tokens: 0, cost: 0 };
    byType.set(type, { count: typeTotal.count + 1, tokens: typeTotal.tokens + p + c, cost: typeTotal.cost + cost });
    const day = manilaDayKey(row.created_at);
    const dayTotal = byDay.get(day) ?? { tokens: 0, cost: 0 };
    byDay.set(day, { tokens: dayTotal.tokens + p + c, cost: dayTotal.cost + cost });
  }

  const days = lastManilaDays(30);
  const chart = days.map((day) => ({ label: shortDayLabel(day), value: byDay.get(day)?.tokens ?? 0 }));
  const last30Cost = days.reduce((sum, day) => sum + (byDay.get(day)?.cost ?? 0), 0);
  const types = [...byType.entries()].sort((a, b) => b[1].cost - a[1].cost);
  const totalCost = costUsd(prompt, completion);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={Brain}
        title="AI Costs"
        description={`Token use and estimated OpenAI cost for generated insights (${OPENAI_CHAT_MODEL}).`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Insights generated" value={rows.length.toLocaleString()} />
        <StatCard
          label="Tokens used"
          value={(prompt + completion).toLocaleString()}
          hint={`${prompt.toLocaleString()} in · ${completion.toLocaleString()} out`}
        />
        <StatCard label="Estimated cost" value={usd(totalCost)} hint="All time" tone="good" />
        <StatCard label="Last 30 days" value={usd(last30Cost)} hint="Estimated" />
      </div>

      <AdminSection title="Daily tokens" description="Last 30 days, Manila time.">
        <AdminChart data={chart} kind="bar" valueLabel="Tokens" />
      </AdminSection>

      <AdminSection title="By insight type" description="Sorted by estimated cost.">
        {types.length === 0 ? (
          <p className="text-sm text-fg/50">No insights generated yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.1em] text-fg/45">
                <tr>
                  {["Type", "Insights", "Tokens", "Avg tokens", "Est. cost"].map((heading) => (
                    <th key={heading} className="pb-2 pr-4 font-semibold">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {types.map(([type, total]) => (
                  <tr key={type} className="border-t border-fg/[0.05]">
                    <td className="py-2.5 pr-4 font-medium">{type.replace(/_/g, " ")}</td>
                    <td className="py-2.5 pr-4 tabular-nums">{total.count.toLocaleString()}</td>
                    <td className="py-2.5 pr-4 tabular-nums">{total.tokens.toLocaleString()}</td>
                    <td className="py-2.5 pr-4 tabular-nums">{Math.round(total.tokens / total.count).toLocaleString()}</td>
                    <td className="py-2.5 pr-4 font-semibold tabular-nums">{usd(total.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminSection>

      <p className="text-xs leading-relaxed text-fg/45">
        Estimates use list prices of ${OPENAI_PRICE_PER_MILLION_TOKENS.input} per 1M input and $
        {OPENAI_PRICE_PER_MILLION_TOKENS.output} per 1M output tokens (`lib/openai.ts`). Assistant and chatbot replies
        don&apos;t record tokens yet, so actual spend is higher; check the OpenAI usage dashboard for the bill.
      </p>
    </div>
  );
}
