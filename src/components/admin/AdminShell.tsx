'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Megaphone, Server, ShieldCheck, Smartphone, Users } from 'lucide-react';
import clsx from 'clsx';
import { useMe } from '@/components/AuthProvider';
import { markUserView } from '@/components/AdminGate';

const NAV = [
  { href: '/admin', label: 'Boshqaruv', Icon: LayoutDashboard, exact: true },
  { href: '/admin/users', label: 'Foydalanuvchilar', Icon: Users },
  { href: '/admin/broadcasts', label: 'Xabarlar', Icon: Megaphone },
  { href: '/admin/system', label: 'Tizim', Icon: Server },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { me } = useMe();
  const path = usePathname();
  const router = useRouter();
  const isAdmin = me.user.role === 'admin';

  useEffect(() => { if (!isAdmin) router.replace('/today'); }, [isAdmin, router]);
  if (!isAdmin) return null;

  const switchToUser = () => { markUserView(); router.push('/today'); };
  const active = (n: (typeof NAV)[number]) => (n.exact ? path === n.href : path.startsWith(n.href));

  return (
    <div className="min-h-dvh md:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col gap-1 border-r border-line bg-ink p-4 md:flex">
        <div className="mb-6 flex items-center gap-3 px-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-black"><ShieldCheck size={22} /></span>
          <div className="leading-tight"><p className="font-extrabold">Discipline OS</p><p className="text-xs font-semibold text-accent">Admin panel</p></div>
        </div>
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} aria-current={active(n) ? 'page' : undefined}
            className={clsx('flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium transition-colors', active(n) ? 'bg-surface text-accent' : 'text-muted hover:bg-surface')}>
            <n.Icon size={20} /> {n.label}
          </Link>
        ))}
        <div className="mt-auto space-y-2 border-t border-line pt-4">
          <p className="truncate px-2 text-xs text-muted">{me.user.displayName}</p>
          <button onClick={switchToUser} className="flex w-full items-center gap-3 rounded-xl bg-surface px-3 py-2.5 font-medium hover:bg-raised active:scale-[.98]">
            <Smartphone size={20} /> Foydalanuvchi ko‘rinishi
          </button>
        </div>
      </aside>

      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-ink/90 px-4 pb-2 pt-[max(env(safe-area-inset-top),0.5rem)] backdrop-blur md:hidden">
        <span className="flex items-center gap-2 font-extrabold"><ShieldCheck size={18} className="text-accent" /> Admin</span>
        <button onClick={switchToUser} className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs font-semibold active:scale-95"><Smartphone size={14} /> Ilova ko‘rinishi</button>
      </div>

      <main className="mx-auto max-w-6xl px-4 pb-32 pt-5 md:px-8 md:pb-12 md:pt-8">{children}</main>

      <nav aria-label="Admin" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-[#0c0c0c]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <ul className="mx-auto flex max-w-md">
          {NAV.map((n) => (
            <li key={n.href} className="flex-1">
              <Link href={n.href} aria-current={active(n) ? 'page' : undefined}
                className={clsx('flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium', active(n) ? 'text-accent' : 'text-muted')}>
                <n.Icon size={20} strokeWidth={active(n) ? 2.4 : 2} /> {n.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
