export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // TODO (Phase 4): Add role-based access control
  // Check profiles.role === 'super_admin' and redirect non-admins to /dashboard
  return (
    <div className="min-h-screen bg-base text-white">
      <header className="border-b border-white/10 px-6 py-4">
        <h2 className="text-lg font-semibold text-mint">WattWise Admin</h2>
      </header>
      <main>{children}</main>
    </div>
  );
}
