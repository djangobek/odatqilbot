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
