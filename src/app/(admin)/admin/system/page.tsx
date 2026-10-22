'use client';
import { useEffect, useState } from 'react';
import { Activity, Database, Megaphone, Wrench } from 'lucide-react';
import { useMe } from '@/components/AuthProvider';
import { ApiError, api, useApi } from '@/lib/api';
import { Badge, Btn, Card, ErrorBox, PageHeader, Skeleton, Stat, Toggle, fmtDateTime, inputCls } from '@/components/admin/ui';

type Data = {
  settings: { maintenance: boolean; maintenanceMessage: string; announcement: string };
  health: { dbMs: number; queuePending: number; uptimeSec: number; node: string; botConfigured: boolean; appUrl: string | null; superAdmins: number };
  audit: { id: number; adminName: string; action: string; target: string | null; detail: string | null; createdAt: number }[];
};

const ACTIONS: Record<string, string> = {
  ban: 'Bloklash', unban: 'Blokdan chiqarish', promote: 'Admin qilish', demote: 'Adminlikdan olish', delete_user: 'Foydalanuvchini o‘chirish',
  broadcast: 'Xabar yuborish', broadcast_cancel: 'Xabarni bekor qilish', settings: 'Sozlamalar', export_users: 'CSV eksport',
};

function uptime(s: number) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d ? `${d}k ${h}s` : h ? `${h}s ${m}d` : `${m} daqiqa`;
}

export default function SystemPage() {
  const { toast } = useMe();
  const { data, error, loading, setData, reload } = useApi<Data>('/api/admin/system');
  const [msg, setMsg] = useState('');
  const [ann, setAnn] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (data) { setMsg(data.settings.maintenanceMessage); setAnn(data.settings.announcement); } }, [data?.settings.maintenanceMessage, data?.settings.announcement]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(patch: Partial<Data['settings']>, ok: string) {
    setBusy(true);
    try { setData(await api<Data>('/api/admin/system', { method: 'PUT', body: patch })); toast(ok); }
    catch (e) { toast(e instanceof ApiError ? e.message : 'Xatolik', 'err'); }
    finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader title="Tizim" subtitle="Texnik ishlar rejimi, e’lon, salomatlik va admin harakatlari jurnali" actions={<Btn onClick={reload}>Yangilash</Btn>} />
      {error && !data && <ErrorBox message={error} onRetry={reload} />}
      {loading && <Skeleton className="h-48" />}
      {data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Baza javobi" value={`${data.health.dbMs} ms`} tone={data.health.dbMs > 500 ? 'bad' : 'ok'} />
            <Stat label="Xabar navbati" value={data.health.queuePending} sub="yuborilmagan" />
            <Stat label="Server ishlash vaqti" value={uptime(data.health.uptimeSec)} sub={data.health.node} />
            <Stat label="Bosh adminlar" value={data.health.superAdmins} sub="ADMIN_TELEGRAM_IDS" />
          </div>
          <Card title="Konfiguratsiya" hint="serverdan">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge tone={data.health.botConfigured ? 'ok' : 'bad'}>BOT_TOKEN {data.health.botConfigured ? 'bor' : 'yo‘q'}</Badge>
              <Badge tone={data.health.appUrl ? 'ok' : 'bad'}>{data.health.appUrl ?? 'WEB_APP_URL yo‘q'}</Badge>
              <Badge tone="ok"><Database size={12} className="mr-1" /> baza ulangan</Badge>
              <Badge tone="muted"><Activity size={12} className="mr-1" /> xabarlar botda yuboriladi — bot ishlab turishi kerak</Badge>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Texnik ishlar rejimi">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent"><Wrench size={20} /></span>
                <div className="min-w-0 flex-1"><p className="font-semibold">Ilovani vaqtincha yopish</p><p className="text-xs text-muted">Adminlardan boshqa hamma xabarni ko‘radi. Bot eslatmalari ishlayveradi.</p></div>
                <Toggle on={data.settings.maintenance} disabled={busy} label="Texnik ishlar" onChange={(v) => save({ maintenance: v }, v ? 'Texnik ishlar yoqildi' : 'Ilova ochildi')} />
              </div>
              <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={2} maxLength={300} className={`${inputCls} mt-3`} aria-label="Texnik ishlar xabari" />
              <Btn className="mt-2" disabled={busy || !msg.trim() || msg === data.settings.maintenanceMessage} onClick={() => save({ maintenanceMessage: msg }, 'Saqlandi')}>Xabarni saqlash</Btn>
            </Card>
            <Card title="Ilova ichidagi e’lon">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent"><Megaphone size={20} /></span>
                <p className="text-xs text-muted">Matn barcha foydalanuvchilarga ilovaning yuqorisida ko‘rinadi. Bo‘sh qoldirsangiz — o‘chadi.</p>
              </div>
              <textarea value={ann} onChange={(e) => setAnn(e.target.value)} rows={3} maxLength={300} placeholder="Masalan: Shanba kuni 02:00 da texnik ishlar bo‘ladi" className={`${inputCls} mt-3`} aria-label="E’lon" />
              <div className="mt-2 flex gap-2">
                <Btn tone="primary" disabled={busy || ann === data.settings.announcement} onClick={() => save({ announcement: ann }, ann.trim() ? 'E’lon saqlandi' : 'E’lon o‘chirildi')}>Saqlash</Btn>
                {data.settings.announcement && <Btn disabled={busy} onClick={() => { setAnn(''); save({ announcement: '' }, 'E’lon o‘chirildi'); }}>O‘chirish</Btn>}
              </div>
            </Card>
          </div>

          <Card title="Admin harakatlari jurnali" hint="oxirgi 100 ta">
            {data.audit.length === 0 ? <p className="text-sm text-muted">Hali harakat yo‘q</p> : (
              <ul className="divide-y divide-line">
                {data.audit.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2.5 text-sm">
                    <span className="font-semibold">{ACTIONS[a.action] ?? a.action}</span>
                    {a.target && <span className="text-accent">{a.target}</span>}
                    {a.detail && <span className="min-w-0 max-w-full truncate text-muted">{a.detail}</span>}
                    <span className="ml-auto text-xs text-muted">{a.adminName} · {fmtDateTime(a.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
