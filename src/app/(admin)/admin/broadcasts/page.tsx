'use client';
import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Send, XCircle } from 'lucide-react';
import clsx from 'clsx';
import { useMe } from '@/components/AuthProvider';
import { ConfirmDialog } from '@/components/Modal';
import { ApiError, api, useApi } from '@/lib/api';
import { Badge, Btn, Card, ErrorBox, PageHeader, Skeleton, fmtDateTime, fmtNum, inputCls } from '@/components/admin/ui';

type B = {
  id: number; text: string; audience: string; status: 'scheduled' | 'queued' | 'sending' | 'done' | 'cancelled'; total: number; sent: number; failed: number; blocked: number;
  buttonLabel: string | null; scheduledAt: number | null; startedAt: number | null; finishedAt: number | null; createdAt: number;
};
type Data = { broadcasts: B[]; audiences: { all: number; active: number; inactive: number; admins: number } };

const AUD = [['all', 'Hammaga'], ['active', 'Faol (7 kun)'], ['inactive', 'Nofaol'], ['admins', 'Adminlar'], ['me', 'Faqat menga (test)']] as const;
const STATUS: Record<B['status'], { label: string; tone: 'muted' | 'accent' | 'ok' | 'bad' }> = {
  scheduled: { label: 'Rejalashtirilgan', tone: 'accent' }, queued: { label: 'Navbatda', tone: 'accent' }, sending: { label: 'Yuborilmoqda', tone: 'accent' },
  done: { label: 'Yuborildi', tone: 'ok' }, cancelled: { label: 'Bekor qilindi', tone: 'bad' },
};
const audLabel = (a: string) => (AUD.find(([k]) => k === a)?.[1] ?? (a.startsWith('user:') ? 'Bitta foydalanuvchi' : a));

// Mirrors the server renderer (text is escaped first, so the HTML below is safe).
const preview = (text: string, name: string) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replace(/\*\*(.+?)\*\*/gs, '<b>$1</b>').replace(/__(.+?)__/gs, '<i>$1</i>').replaceAll('{name}', name);

export default function BroadcastsPage() {
  const { me, toast } = useMe();
  const { data, error, loading, reload } = useApi<Data>('/api/admin/broadcasts');
  const [text, setText] = useState('');
  const [audience, setAudience] = useState<(typeof AUD)[number][0]>('all');
  const [btnLabel, setBtnLabel] = useState('');
  const [btnUrl, setBtnUrl] = useState('');
  const [schedule, setSchedule] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cancelId, setCancelId] = useState<number | null>(null);

  const live = data?.broadcasts.some((b) => ['scheduled', 'queued', 'sending'].includes(b.status));
  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(reload, 3000);
    return () => window.clearInterval(id);
  }, [live, reload]);

  const reach = useMemo(() => {
    if (!data) return null;
    const a = data.audiences;
    return audience === 'me' ? 1 : a[audience];
  }, [data, audience]);

  const scheduledAt = schedule ? new Date(schedule).getTime() : null;
  const scheduleBad = scheduledAt !== null && (Number.isNaN(scheduledAt) || scheduledAt < Date.now() - 60_000);
  const firstName = me.user.displayName.split(' ')[0];

  async function send() {
    setBusy(true);
    try {
      await api('/api/admin/broadcasts', { method: 'POST', body: { text, audience, buttonLabel: btnLabel, buttonUrl: btnUrl, scheduledAt } });
      toast(scheduledAt && scheduledAt > Date.now() ? 'Rejalashtirildi' : 'Yuborish boshlandi');
      setText(''); setBtnLabel(''); setBtnUrl(''); setSchedule(''); setConfirm(false);
      reload();
    } catch (e) { toast(e instanceof ApiError ? e.message : 'Xatolik', 'err'); setConfirm(false); }
    finally { setBusy(false); }
  }

  async function cancel(id: number) {
    try { await api(`/api/admin/broadcasts/${id}`, { method: 'DELETE' }); toast('Bekor qilindi'); reload(); }
    catch (e) { toast((e as Error).message, 'err'); }
    setCancelId(null);
  }

  return (
    <>
      <PageHeader title="Xabarlar" subtitle="Foydalanuvchilarga Telegram bot orqali ommaviy xabar yuborish" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card title="Yangi xabar">
          <div className="space-y-4">
            <div>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={7} maxLength={3500} aria-label="Xabar matni"
                placeholder={'Salom, {name}! 👋\n\n**Yangilik:** ilovaga yangi imkoniyat qo‘shildi…'} className={inputCls} />
              <p className="mt-1 flex justify-between text-xs text-muted"><span>{'{name}'} — ism · **qalin** · __qiya__</span><span className="tabular-nums">{text.length}/3500</span></p>
            </div>
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Kimga</p>
              <div className="flex flex-wrap gap-2">
                {AUD.map(([k, label]) => (
                  <button key={k} onClick={() => setAudience(k)} aria-pressed={audience === k}
                    className={clsx('rounded-full px-3.5 py-1.5 text-sm font-semibold transition', audience === k ? 'bg-accent text-black' : 'bg-raised text-muted hover:text-white')}>
                    {label}{data && k !== 'me' ? ` · ${fmtNum(data.audiences[k])}` : ''}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input value={btnLabel} onChange={(e) => setBtnLabel(e.target.value)} maxLength={32} placeholder="Tugma nomi (ixtiyoriy)" className={inputCls} aria-label="Tugma nomi" />
              <input value={btnUrl} onChange={(e) => setBtnUrl(e.target.value)} placeholder="https://… yoki: app" className={inputCls} aria-label="Tugma havolasi" />
            </div>
            <p className="-mt-2 text-xs text-muted">Havola o‘rniga <code className="rounded bg-raised px-1">app</code> yozsangiz, tugma mini-ilovani ochadi.</p>
            <div>
              <label className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted"><CalendarClock size={14} /> Rejalashtirish (ixtiyoriy)</label>
              <input type="datetime-local" value={schedule} onChange={(e) => setSchedule(e.target.value)} className={inputCls} />
              {scheduleBad && <p className="mt-1 text-xs text-bad">Vaqt o‘tib ketgan</p>}
            </div>
            <Btn tone="primary" className="w-full" disabled={busy || !text.trim() || scheduleBad || (!!btnLabel !== !!btnUrl)} onClick={() => setConfirm(true)}>
              <Send size={16} /> {scheduledAt ? 'Rejalashtirish' : 'Yuborish'}{reach !== null ? ` · ${fmtNum(reach)} kishi` : ''}
            </Btn>
          </div>
        </Card>

        <Card title="Ko‘rinishi" className="h-fit lg:sticky lg:top-6">
          <div className="rounded-2xl rounded-tl-sm bg-raised p-3.5 text-[15px] leading-relaxed">
            {text.trim()
              ? <p className="whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: preview(text, firstName) }} />
              : <p className="text-muted">Xabar shu yerda ko‘rinadi…</p>}
          </div>
          {btnLabel && <div className="mt-2 rounded-xl bg-accent-soft py-2 text-center text-sm font-semibold text-accent">{btnLabel}</div>}
        </Card>
      </div>

      <h2 className="mb-3 mt-8 text-sm font-bold uppercase tracking-wider text-muted">Tarix</h2>
      {error && !data && <ErrorBox message={error} onRetry={reload} />}
      {loading && <Skeleton className="h-24" />}
      <div className="space-y-3">
        {data?.broadcasts.length === 0 && <p className="rounded-xl2 border border-dashed border-line p-8 text-center text-muted">Hali xabar yuborilmagan</p>}
        {data?.broadcasts.map((b) => {
          const done = b.sent + b.failed + b.blocked;
          const pct = b.total ? Math.round((done / b.total) * 100) : 0;
          const cancellable = ['scheduled', 'queued', 'sending'].includes(b.status);
          return (
            <article key={b.id} className="rounded-xl2 border border-line bg-surface p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge tone={STATUS[b.status].tone}>{STATUS[b.status].label}</Badge>
                <span className="text-xs text-muted">{audLabel(b.audience)} · {fmtDateTime(b.createdAt)}</span>
                {b.scheduledAt && b.status === 'scheduled' && <span className="text-xs text-accent">→ {fmtDateTime(b.scheduledAt)}</span>}
                {cancellable && <button onClick={() => setCancelId(b.id)} className="ml-auto flex items-center gap-1 text-xs font-semibold text-bad"><XCircle size={14} /> Bekor qilish</button>}
              </div>
              <p className="line-clamp-3 whitespace-pre-wrap break-words text-sm">{b.text}</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-raised"><div className={clsx('h-full rounded-full transition-all', b.status === 'cancelled' ? 'bg-muted' : 'bg-accent')} style={{ width: `${pct}%` }} /></div>
              <p className="mt-2 flex flex-wrap gap-x-4 text-xs tabular-nums text-muted">
                <span>{pct}% · {fmtNum(done)}/{fmtNum(b.total)}</span><span className="text-ok">✓ {fmtNum(b.sent)}</span>
                {b.blocked > 0 && <span>🚫 {fmtNum(b.blocked)} botni to‘xtatgan</span>}{b.failed > 0 && <span className="text-bad">✕ {fmtNum(b.failed)} xato</span>}
              </p>
            </article>
          );
        })}
      </div>

      {confirm && <ConfirmDialog title={scheduledAt ? 'Rejalashtirasizmi?' : 'Xabarni yuborasizmi?'} confirmLabel={busy ? '…' : scheduledAt ? 'Rejalashtirish' : 'Yuborish'} onClose={() => setConfirm(false)} onConfirm={send}
        text={`${audLabel(audience)}: taxminan ${fmtNum(reach ?? 0)} kishiga${scheduledAt ? ` ${fmtDateTime(scheduledAt)} da` : ''} yuboriladi. Yuborilgan xabarni qaytarib bo‘lmaydi.`} />}
      {cancelId !== null && <ConfirmDialog title="Xabarni bekor qilasizmi?" text="Hali yuborilmaganlarga xabar bormaydi. Yuborilganlari qoladi." confirmLabel="Bekor qilish" onClose={() => setCancelId(null)} onConfirm={() => cancel(cancelId)} />}
    </>
  );
}
