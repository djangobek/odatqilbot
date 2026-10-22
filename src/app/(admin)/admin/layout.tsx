import { AuthProvider } from '@/components/AuthProvider';
import { AdminShell } from '@/components/admin/AdminShell';

export const metadata = { title: 'Admin · Discipline OS' };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AdminShell>{children}</AdminShell>
    </AuthProvider>
  );
}
