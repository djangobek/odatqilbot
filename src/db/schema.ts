import { bigint, boolean, index, integer, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';

/**
 * Notes on types (PostgreSQL):
 *  - Telegram user ids and epoch-millisecond timestamps do not fit in a 32-bit `integer`,
 *    so they are `bigint` in `number` mode (safe: both are far below 2^53).
 *  - Ids are identity columns "BY DEFAULT" so a SQLite export can be imported with its original ids.
 *  - Calendar dates stay as 'YYYY-MM-DD' text (the app computes them in each user's timezone).
 */
const id = () => integer('id').primaryKey().generatedByDefaultAsIdentity();
const epochMs = (name: string) => bigint(name, { mode: 'number' });

export const users = pgTable(
  'users',
  {
    id: id(),
    telegramId: bigint('telegram_id', { mode: 'number' }).notNull(),
    displayName: text('display_name').notNull(),
    username: text('username'),
    language: text('language').notNull().default('uz'),
    timezone: text('timezone').notNull().default('Asia/Tashkent'),
    remindersEnabled: boolean('reminders_enabled').notNull().default(true),
    morningDigest: boolean('morning_digest').notNull().default(false),
    eveningDigest: boolean('evening_digest').notNull().default(false),
    role: text('role', { enum: ['user', 'admin'] }).notNull().default('user'),
    banned: boolean('banned').notNull().default(false),
    banReason: text('ban_reason'),
    /** Set when Telegram answers 403 (user blocked the bot): broadcasts skip these users. */
    botBlocked: boolean('bot_blocked').notNull().default(false),
    lastSeenAt: epochMs('last_seen_at'),
    createdAt: epochMs('created_at').notNull(),
    updatedAt: epochMs('updated_at').notNull(),
  },
  (t) => [uniqueIndex('users_telegram_id_unique').on(t.telegramId), index('users_last_seen_idx').on(t.lastSeenAt)],
);

/** User-defined groups of habits ("Language", "Books", ...). Deleting a section keeps its habits (section_id -> null). */
export const sections = pgTable(
  'sections',
  {
    id: id(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    position: integer('position').notNull().default(0),
    createdAt: epochMs('created_at').notNull(),
    updatedAt: epochMs('updated_at').notNull(),
  },
  (t) => [index('sections_user_idx').on(t.userId)],
);

export const habits = pgTable(
  'habits',
  {
    id: id(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    icon: text('icon'),
    category: text('category'),
    startDate: text('start_date').notNull(),
    endDate: text('end_date'),
    reminderTime: text('reminder_time'),
    sectionId: integer('section_id').references(() => sections.id, { onDelete: 'set null' }),
    archived: boolean('archived').notNull().default(false),
    createdAt: epochMs('created_at').notNull(),
    updatedAt: epochMs('updated_at').notNull(),
  },
  (t) => [index('habits_user_archived_idx').on(t.userId, t.archived)],
);

/**
 * Schedule versions. A habit's schedule on date D is the version with the
 * greatest effective_from <= D. weekdays is a bitmask (bit0 = Sunday ... bit6 = Saturday);
 * 0 means "not scheduled" (used after archiving). Changing a schedule adds a new
 * version, so history keeps the schedule that was valid back then.
 */
export const habitSchedules = pgTable(
  'habit_schedules',
  {
    id: id(),
    habitId: integer('habit_id').notNull().references(() => habits.id, { onDelete: 'cascade' }),
    effectiveFrom: text('effective_from').notNull(),
    weekdays: integer('weekdays').notNull(),
  },
  (t) => [uniqueIndex('habit_schedules_habit_from_unique').on(t.habitId, t.effectiveFrom)],
);

export const habitRecords = pgTable(
  'habit_records',
  {
    id: id(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    habitId: integer('habit_id').notNull().references(() => habits.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    status: text('status', { enum: ['PENDING', 'COMPLETED', 'SKIPPED'] }).notNull().default('PENDING'),
    completedAt: epochMs('completed_at'),
    note: text('note'),
    createdAt: epochMs('created_at').notNull(),
    updatedAt: epochMs('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('habit_records_habit_date_unique').on(t.habitId, t.date),
    index('habit_records_user_date_idx').on(t.userId, t.date),
  ],
);

export const dailyNotes = pgTable(
  'daily_notes',
  {
    id: id(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    wentWell: text('went_well'),
    difficult: text('difficult'),
    notes: text('notes'),
    createdAt: epochMs('created_at').notNull(),
    updatedAt: epochMs('updated_at').notNull(),
  },
  (t) => [uniqueIndex('daily_notes_user_date_unique').on(t.userId, t.date)],
);

export const reminderDeliveries = pgTable(
  'reminder_deliveries',
  {
    id: id(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    habitId: integer('habit_id').notNull().references(() => habits.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    reminderTime: text('reminder_time').notNull(),
    sentAt: epochMs('sent_at').notNull(),
  },
  (t) => [uniqueIndex('reminder_deliveries_habit_date_time_unique').on(t.habitId, t.date, t.reminderTime)],
);

/** One row per (user, kind, local date): makes morning/evening digests idempotent across bot restarts. */
export const digestDeliveries = pgTable(
  'digest_deliveries',
  {
    id: id(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['morning', 'evening'] }).notNull(),
    date: text('date').notNull(),
    sentAt: epochMs('sent_at').notNull(),
  },
  (t) => [uniqueIndex('digest_deliveries_user_kind_date_unique').on(t.userId, t.kind, t.date)],
);

/** Mass messages written in the admin panel and delivered by the bot process (queue + progress). */
export const broadcasts = pgTable(
  'broadcasts',
  {
    id: id(),
    text: text('text').notNull(),
    audience: text('audience').notNull().default('all'), // all | active | inactive | admins | user:<id>
    buttonLabel: text('button_label'),
    buttonUrl: text('button_url'),
    status: text('status', { enum: ['scheduled', 'queued', 'sending', 'done', 'cancelled'] }).notNull().default('queued'),
    total: integer('total').notNull().default(0),
    sent: integer('sent').notNull().default(0),
    failed: integer('failed').notNull().default(0),
    blocked: integer('blocked').notNull().default(0),
    createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
    scheduledAt: epochMs('scheduled_at'),
    startedAt: epochMs('started_at'),
    finishedAt: epochMs('finished_at'),
    createdAt: epochMs('created_at').notNull(),
  },
  (t) => [index('broadcasts_status_idx').on(t.status)],
);

/** One row per recipient: the send loop is resumable and never sends twice. */
export const broadcastRecipients = pgTable(
  'broadcast_recipients',
  {
    id: id(),
    broadcastId: integer('broadcast_id').notNull().references(() => broadcasts.id, { onDelete: 'cascade' }),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    telegramId: bigint('telegram_id', { mode: 'number' }).notNull(),
    status: text('status', { enum: ['pending', 'sent', 'failed', 'blocked'] }).notNull().default('pending'),
    error: text('error'),
    sentAt: epochMs('sent_at'),
  },
  (t) => [uniqueIndex('broadcast_recipients_unique').on(t.broadcastId, t.userId), index('broadcast_recipients_pending_idx').on(t.broadcastId, t.status)],
);

/** Who did what in the admin panel. */
export const auditLog = pgTable(
  'audit_log',
  {
    id: id(),
    adminId: integer('admin_id').references(() => users.id, { onDelete: 'set null' }),
    adminName: text('admin_name').notNull(),
    action: text('action').notNull(),
    target: text('target'),
    detail: text('detail'),
    createdAt: epochMs('created_at').notNull(),
  },
  (t) => [index('audit_log_created_idx').on(t.createdAt)],
);

/** Small key/value store for global switches (maintenance mode, announcement banner). */
export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: epochMs('updated_at').notNull(),
});

export type User = typeof users.$inferSelect;
export type BroadcastRow = typeof broadcasts.$inferSelect;
export type SectionRow = typeof sections.$inferSelect;
export type HabitRow = typeof habits.$inferSelect;
export type RecordRow = typeof habitRecords.$inferSelect;
