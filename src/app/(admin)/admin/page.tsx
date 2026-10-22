'use client';
import { useEffect } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { RefreshCw } from 'lucide-react';
import { useApi } from '@/lib/api';
import { Btn, Card, ErrorBox, PageHeader, Skeleton, Stat, fmtNum } from '@/components/admin/ui';

type Overview = {
  users: { total: number; banned: number; blocked: number; admins: number; dau: number; wau: number; mau: number; new24: number; new7: number; reminders: number; morning: number; evening: number };
  habits: { total: number; active: number; completions: number };
  series: { date: string; signups: number; completions: number }[];
  topHabits: { name: string; count: number }[];
};

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const tick = { fill: '#8e8e93', fontSize: 11 };
const tip = { contentStyle: { background: '#1c1c1e', border: '1px solid #2f2f33', borderRadius: 12, color: '#f2f2f7' }, labelStyle: { color: '#8e8e93' } };
const short = (d: string) => d.slice(5).replace('-', '.');

export default function AdminDashboard() {
  const { data, error, loading, refreshing, reload } = useApi<Overview>('/api/admin/overview');

  useEffect(() => {
    const id = window.setInterval(() => { if (document.visibilityState === 'visible') reload(); }, 30_000);
    return () => window.clearInterval(id);
  }, [reload]);

  return (
    <>
      <PageHeader title="Boshqaruv paneli" subtitle="Foydalanuvchilar va faollik ko‘rsatkichlari (30 soniyada yangilanadi)"
        actions={<Btn onClick={reload} disabled={refreshing}><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> Yangilash</Btn>} />
      {error && !data && <ErrorBox message={error} onRetry={reload} />}
      {loading && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
      )}
      {data && <Body d={data} />}
    </>
  );
}

function Body({ d }: { d: Overview }) {
  const u = d.users;
  const max = Math.max(1, ...d.topHabits.map((h) => h.count));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Jami foydalanuvchi" value={u.total} sub={`+${fmtNum(u.new24)} bugun · +${fmtNum(u.new7)} 7 kunda`} tone="accent" />
        <Stat label="Bugun faol (DAU)" value={u.dau} sub={`${pct(u.dau, u.total)}% foydalanuvchilar`} />
        <Stat label="Haftalik faol (WAU)" value={u.wau} sub={`${pct(u.wau, u.total)}%`} />
        <Stat label="Oylik faol (MAU)" value={u.mau} sub={`${pct(u.mau, u.total)}%`} />
        <Stat label="Faol odatlar" value={d.habits.active} sub={`jami ${fmtNum(d.habits.total)} ta yaratilgan`} />
        <Stat label="Jami bajarilishlar" value={d.habits.completions} tone="ok" />
        <Stat label="Bloklangan" value={u.banned} sub="admin tomonidan" tone={u.banned ? 'bad' : undefined} />
        <Stat label="Botni to‘xtatgan" value={u.blocked} sub="xabar yetmaydi" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Yangi foydalanuvchilar" hint="oxirgi 30 kun">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.series} margin={{ left: -24, right: 8, top: 8 }}>
                <defs><linearGradient id="gs" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f08a31" stopOpacity={0.5} /><stop offset="100%" stopColor="#f08a31" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid stroke="#2f2f33" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickFormatter={short} tick={tick} tickLine={false} axisLine={false} interval={4} />
                <YAxis allowDecimals={false} tick={tick} tickLine={false} axisLine={false} />
                <Tooltip {...tip} formatter={(v: number) => [v, 'Yangi']} />
                <Area type="monotone" dataKey="signups" stroke="#f08a31" strokeWidth={2} fill="url(#gs)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Bajarilgan odatlar" hint="oxirgi 30 kun">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.series} margin={{ left: -24, right: 8, top: 8 }}>
                <CartesianGrid stroke="#2f2f33" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickFormatter={short} tick={tick} tickLine={false} axisLine={false} interval={4} />
                <YAxis allowDecimals={false} tick={tick} tickLine={false} axisLine={false} />
                <Tooltip {...tip} cursor={{ fill: '#ffffff0d' }} formatter={(v: number) => [v, 'Bajarildi']} />
                <Bar dataKey="completions" fill="#5fcf8a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Eng ko‘p odatlar" hint="nom bo‘yicha">
          {d.topHabits.length === 0 ? <p className="text-sm text-muted">Hali odat yo‘q</p> : (
            <ul className="space-y-3">
              {d.topHabits.map((h) => (
                <li key={h.name}>
                  <div className="mb-1 flex justify-between gap-3 text-sm"><span className="truncate capitalize">{h.name}</span><span className="tabular-nums text-muted">{fmtNum(h.count)}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-raised"><div className="h-full rounded-full bg-accent" style={{ width: `${(h.count / max) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Funksiyalardan foydalanish" hint="foydalanuvchilar ulushi">
          <ul className="space-y-3">
            {[['Odat eslatmalari', u.reminders], ['Ertalabki reja', u.morning], ['Kechki xulosa', u.evening]].map(([label, n]) => (
              <li key={label as string}>
                <div className="mb-1 flex justify-between text-sm"><span>{label}</span><span className="tabular-nums text-muted">{fmtNum(n as number)} · {pct(n as number, u.total)}%</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-raised"><div className="h-full rounded-full bg-ok" style={{ width: `${pct(n as number, u.total)}%` }} /></div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
