import { z } from 'zod';
import { isValidDate, isValidTimezone } from './dates';

export const MIN_DATE = '2020-01-01';
export const MAX_DATE = '2100-12-31';
const dateStr = z.string().refine(isValidDate, 'Sana noto‘g‘ri').refine((s) => s >= MIN_DATE && s <= MAX_DATE, 'Sana oralig‘i noto‘g‘ri');
const emptyToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);

const habitBase = z.object({
  name: z.string().trim().min(1, 'Nom kiriting').max(80, 'Nom juda uzun'),
  description: z.preprocess(emptyToNull, z.string().trim().max(300).nullish()),
  icon: z.preprocess(emptyToNull, z.string().max(8).nullish()),
  category: z.preprocess(emptyToNull, z.string().trim().max(40).nullish()),
  startDate: dateStr,
  endDate: z.preprocess(emptyToNull, dateStr.nullish()),
  sectionId: z.preprocess(emptyToNull, z.number().int().positive().nullish()),
  weekdays: z.number().int().min(1, 'Kamida bitta kun tanlang').max(127),
  reminderTime: z.preprocess(emptyToNull, z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Vaqt noto‘g‘ri').nullish()),
});

const endAfterStart = (v: { startDate?: string; endDate?: string | null }) =>
  !v.startDate || !v.endDate || v.endDate >= v.startDate;

export const createHabitSchema = habitBase
  .extend({ startDate: dateStr.optional() })
  .refine(endAfterStart, { message: 'Tugash sanasi boshlanishdan oldin bo‘lmasligi kerak', path: ['endDate'] });

export const updateHabitSchema = habitBase
  .partial()
  .refine(endAfterStart, { message: 'Tugash sanasi boshlanishdan oldin bo‘lmasligi kerak', path: ['endDate'] });

export const archiveSchema = z.object({ archived: z.boolean() });

export const recordSchema = z.object({
  habitId: z.number().int().positive(),
  date: dateStr,
  status: z.enum(['PENDING', 'COMPLETED', 'SKIPPED']),
  note: z.preprocess(emptyToNull, z.string().max(300).nullish()),
});

export const noteSchema = z.object({
  date: dateStr,
  wentWell: z.string().max(1000).default(''),
  difficult: z.string().max(1000).default(''),
  notes: z.string().max(1000).default(''),
});

export const telegramAuthSchema = z.object({
  initData: z.string().min(10).max(4096),
  timezone: z.string().optional().refine((t) => !t || isValidTimezone(t), 'Vaqt mintaqasi noto‘g‘ri'),
});

export type HabitInput = z.infer<typeof createHabitSchema>;

export const sectionSchema = z.object({
  name: z.string().trim().min(1, 'Bo‘lim nomini kiriting').max(30, 'Nom juda uzun (30 belgigacha)'),
});

export const settingsSchema = z.object({
  language: z.enum(['uz', 'ru']).optional(),
  remindersEnabled: z.boolean().optional(),
  morningDigest: z.boolean().optional(),
  eveningDigest: z.boolean().optional(),
  timezone: z.string().refine(isValidTimezone, 'Vaqt mintaqasi noto‘g‘ri').optional(),
});

/* ---------- admin ---------- */

export const adminUserActionSchema = z.object({
  action: z.enum(['ban', 'unban', 'promote', 'demote']),
  reason: z.preprocess(emptyToNull, z.string().trim().max(200).nullish()),
});

export const adminSettingsSchema = z.object({
  maintenance: z.boolean().optional(),
  maintenanceMessage: z.string().trim().min(1, 'Xabar matnini kiriting').max(300).optional(),
  announcement: z.string().trim().max(300, 'E’lon 300 belgidan oshmasin').optional(),
});

const isHttpsUrl = (s: string) => {
  try { return new URL(s).protocol === 'https:'; } catch { return false; }
};

export const broadcastSchema = z
  .object({
    text: z.string().trim().min(1, 'Xabar matnini kiriting').max(3500, 'Matn juda uzun (3500 belgigacha)'),
    audience: z.union([z.enum(['all', 'active', 'inactive', 'admins', 'me']), z.string().regex(/^user:\d{1,9}$/, 'Auditoriya noto‘g‘ri')]),
    buttonLabel: z.preprocess(emptyToNull, z.string().trim().max(32, 'Tugma nomi juda uzun').nullish()),
    buttonUrl: z.preprocess(emptyToNull, z.string().trim().max(500).nullish()),
    scheduledAt: z.number().int().positive().nullish(),
  })
  .refine((v) => !!v.buttonLabel === !!v.buttonUrl, { message: 'Tugma uchun nom ham, havola ham kerak', path: ['buttonUrl'] })
  .refine((v) => !v.buttonUrl || v.buttonUrl === 'app' || isHttpsUrl(v.buttonUrl), { message: 'Havola https:// bilan boshlanishi kerak', path: ['buttonUrl'] });

export const adminUsersQuerySchema = z.object({
  q: z.string().trim().max(60).default(''),
  filter: z.enum(['all', 'active7', 'new7', 'inactive', 'banned', 'admins', 'blocked']).default('all'),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
