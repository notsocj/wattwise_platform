import { TestTube2 } from "lucide-react";
import AdminTestLabClient from "@/components/admin/AdminTestLabClient";

export default function AdminTestLabPage() {
  return <div>
    <div className="mb-2 flex items-center gap-3"><TestTube2 className="h-6 w-6 text-mint" /><h1 className="text-2xl font-bold">Test Lab</h1></div>
    <p className="mb-6 max-w-3xl text-white/55">Run the real WattWise presentation flow on a selected account. Tests insert actual telemetry and may create alerts, emails, push notifications, and cutoff states.</p>
    <AdminTestLabClient />
  </div>;
}
