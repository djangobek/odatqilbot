'use client';
import { useEffect, useState } from 'react';
import { Bell, Globe, MoonStar, Send, Sunrise } from 'lucide-react';
import clsx from 'clsx';
import { useMe, type Me } from '@/components/AuthProvider';
import { api } from '@/lib/api';
import { success, tap } from '@/lib/haptics';
import { t } from '@/lib/i18n';

type Key = 'remindersEnabled' | 'morningDigest' | 'eveningDigest';
type Cfg = { botUrl: string | null; supportUrl: string | null; channelUrl: string | null };

export default function SettingsPage() {
  const { me, setMe, toast } = useMe();
  const [busy, setBusy] = useState<string | null>(null);
  const [cfg, setCfg] = useState<Cfg | null>(null);
  useEffect(() => { api<Cfg>('/api/config', { auth: false }).then(setCfg).catch(() => {}); }, []);

  async function patch(body: Partial<Record<Key, boolean>> & { timezone?: string }, id: string) {
    setBusy(id);
    try {
      setMe(await api<Me>('/api/me', { method: 'PATCH', body }));
      success();
      toast(t.saved);
    } catch (e) { toast((e as Error).message, 'err'); }
    finally { setBusy(null); }
  }

  const rows: { k: Key; title: string; hint: string; Icon: typeof Bell }[] = [
    { k: 'remindersEnabled', title: t.remindersSetting, hint: t.remindersHint, Icon: Bell },
    { k: 'morningDigest', title: t.morningSetting, hint: t.morningHint, Icon: Sunrise },
    { k: 'eveningDigest', title: t.eveningSetting, hint: t.eveningHint, Icon: MoonStar },
  ];
  const deviceTz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : me.user.timezone;

  return (
    <>
      <h1 className="mb-4 text-center text-2xl font-extrabold">{t.settings}</h1>
      <section className="overflow-hidden rounded-xl2 bg-surface">
        {rows.map(({ k, title, hint, Icon }, i) => {
          const on = me.user[k];
          return (
            <button key={k} role="switch" aria-checked={on} disabled={busy === k} onClick={() => { tap(); patch({ [k]: !on }, k); }}
              className={clsx('flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-raised/60', i > 0 && 'border-t border-line')}>
              <span className={clsx('grid h-10 w-10 shrink-0 place-items-center rounded-xl', on ? 'bg-accent-soft text-accent' : 'bg-raised text-muted')}><Icon size={20} /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{title}</span>
                <span className="block text-xs text-muted">{hint}</span>
              </span>
              <span className={clsx('relative h-7 w-12 shrink-0 rounded-full transition-colors', on ? 'bg-accent' : 'bg-raised')}>
                <span className={clsx('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all', on ? 'left-[22px]' : 'left-0.5')} />
              </span>
            </button>
          );
        })}
      </section>

      <section className="mt-4 rounded-xl2 bg-surface px-4 py-3.5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-raised text-muted"><Globe size={20} /></span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{t.timezoneLabel}</p>
            <p className="truncate text-sm text-muted">{me.user.timezone}</p>
          </div>
          {deviceTz && deviceTz !== me.user.timezone && (
            <button disabled={busy === 'tz'} onClick={() => patch({ timezone: deviceTz }, 'tz')} className="shrink-0 rounded-full bg-accent-soft px-3.5 py-2 text-sm font-semibold text-accent active:scale-95">{t.timezoneAuto}</button>
          )}
        </div>
      </section>

      {(cfg?.botUrl || cfg?.supportUrl || cfg?.channelUrl) && (
        <section className="mt-4 rounded-xl2 bg-surface px-4 py-3.5">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted"><Send size={16} />{t.botSection}</p>
          <div className="flex flex-wrap gap-2">
            {cfg.botUrl && <a href={cfg.botUrl} className="rounded-full bg-accent px-4 py-2 text-sm font-bold text-black active:scale-95">{t.openBot}</a>}
            {cfg.supportUrl && <a href={cfg.supportUrl} className="rounded-full bg-raised px-4 py-2 text-sm font-semibold active:scale-95">💬</a>}
            {cfg.channelUrl && <a href={cfg.channelUrl} className="rounded-full bg-raised px-4 py-2 text-sm font-semibold active:scale-95">📣</a>}
          </div>
        </section>
      )}
    </>
  );
}
