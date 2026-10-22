'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMe } from '@/components/AuthProvider';

const VIEW = 'dos_view'; // 'user' = the admin chose the regular app for this session
const LANDED = 'dos_landed';

const read = (k: string) => { try { return sessionStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { sessionStorage.setItem(k, v); } catch { /* ignore */ } };

/** Admin chose the regular user view (stays until the app is closed). */
export const markUserView = () => write(VIEW, 'user');

/** Used by the "Admin panel" buttons inside the regular app. */
export function useEnterAdmin() {
  const router = useRouter();
  return () => { write(VIEW, 'admin'); router.push('/admin'); };
}

/**
 * Mounted inside the regular app: when an admin opens the app (first screen of the session),
 * the admin panel opens automatically. They can switch to the user view at any time.
 */
export function AdminGate() {
  const { me } = useMe();
  const router = useRouter();
  useEffect(() => {
    if (me.user.role !== 'admin') return;
    if (read(LANDED)) return; // only the very first screen of a session redirects
    write(LANDED, '1');
    if (read(VIEW) !== 'user') router.replace('/admin');
  }, [me.user.role, router]);
  return null;
}
