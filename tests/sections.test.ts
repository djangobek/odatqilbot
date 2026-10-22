import { describe, expect, it } from 'vitest';
import { getBotToken } from '@/lib/env';
import { createHabitSchema } from '@/lib/validation';
import { createHabit, loadHabitDefs } from '@/server/habits';
import { createSection, deleteSection, listSections, renameSection } from '@/server/sections';
import { updateSettings } from '@/server/users';
import { findDueDigests } from '@/server/digests';
import { freshDb, makeUser } from './helpers';

const habit = (name: string, sectionId?: number | null) => createHabitSchema.parse({ name, weekdays: 127, sectionId });

describe('sections', () => {
  it('creates, orders, renames and rejects duplicates', async () => {
    const { db } = await freshDb();
    const u = await makeUser(db, 1);
    const a = await createSection(db, u.id, 'Language');
    await createSection(db, u.id, 'Books');
    expect((await listSections(db, u.id)).map((s) => s.name)).toEqual(['Language', 'Books']);
    await expect(createSection(db, u.id, 'language')).rejects.toThrow(/allaqachon/);
    expect((await renameSection(db, u.id, a.id, 'Til')).name).toBe('Til');
  });

  it('keeps habits when their section is deleted', async () => {
    const { db } = await freshDb();
    const u = await makeUser(db, 2);
    const s = await createSection(db, u.id, 'Sport');
    const h = await createHabit(db, u.id, habit('Yugurish', s.id), '2026-10-22');
    expect(h.sectionId).toBe(s.id);
    await deleteSection(db, u.id, s.id);
    const [after] = await loadHabitDefs(db, u.id);
    expect(after.name).toBe('Yugurish');
    expect(after.sectionId).toBeNull();
  });

  it('never lets a habit use another user\'s section', async () => {
    const { db } = await freshDb();
    const a = await makeUser(db, 3);
    const b = await makeUser(db, 4);
    const sec = await createSection(db, a.id, 'Private');
    await expect(createHabit(db, b.id, habit('X', sec.id), '2026-10-22')).rejects.toThrow(/topilmadi/);
    await expect(renameSection(db, b.id, sec.id, 'Hacked')).rejects.toThrow(/topilmadi/);
  });
});

describe('digests', () => {
  it('only targets users who opted in, inside the local window', async () => {
    const { db } = await freshDb();
    const u = await makeUser(db, 5);
    const at = (iso: string) => new Date(iso);
    expect(await findDueDigests(db, at('2026-10-22T03:05:00Z'))).toEqual([]); // not opted in
    await updateSettings(db, u.id, { morningDigest: true, eveningDigest: true });
    // Asia/Tashkent = UTC+5 -> 03:05Z is 08:05 local
    const morning = await findDueDigests(db, at('2026-10-22T03:05:00Z'));
    expect(morning.map((d) => d.kind)).toEqual(['morning']);
    const evening = await findDueDigests(db, at('2026-10-22T16:10:00Z'));
    expect(evening.map((d) => d.kind)).toEqual(['evening']);
    expect(await findDueDigests(db, at('2026-10-22T10:00:00Z'))).toEqual([]);
  });
});

describe('BOT_TOKEN normalisation', () => {
  it('strips whitespace, quotes and a "bot" prefix', () => {
    expect(getBotToken({ BOT_TOKEN: '  123:ABC\n' })).toBe('123:ABC');
    expect(getBotToken({ BOT_TOKEN: '"123:ABC"' })).toBe('123:ABC');
    expect(getBotToken({ BOT_TOKEN: 'bot123:ABC' })).toBe('123:ABC');
    expect(getBotToken({ BOT_TOKEN: '' })).toBeUndefined();
  });
});
