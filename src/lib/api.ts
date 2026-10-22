'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

const KEY = 'dos_token';
let token: string | null = null;
let reauth: (() => Promise<boolean>) | null = null;

export const getToken = () => {
  if (token) return token;
  try { token = sessionStorage.getItem(KEY); } catch { /* storage unavailable */ }
  return token;
};
export const setToken = (t: string) => {
  token = t;
  try { sessionStorage.setItem(KEY, t); } catch { /* ignore */ }
};
/** Registered by AuthProvider: obtains a fresh token (Telegram initData) after a 401. */
export const setReauth = (fn: (() => Promise<boolean>) | null) => { reauth = fn; };

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

type Opts = { method?: string; body?: unknown; auth?: boolean };

async function request<T>(path: string, opts: Opts): Promise<{ ok: boolean; status: number; data: T }> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const tk = getToken();
  if (opts.auth !== false && tk) headers.Authorization = `Bearer ${tk}`;
  let res: Response;
  try {
    res = await fetch(path, { method: opts.method ?? 'GET', headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body), cache: 'no-store' });
  } catch {
    throw new ApiError(0, 'Internet aloqasi yo‘q');
  }
  const data = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, data };
}

export async function api<T>(path: string, opts: Opts = {}): Promise<T> {
  let r = await request<T>(path, opts);
  // Session expired while the app was open: renew once and retry.
  if (r.status === 401 && opts.auth !== false && reauth && (await reauth())) r = await request<T>(path, opts);
  if (!r.ok) throw new ApiError(r.status, (r.data as { error?: string }).error ?? 'Xatolik');
  return r.data;
}

export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(path !== null);
  const [n, setN] = useState(0);
  const seq = useRef(0);
  useEffect(() => {
    if (!path) return;
    const id = ++seq.current;
    setError(null);
    setFetching(true);
    api<T>(path)
      .then((d) => { if (id === seq.current) { setData(d); setFetching(false); } })
      .catch((e: Error) => { if (id === seq.current) { setError(e.message); setFetching(false); } });
    return () => { seq.current++; };
  }, [path, n]);
  const reload = useCallback(() => setN((x) => x + 1), []);
  /** loading: first load without data. refreshing: data on screen is being replaced. */
  return { data, setData, error, loading: fetching && !data, refreshing: fetching && !!data, reload };
}
