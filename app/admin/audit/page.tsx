import { ScrollText } from "@/components/ui/icons";
import AuditList, { loadAuditEntries } from "@/components/admin/AuditList";
import { AdminPageHeader, AdminSection } from "@/components/admin/AdminUi";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminAuditPage() {
  const entries = await loadAuditEntries(createAdminClient(), 100);
  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={ScrollText}
        title="Audit Log"
        description="Every admin change: relays, devices, demo units, test lab, and Meralco rates."
      />
      <AdminSection title="Latest 100 actions">
        <AuditList entries={entries} />
      </AdminSection>
    </div>
  );
}
