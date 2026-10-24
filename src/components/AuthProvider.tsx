'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, api, setReauth, setToken } from '@/lib/api';
import { setLanguage, t } from '@/lib/i18n';

export type Me = {
  user: { id: number; displayName: string; timezone: string; language: string; remindersEnabled: boolean; morningDigest: boolean; eveningDigest: boolean; role: 'user' | 'admin' };
  today: string;
  announcement?: string | null;
};
export type Section = { id: number; name: string; position: number };
type Ctx = {
  me: Me;
  toast: (msg: string, kind?: 'ok' | 'err') => void;
  sections: Section[];
  reloadSections: () => Promise<void>;
  setMe: (next: Me) => void;
};
type PublicConfig = { botUrl: string | null; supportUrl: string | null; channelUrl: string | null };
const AuthCtx = createContext<Ctx | null>(null);

export const useMe = () => {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('useMe outside AuthProvider');
  return c;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Telegram's script is loaded asynchronously on some clients, so initData can be empty for a moment.
 * It is also present in the URL fragment (#tgWebAppData=...), which works even if the script failed to load.
 */
async function readInitData(): Promise<string> {
  for (let i = 0; i < 15; i++) {
    const fromScript = window.Telegram?.WebApp?.initData;
    if (fromScript) return fromScript;
    try {
      const fromHash = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('tgWebAppData');
      if (fromHash) return fromHash;
    } catch { /* ignore */ }
    await sleep(100);
  }
  return '';
}

async function login(): Promise<boolean> {
  const initData = await readInitData();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (initData) {
    // Errors (with a short code) propagate so the person sees why sign-in failed.
    const r = await api<{ token: string }>('/api/auth/telegram', { method: 'POST', body: { initData, timezone }, auth: false });
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
  const [sections, setSections] = useState<Section[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'telegram' | 'error'>('loading');
  const [msg, setMsg] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null);
  const [failure, setFailure] = useState<{ text: string; code?: string } | null>(null);
  const [cfg, setCfg] = useState<PublicConfig | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const toast = useCallback((text: string, kind: 'ok' | 'err' = 'ok') => {
    window.clearTimeout(timer.current);
    setMsg({ text, kind });
    timer.current = window.setTimeout(() => setMsg(null), 2400);
  }, []);

  const reloadSections = useCallback(async () => {
    const r = await api<{ sections: Section[] }>('/api/sections');
    setSections(r.sections);
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
        setReauth(() => login().catch(() => false));
        const [m, s] = await Promise.all([api<Me>('/api/me'), api<{ sections: Section[] }>('/api/sections')]);
        setMe(m);
        if (m.user.language === 'ru' || m.user.language === 'uz') setLanguage(m.user.language);
        setSections(s.sections);
        setState('ready');
      } catch (e) {
        setFailure({ text: (e as Error).message, code: e instanceof ApiError ? e.code : undefined });
        setCfg(await api<PublicConfig>('/api/config', { auth: false }).catch(() => null));
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
      api<Me>('/api/me').then((next) => setMe((cur) => { if (next.user.language === 'ru' || next.user.language === 'uz') setLanguage(next.user.language); return cur && cur.today === next.today && cur.user.timezone === next.user.timezone && cur.user.language === next.user.language ? cur : next; })).catch(() => {});
    };
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, [state]);

  const value = useMemo(() => (me ? { me, toast, sections, reloadSections, setMe } : null), [me, toast, sections, reloadSections]);

  if (state === 'loading')
    return (
      <div className="grid min-h-dvh place-items-center" role="status" aria-label={t.loading}>
        <div className="flex flex-col items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-[22px] bg-accent-soft text-3xl shadow-[0_0_40px_-8px_#f08a31]" aria-hidden>🎯</div>
          <div className="h-1 w-24 overflow-hidden rounded-full bg-raised"><div className="h-full w-1/2 animate-[slide_1s_ease-in-out_infinite] rounded-full bg-accent" /></div>
        </div>
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
        <div className="max-w-sm">
          <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-bad/15 text-3xl" aria-hidden>🔒</div>
          <p className="text-lg font-bold">{t.authFailed}</p>
          <p className="mt-2 text-muted">{failure?.text}</p>
          {failure?.code && <p className="mt-2 text-xs text-muted/70">{t.code}: {failure.code}</p>}
          <div className="mt-5 flex flex-col items-center gap-3">
            <button className="rounded-full bg-accent px-6 py-3 font-bold text-black active:scale-95" onClick={() => location.reload()}>{t.retry}</button>
            {cfg?.botUrl && <a href={cfg.botUrl} className="text-sm font-semibold text-accent">{t.openBot}</a>}
          </div>
        </div>
      </div>
    );

  return (
    <AuthCtx.Provider value={value}>
      {children}
      {msg && (
        <div role="status" className={`pop fixed left-1/2 top-[max(env(safe-area-inset-top),1rem)] z-[70] -translate-x-1/2 rounded-full px-4 py-2 text-sm font-semibold shadow-lg ${msg.kind === 'ok' ? 'bg-raised text-white' : 'bg-bad text-black'}`}>
          {msg.text}
        </div>
      )}
    </AuthCtx.Provider>
  );
}
