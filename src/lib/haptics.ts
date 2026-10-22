'use client';
/** Thin wrapper over Telegram haptics; silently does nothing outside Telegram. */
const h = () => window.Telegram?.WebApp?.HapticFeedback;
export const tap = () => { try { h()?.impactOccurred('light'); } catch { /* ignore */ } };
export const success = () => { try { h()?.notificationOccurred('success'); } catch { /* ignore */ } };
export const warn = () => { try { h()?.notificationOccurred('error'); } catch { /* ignore */ } };
