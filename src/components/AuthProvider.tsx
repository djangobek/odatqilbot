'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, setReauth, setToken } from '@/lib/api';
import { t } from '@/lib/i18n';

export type Me = { user: { id: number; displayName: string; timezone: string; language: string }; today: string };
type Ctx = { me: Me; toast: (msg: string, kind?: 'ok' | 'err') => void };
type PublicConfig = { botUrl: string | null; supportUrl: string | null; channelUrl: string | null };
const AuthCtx = createContext<Ctx | null>(null);

export const useMe = () => {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('useMe outside AuthProvider');
  return c;
};

async function login(): Promise<boolean> {
  const tg = window.Telegram?.WebApp;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (tg?.initData) {
    const r = await api<{ token: string }>('/api/auth/telegram', { method: 'POST', body: { initData: tg.initData, timezone }, auth: false });
    setToken(r.token);
    return true;
  }
  try {
    const r = await api<{ token: string }>('/api/auth/dev', { method: 'POST', auth: false });
    setToken(r.token);
    return true;
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'telegram' | 'error'>('loading');
  const [msg, setMsg] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null);
  const [cfg, setCfg] = useState<PublicConfig | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const toast = useCallback((text: string, kind: 'ok' | 'err' = 'ok') => {
    window.clearTimeout(timer.current);
    setMsg({ text, kind });
    timer.current = window.setTimeout(() => setMsg(null), 2400);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const tg = window.Telegram?.WebApp;
        tg?.ready();
        tg?.expand?.();
        tg?.disableVerticalSwipes?.();
        tg?.setHeaderColor?.('#000000');
        tg?.setBackgroundColor?.('#000000');
        if (!(await login())) {
          setCfg(await api<PublicConfig>('/api/config', { auth: false }).catch(() => null));
          setState('telegram');
          return;
        }
        setReauth(login);
        setMe(await api<Me>('/api/me'));
        setState('ready');
      } catch (e) {
        setMsg({ text: (e as Error).message, kind: 'err' });
        setState('error');
      }
    })();
    return () => setReauth(null);
  }, []);

  // The app can stay open across midnight: refresh "today" whenever it becomes visible again.
  useEffect(() => {
    if (state !== 'ready') return;
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      api<Me>('/api/me').then((next) => setMe((cur) => (cur && cur.today === next.today && cur.user.timezone === next.user.timezone ? cur : next))).catch(() => {});
    };
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, [state]);

  const value = useMemo(() => (me ? { me, toast } : null), [me, toast]);

  if (state === 'loading')
    return (
      <div className="grid min-h-dvh place-items-center" role="status" aria-label={t.loading}>
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-raised border-t-accent" />
      </div>
    );
  if (state === 'telegram')
    return (
      <div className="grid min-h-dvh place-items-center p-8 text-center">
        <div className="max-w-sm">
          <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-accent-soft text-3xl" aria-hidden>🎯</div>
          <p className="text-xl font-bold">{t.openInTelegram}</p>
          <p className="mt-2 text-muted">{t.openInTelegramText}</p>
          {cfg?.botUrl && <a href={cfg.botUrl} className="mt-6 inline-block rounded-full bg-accent px-6 py-3 font-bold text-black">{t.openBot}</a>}
        </div>
      </div>
    );
  if (state === 'error' || !value)
    return (
      <div className="grid min-h-dvh place-items-center p-8 text-center">
        <div>
          <p className="text-lg font-semibold">{t.error}</p>
          <p className="mt-1 text-muted">{msg?.text}</p>
          <button className="mt-4 rounded-full bg-accent px-5 py-2.5 font-semibold text-black" onClick={() => location.reload()}>{t.retry}</button>
        </div>
      </div>
    );

  return (
    <AuthCtx.Provider value={value}>
      {children}
      {msg && (
        <div role="status" className={`pop fixed left-1/2 top-[max(env(safe-area-inset-top),1rem)] z-[60] -translate-x-1/2 rounded-full px-4 py-2 text-sm font-semibold shadow-lg ${msg.kind === 'ok' ? 'bg-raised text-white' : 'bg-bad text-black'}`}>
          {msg.text}
        </div>
      )}
    </AuthCtx.Provider>
  );
}
