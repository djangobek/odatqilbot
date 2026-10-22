'use client';
import { useEffect, useMemo } from 'react';

const COLORS = ['#f08a31', '#ffa24f', '#5fcf8a', '#ffffff', '#f2c14e'];

/** One-shot celebration (CSS only, ~2.5s). Respects reduced-motion through the global media query. */
export function Confetti({ onDone }: { onDone: () => void }) {
  const bits = useMemo(() => Array.from({ length: 36 }, (_, i) => ({
    left: `${(i * 97) % 100}%`, bg: COLORS[i % COLORS.length], dur: `${1.6 + ((i * 37) % 10) / 10}s`,
    dx: `${((i * 53) % 160) - 80}px`, rot: `${360 + ((i * 71) % 540)}deg`, delay: `${((i * 13) % 30) / 100}s`,
  })), []);
  useEffect(() => { const id = window.setTimeout(onDone, 2800); return () => window.clearTimeout(id); }, [onDone]);
  return (
    <div className="confetti" aria-hidden>
      {bits.map((b, i) => (
        <i key={i} style={{ left: b.left, background: b.bg, animationDelay: b.delay, ['--dur' as string]: b.dur, ['--dx' as string]: b.dx, ['--rot' as string]: b.rot }} />
      ))}
    </div>
  );
}
