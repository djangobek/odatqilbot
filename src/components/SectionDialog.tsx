'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { t } from '@/lib/i18n';
import { success } from '@/lib/haptics';
import { Modal } from './Modal';
import { useMe, type Section } from './AuthProvider';

/** "Add section" / "Rename section" prompt: one field, Cancel + OK (same flow as the reference screenshots). */
export function SectionDialog({ section, onClose, onDone }: { section?: Section; onClose: () => void; onDone: (s: Section) => void }) {
  const { toast, reloadSections } = useMe();
  const [name, setName] = useState(section?.name ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const clean = name.trim();
    if (!clean) return setError(t.sectionName);
    setBusy(true);
    try {
      const r = await api<{ section: Section }>(section ? `/api/sections/${section.id}` : '/api/sections', { method: section ? 'PATCH' : 'POST', body: { name: clean } });
      await reloadSections();
      success();
      toast(t.saved);
      onDone(r.section);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title={section ? t.renameSection : t.addSection} onClose={onClose} variant="dialog"
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="h-12 flex-1 rounded-full bg-raised font-semibold active:scale-[.98]">{t.cancel}</button>
          <button type="submit" form="section-form" disabled={busy} className="h-12 flex-1 rounded-full bg-accent font-bold text-black active:scale-[.98] disabled:opacity-60">{busy ? t.loading : t.ok}</button>
        </div>
      }>
      <form id="section-form" onSubmit={submit} className="py-2">
        <input className="h-14 w-full rounded-2xl bg-raised px-4 text-base outline-none ring-1 ring-transparent placeholder:text-muted/70 focus:ring-accent"
          value={name} onChange={(e) => { setName(e.target.value); setError(null); }} placeholder={t.sectionNamePh} maxLength={30}
          enterKeyHint="done" autoComplete="off" aria-label={t.sectionName} />
        {error && <p role="alert" className="mt-2 px-1 text-sm text-bad">{error}</p>}
      </form>
    </Modal>
  );
}
