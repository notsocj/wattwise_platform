import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

type AuditRow = {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  reason: string | null;
  created_at: string;
};

export type AuditEntry = AuditRow & { actor_email: string | null };

/** Latest admin actions with the actor's email instead of a raw id. */
export async function loadAuditEntries(admin: ReturnType<typeof createAdminClient>, limit: number): Promise<AuditEntry[]> {
  const { data } = await admin
    .from("admin_audit_logs")
    .select("id,actor_id,action,target_type,target_id,reason,created_at")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<AuditRow[]>();
  const rows = data ?? [];
  const actorIds = [...new Set(rows.map((row) => row.actor_id).filter((id): id is string => Boolean(id)))];
  const { data: actors } = actorIds.length
    ? await admin.from("profiles").select("id,email").in("id", actorIds).returns<{ id: string; email: string | null }[]>()
    : { data: [] };
  const emails = new Map((actors ?? []).map((actor) => [actor.id, actor.email]));
  return rows.map((row) => ({ ...row, actor_email: row.actor_id ? emails.get(row.actor_id) ?? null : null }));
}

/** "relay_change" → "Relay change". */
function actionLabel(action: string) {
  const text = action.replace(/[._]/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** A compact list of audit entries; used on the overview and the audit page. */
export default function AuditList({ entries, empty = "No admin actions yet." }: { entries: AuditEntry[]; empty?: string }) {
  if (entries.length === 0) return <p className="text-sm text-fg/50">{empty}</p>;
  return (
    <ul className="divide-y divide-fg/[0.05]">
      {entries.map((entry) => (
        <li key={entry.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <p className="text-sm font-semibold">{actionLabel(entry.action)}</p>
            <p className="mt-0.5 break-all text-xs text-fg/50">
              {entry.target_type ? `${entry.target_type.replace(/_/g, " ")}${entry.target_id ? ` · ${entry.target_id}` : ""}` : "—"}
            </p>
            {entry.reason ? <p className="mt-1 text-xs text-fg/70">“{entry.reason}”</p> : null}
          </div>
          <div className="text-right text-xs text-fg/45">
            <p>{timeLabel(entry.created_at)}</p>
            <p className="mt-0.5">{entry.actor_email ?? "System"}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
