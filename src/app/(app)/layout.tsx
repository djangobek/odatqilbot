import { AuthProvider } from '@/components/AuthProvider';
import { AdminGate } from '@/components/AdminGate';
import { Shell } from '@/components/Shell';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AdminGate />
      <Shell>{children}</Shell>
    </AuthProvider>
  );
}
