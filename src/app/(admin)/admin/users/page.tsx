'use client';
import { useCallback, useEffect, useState } from 'react';
import { Ban, Download, Search, Send, ShieldCheck, ShieldOff, Trash2, UserCheck } from 'lucide-react';
import clsx from 'clsx';
import { useMe } from '@/components/AuthProvider';
import { ConfirmDialog, Modal } from '@/components/Modal';
import { ApiError, api, getToken, useApi } from '@/lib/api';
import { Badge, Btn, ErrorBox, Pager, PageHeader, Skeleton, fmtDateTime, fmtNum, inputCls, timeAgo } from '@/components/admin/ui';

type Row = {
  id: number; telegramId: number; displayName: string; username: string | null; role: 'user' | 'admin'; banned: boolean; banReason: string | null;
  botBlocked: boolean; timezone: string; createdAt: number; lastSeenAt: number | null; habits: number; completed: number; superAdmin: boolean;
};
type List = { users: Row[]; total: number; page: number; pageSize: number };
type Detail = { user: Row; habits: { id: number; name: string; icon: string | null; archived: boolean; reminderTime: string | null }[]; lastCompletedDate: string | null };

const FILTERS = [
  ['all', 'Hammasi'], ['active7', 'Faol (7 kun)'], ['new7', 'Yangi (7 kun)'], ['inactive', 'Nofaol'], ['banned', 'Bloklangan'], ['admins', 'Adminlar'], ['blocked', 'Botni to‘xtatgan'],
] as const;

export default function UsersPage() {
  const { toast } = useMe();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>('all');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => { const id = setTimeout(() => { setDebounced(q); setPage(1); }, 350); return () => clearTimeout(id); }, [q]);
  const path = `/api/admin/users?${new URLSearchParams({ q: debounced, filter, page: String(page) })}`;
  const { data, error, loading, refreshing, reload } = useApi<List>(path);

  async function exportCsv() {
    try {
      const res = await fetch('/api/admin/users/export', { headers: { Authorization: `Bearer ${getToken() ?? ''}` } });
      if (!res.ok) throw new Error('Eksport amalga oshmadi');
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url; a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) { toast((e as Error).message, 'err'); }
  }

  return (
    <>
      <PageHeader title="Foydalanuvchilar" subtitle={data ? `${fmtNum(data.total)} ta natija` : 'Qidirish, bloklash, rollar va xabar yuborish'}
        actions={<Btn onClick={exportCsv}><Download size={16} /> CSV</Btn>} />

      <div className="relative mb-3">
        <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ism, @username yoki Telegram ID" className={clsx(inputCls, 'pl-10')} aria-label="Qidirish" />
      </div>
      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {FILTERS.map(([k, label]) => (
          <button key={k} onClick={() => { setFilter(k); setPage(1); }} aria-pressed={filter === k}
            className={clsx('shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition', filter === k ? 'bg-accent text-black' : 'bg-surface text-muted hover:text-white')}>
            {label}
          </button>
        ))}
      </div>

      {error && !data && <ErrorBox message={error} onRetry={reload} />}
      {loading && <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[72px]" />)}</div>}
      {data && (
        <div className={clsx('space-y-2 transition-opacity', refreshing && 'opacity-60')}>
          {data.users.length === 0 && <p className="rounded-xl2 border border-dashed border-line p-8 text-center text-muted">Hech narsa topilmadi</p>}
          {data.users.map((u) => (
            <button key={u.id} onClick={() => setOpenId(u.id)} className="flex w-full items-center gap-3 rounded-xl2 border border-line bg-surface p-3 text-left transition hover:border-accent/40 active:scale-[.995]">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-raised text-lg font-bold uppercase text-accent">{u.displayName.slice(0, 1)}</span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate font-semibold">{u.displayName}</span>
                  {u.role === 'admin' && <Badge tone="accent">ADMIN</Badge>}
                  {u.banned && <Badge tone="bad">BLOK</Badge>}
                  {u.botBlocked && <Badge>bot to‘xtatilgan</Badge>}
                </span>
                <span className="block truncate text-xs text-muted">{u.username ? `@${u.username} · ` : ''}ID {u.telegramId}</span>
              </span>
              <span className="hidden shrink-0 text-right text-xs text-muted sm:block">
                <span className="block tabular-nums text-white">{fmtNum(u.habits)} odat · {fmtNum(u.completed)} bajarilgan</span>
                <span className="block">faol: {timeAgo(u.lastSeenAt)}</span>
              </span>
            </button>
          ))}
          <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </div>
      )}
      {openId !== null && <UserSheet id={openId} onClose={() => setOpenId(null)} onChanged={reload} />}
    </>
  );
}

function UserSheet({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const { me, toast } = useMe();
  const { data, error, setData } = useApi<Detail>(`/api/admin/users/${id}`);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<null | 'ban' | 'message' | 'delete'>(null);
  const [reason, setReason] = useState('');
  const [text, setText] = useState('');

  const run = useCallback(async (fn: () => Promise<void>, okMsg: string) => {
    setBusy(true);
    try { await fn(); toast(okMsg); onChanged(); setMode(null); }
    catch (e) { toast(e instanceof ApiError ? e.message : 'Xatolik', 'err'); }
    finally { setBusy(false); }
  }, [toast, onChanged]);

  const act = (action: 'ban' | 'unban' | 'promote' | 'demote', okMsg: string) =>
    run(async () => { setData(await api<Detail>(`/api/admin/users/${id}`, { method: 'PATCH', body: { action, reason: action === 'ban' ? reason : undefined } })); }, okMsg);

  const u = data?.user;
  const self = u?.id === me.user.id;

  if (mode === 'delete' && u)
    return <ConfirmDialog title="Foydalanuvchini o‘chirasizmi?" text={`${u.displayName} va uning barcha odatlari, yozuvlari butunlay o‘chadi. Bu qaytarilmaydi.`} confirmLabel="O‘chirish" onClose={() => setMode(null)}
      onConfirm={() => run(async () => { await api(`/api/admin/users/${id}`, { method: 'DELETE' }); onClose(); }, 'O‘chirildi')} />;

  return (
    <Modal title={u?.displayName ?? 'Foydalanuvchi'} onClose={onClose}>
      {error && <ErrorBox message={error} />}
      {!data && !error && <Skeleton className="h-40" />}
      {data && u && (
        <div className="space-y-4 pb-2">
          <div className="flex flex-wrap gap-1.5">
            {u.role === 'admin' ? <Badge tone="accent">ADMIN{u.superAdmin ? ' · bosh' : ''}</Badge> : <Badge>foydalanuvchi</Badge>}
            {u.banned && <Badge tone="bad">bloklangan</Badge>}
            {u.botBlocked && <Badge>botni to‘xtatgan</Badge>}
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            {([['Telegram ID', String(u.telegramId)], ['Username', u.username ? `@${u.username}` : '—'], ['Vaqt mintaqasi', u.timezone], ['Ro‘yxatdan o‘tgan', fmtDateTime(u.createdAt)],
              ['Oxirgi faollik', timeAgo(u.lastSeenAt)], ['Oxirgi bajarilgan', data.lastCompletedDate ?? '—'], ['Faol odatlar', fmtNum(u.habits)], ['Bajarilganlar', fmtNum(u.completed)]] as const)
              .map(([k, v]) => <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="break-words font-semibold">{v}</dd></div>)}
          </dl>
          {u.banned && u.banReason && <p className="rounded-xl bg-bad/10 p-3 text-sm text-bad">Sabab: {u.banReason}</p>}

          {data.habits.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Odatlar</p>
              <ul className="flex flex-wrap gap-1.5">
                {data.habits.slice(0, 20).map((h) => (
                  <li key={h.id} className={clsx('rounded-full bg-raised px-2.5 py-1 text-xs', h.archived && 'opacity-50')}>{h.icon ? `${h.icon} ` : ''}{h.name}{h.reminderTime ? ` · ${h.reminderTime}` : ''}</li>
                ))}
                {data.habits.length > 20 && <li className="px-1 py-1 text-xs text-muted">+{data.habits.length - 20}</li>}
              </ul>
            </div>
          )}

          {mode === 'ban' && (
            <div className="space-y-2 rounded-xl2 border border-line p-3">
              <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="Sabab (ixtiyoriy, foydalanuvchiga ko‘rsatiladi)" className={inputCls} />
              <div className="flex gap-2"><Btn onClick={() => setMode(null)} className="flex-1">Bekor</Btn><Btn tone="danger" disabled={busy} onClick={() => act('ban', 'Bloklandi')} className="flex-1">Bloklash</Btn></div>
            </div>
          )}
          {mode === 'message' && (
            <div className="space-y-2 rounded-xl2 border border-line p-3">
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={3500} placeholder="Xabar matni… {name} — ismi, **qalin**, __qiya__" className={inputCls} />
              <div className="flex gap-2"><Btn onClick={() => setMode(null)} className="flex-1">Bekor</Btn>
                <Btn tone="primary" disabled={busy || !text.trim()} className="flex-1"
                  onClick={() => run(async () => { await api('/api/admin/broadcasts', { method: 'POST', body: { text, audience: `user:${id}` } }); setText(''); }, 'Xabar navbatga qo‘yildi')}><Send size={16} /> Yuborish</Btn></div>
            </div>
          )}

          {!mode && !self && (
            <div className="grid grid-cols-2 gap-2">
              <Btn onClick={() => setMode('message')} disabled={u.banned || u.botBlocked}><Send size={16} /> Xabar</Btn>
              {u.banned
                ? <Btn onClick={() => act('unban', 'Blok olib tashlandi')} disabled={busy}><UserCheck size={16} /> Blokdan chiqarish</Btn>
                : <Btn tone="danger" onClick={() => setMode('ban')} disabled={u.role === 'admin'}><Ban size={16} /> Bloklash</Btn>}
              {u.role === 'admin'
                ? <Btn onClick={() => act('demote', 'Adminlik olib tashlandi')} disabled={busy || u.superAdmin}><ShieldOff size={16} /> Adminlikdan olish</Btn>
                : <Btn onClick={() => act('promote', 'Admin qilindi')} disabled={busy || u.banned}><ShieldCheck size={16} /> Admin qilish</Btn>}
              <Btn tone="danger" onClick={() => setMode('delete')} disabled={u.role === 'admin'}><Trash2 size={16} /> O‘chirish</Btn>
            </div>
          )}
          {self && <p className="text-center text-xs text-muted">Bu sizning hisobingiz</p>}
        </div>
      )}
    </Modal>
  );
}
