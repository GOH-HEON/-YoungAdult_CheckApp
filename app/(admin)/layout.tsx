import { AdminShell } from "@/components/layout/admin-shell";
import { canWrite, requireSession } from "@/lib/auth/session";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, appUser } = await requireSession();

  return (
    <AdminShell
      userDisplayName={appUser?.name ?? user.email ?? "관리자"}
      userEmail={user.email ?? ""}
      canWrite={canWrite(appUser)}
    >
      {children}
    </AdminShell>
  );
}
