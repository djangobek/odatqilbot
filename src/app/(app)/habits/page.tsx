'use client';
import { useState } from 'react';
import { Archive, ArchiveRestore, Pencil, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { useMe } from '@/components/AuthProvider';
import { HabitSheet } from '@/components/HabitSheet';
import { ConfirmDialog } from '@/components/Modal';
import { Fab } from '@/components/Shell';
import { api, useApi } from '@/lib/api';
import { scheduleLabel } from '@/lib/format';
import { t } from '@/lib/i18n';
import { maskAt, type HabitDef } from '@/lib/schedule';

export default function HabitsPage() {
  const { me, toast, sections } = useMe();
  const { data, error, loading, reload } = useApi<{ habits: HabitDef[] }>('/api/habits');
  const [tab, setTab] = useState<'active' | 'archive'>('active');
  const [editing, setEditing] = useState<HabitDef | 'new' | null>(null);
  const [deleting, setDeleting] = useState<HabitDef | null>(null);

  const list = (data?.habits ?? []).filter((h) => (tab === 'active' ? !h.archived : h.archived))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Group by section (in the user's order); habits without a section go last.
  const groups = [
    ...sections.map((x) => ({ key: String(x.id), title: x.name, items: list.filter((h) => h.sectionId === x.id) })),
    { key: 'none', title: t.noSection, items: list.filter((h) => !h.sectionId || !sections.some((x) => x.id === h.sectionId)) },
  ].filter((g) => g.items.length > 0);

  async function archive(h: HabitDef, archived: boolean) {
    try { await api(`/api/habits/${h.id}`, { method: 'PATCH', body: { archived } }); toast(t.saved); reload(); }
    catch (e) { toast((e as Error).message, 'err'); }
  }
  async function remove(h: HabitDef) {
    try { await api(`/api/habits/${h.id}`, { method: 'DELETE' }); setDeleting(null); toast(t.saved); reload(); }
    catch (e) { toast((e as Error).message, 'err'); }
  }

  return (
    <>
      <h1 className="mb-4 text-center text-2xl font-extrabold">{t.navHabits}</h1>
      <div className="mb-4 grid grid-cols-2 rounded-full bg-surface p-1" role="tablist">
        {(['active', 'archive'] as const).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={clsx('h-10 rounded-full font-semibold transition-colors', tab === k ? 'bg-raised text-accent' : 'text-muted')}>
            {k === 'active' ? t.active : t.archive}
          </button>
        ))}
      </div>

      {loading && <p className="py-10 text-center text-muted">{t.loading}</p>}
      {error && <p className="py-10 text-center text-muted">{error} <button onClick={reload} className="text-accent">{t.retry}</button></p>}

      {!loading && !error && list.length === 0 && (
        <div className="py-16 text-center">
          {tab === 'active' ? (
            <>
              <p className="text-xl font-bold">{t.noHabitsTitle}</p>
              <p className="mx-auto mt-2 max-w-xs text-muted">{t.noHabitsText}</p>
              <button onClick={() => setEditing('new')} className="mt-6 rounded-full bg-accent px-6 py-3 font-bold text-black">{t.createFirst}</button>
            </>
          ) : (
            <><p className="text-xl font-bold">{t.archiveEmpty}</p><p className="mt-2 text-muted">{t.archiveHint}</p></>
          )}
        </div>
      )}

      {groups.map((g) => (
        <section key={g.key} className="mb-5">
          {groups.length > 1 && <h2 className="mb-2 px-2 text-sm font-semibold uppercase tracking-wide text-muted">{g.title} <span className="text-muted/60">{g.items.length}</span></h2>}
          <ul className="space-y-2">
            {g.items.map((h) => {
              const mask = maskAt(h, h.archived ? me.today : h.startDate > me.today ? h.startDate : me.today);
              const lastMask = [...h.schedules].reverse().find((s) => s.weekdays > 0)?.weekdays ?? mask;
              return (
                <li key={h.id} className="flex items-center gap-3 rounded-2xl bg-surface p-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-raised text-xl">{h.icon ?? '•'}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{h.name}</p>
                    <p className="truncate text-xs text-muted">{[scheduleLabel(h.archived ? lastMask : mask), h.reminderTime, h.category].filter(Boolean).join(' · ')}</p>
                  </div>
                  {tab === 'active' ? (
                    <>
                      <IconBtn label={t.edit} onClick={() => setEditing(h)}><Pencil size={18} /></IconBtn>
                      <IconBtn label={t.archiveAction} onClick={() => archive(h, true)}><Archive size={18} /></IconBtn>
                    </>
                  ) : (
                    <>
                      <IconBtn label={t.restore} onClick={() => archive(h, false)}><ArchiveRestore size={18} /></IconBtn>
                      <IconBtn label={t.remove} onClick={() => setDeleting(h)} danger><Trash2 size={18} /></IconBtn>
                    </>
                  )}
                </li>
              );
    })}
          </ul>
        </section>
      ))}

      <Fab onClick={() => setEditing('new')} label={t.newHabit} />
      {editing && <HabitSheet habit={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
      {deleting && <ConfirmDialog title={t.deleteTitle} text={t.deleteText} confirmLabel={t.remove} onConfirm={() => remove(deleting)} onClose={() => setDeleting(null)} />}
    </>
  );
}

function IconBtn({ children, label, onClick, danger }: { children: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} aria-label={label} title={label}
      className={clsx('grid h-11 w-11 place-items-center rounded-full hover:bg-raised active:scale-95', danger ? 'text-bad' : 'text-muted')}>{children}</button>
  );
}
