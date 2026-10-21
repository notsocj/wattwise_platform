import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth-context";
import UpdatePasswordForm from "@/components/ui/UpdatePasswordForm";
import { createClient } from "@/lib/supabase/server";

export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: string | null }>();

  if (profile?.role === "super_admin") {
    redirect("/admin");
  }

  return <UpdatePasswordForm mode="update" backHref="/settings" />;
}
