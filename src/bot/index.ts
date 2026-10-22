import { Bot, GrammyError, HttpError as TgHttpError, InlineKeyboard, type Context } from 'grammy';
import { closeDb, getDb } from '../db';
import { channelLink, resolveWebAppUrl, supportLink, validateProductionEnv, webAppLink } from '../lib/env';
import { todayIn } from '../lib/dates';
import { getDay, getStats } from '../server/queries';
import { claimDelivery, findDueReminders, pruneDeliveries, releaseDelivery, type DueReminder } from '../server/reminders';
import { setRecord } from '../server/records';
import { setReminders, setTimezone, upsertTelegramUser } from '../server/users';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { HttpError } from '../server/errors';

const EXIT_CONFIG = 78; // tells the supervisor not to restart-loop on a configuration error

const token = process.env.BOT_TOKEN?.trim();
if (!token) {
  console.error('[bot] BOT_TOKEN sozlanmagan.');
  process.exit(EXIT_CONFIG);
}
if (process.env.NODE_ENV === 'production') {
  const problems = validateProductionEnv();
  if (problems.length) {
    console.error(`[bot] Konfiguratsiya xatosi:\n - ${problems.join('\n - ')}`);
    process.exit(EXIT_CONFIG);
  }
}

const db = getDb();
const bot = new Bot(token);
const appUrl = resolveWebAppUrl();
const SCAN_EVERY_MS = 20_000;
const SEND_GAP_MS = 60; // stay far below Telegram's ~30 msg/sec limit

const esc = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const HTML = { parse_mode: 'HTML' as const, link_preview_options: { is_disabled: true } };

/* ---------- keyboards ---------- */

function openApp(label = '📱 Ilovani ochish', path = '') {
  const url = webAppLink(path);
  return url ? new InlineKeyboard().webApp(label, url) : undefined;
}

const nonEmpty = (kb: InlineKeyboard) => (kb.inline_keyboard.length ? kb : undefined);

function homeKeyboard() {
  const kb = new InlineKeyboard();
  const main = webAppLink();
  if (main) {
    kb.webApp('📱 Ilovani ochish', main).row();
    kb.webApp('📅 Kalendar', webAppLink('/calendar')!).webApp('📊 Statistika', webAppLink('/stats')!);
  }
  return nonEmpty(kb);
}

/* ---------- user + day helpers ---------- */

async function ensure(ctx: Context) {
  if (!ctx.from || ctx.from.is_bot) return null;
  return await upsertTelegramUser(db, {
    id: ctx.from.id, first_name: ctx.from.first_name, last_name: ctx.from.last_name,
    username: ctx.from.username, language_code: ctx.from.language_code,
  });
}

type UserRow = typeof users.$inferSelect;

async function todayView(user: UserRow) {
  const today = todayIn(user.timezone);
  const { day } = await getDay(db, user.id, today, today);
  const counted = day.completed + day.missed + day.pending;
  const lines = day.items.map((i) => `${i.status === 'COMPLETED' ? '✅' : i.status === 'SKIPPED' ? '⏭️' : '⬜️'} ${i.icon ? `${esc(i.icon)} ` : ''}${esc(i.name)}${i.time ? ` <i>· ${i.time}</i>` : ''}`);
  const text = day.items.length
    ? `📅 <b>Bugungi odatlar</b>\n\n${lines.join('\n')}\n\nNatija: <b>${day.completed}/${counted}</b>${day.completed === counted && counted > 0 ? ' 🎉' : ''}`
    : 'Bugun uchun rejalashtirilgan odat yo‘q. Dam oling yoki ilovada yangi odat qo‘shing 🌱';
  const kb = new InlineKeyboard();
  for (const i of day.items) {
    const done = i.status === 'COMPLETED';
    kb.text(`${done ? '✅' : '⬜️'} ${i.name}`.slice(0, 40), `${done ? 'u' : 'd'}:${i.habitId}:${today}`).row();
  }
  const app = webAppLink();
  if (app) kb.webApp('📱 Ilovani ochish', app);
  return { text, kb: nonEmpty(kb), today };
}

/* ---------- commands ---------- */

bot.command('start', async (ctx) => {
  const user = await ensure(ctx);
  if (!user) return;
  await ctx.reply(
    `Salom, ${esc(ctx.from?.first_name || 'do‘stim')}! 👋\n\n` +
    '<b>Discipline OS</b> — odatlarni shakllantirish, kunlik vazifalarni belgilash va natijani kuzatish uchun shaxsiy yordamchingiz.\n\n' +
    '1️⃣ Ilovani oching va birinchi odatni qo‘shing\n' +
    '2️⃣ Eslatma vaqtini belgilang — men o‘z vaqtida xabar beraman\n' +
    '3️⃣ Shu yerning o‘zida ham /today orqali belgilashingiz mumkin\n\n' +
    'Barcha buyruqlar: /help',
    { ...HTML, reply_markup: homeKeyboard() },
  );
});

bot.command('help', async (ctx) => {
  const kb = homeKeyboard() ?? new InlineKeyboard();
  const support = supportLink(); const channel = channelLink();
  if (support) kb.row().url('💬 Yordam', support);
  if (channel) kb.url('📣 Kanal', channel);
  await ctx.reply(
    '<b>Buyruqlar</b>\n\n' +
    '/today — bugungi odatlar (shu yerda belgilash mumkin)\n' +
    '/stats — oxirgi 7 kunlik natija va seriya\n' +
    '/reminders_on — eslatmalarni yoqish\n' +
    '/reminders_off — eslatmalarni o‘chirish\n' +
    '/timezone — vaqt mintaqasi (masalan: <code>/timezone Asia/Tashkent</code>)\n' +
    '/help — yordam',
    { ...HTML, reply_markup: nonEmpty(kb) },
  );
});

bot.command('today', async (ctx) => {
  const user = await ensure(ctx);
  if (!user) return;
  const v = await todayView(user);
  await ctx.reply(v.text, { ...HTML, reply_markup: v.kb });
});

bot.command('stats', async (ctx) => {
  const user = await ensure(ctx);
  if (!user) return;
  const today = todayIn(user.timezone);
  const s = await getStats(db, user.id, '7d', today);
  if (!s.hasData) {
    await ctx.reply('Hali odat yo‘q. Ilovada birinchi odatingizni qo‘shing 🌱', { reply_markup: openApp() });
    return;
  }
  const o = s.overview;
  await ctx.reply(
    '📊 <b>Oxirgi 7 kun</b>\n\n' +
    `Bajarish foizi: <b>${o.rate === null ? '–' : `${o.rate}%`}</b>\n` +
    `Bajarildi: <b>${o.completed}</b> · Bajarilmadi: <b>${o.missed}</b> · O‘tkazildi: <b>${o.skipped}</b>\n` +
    `🔥 Joriy seriya: <b>${o.currentStreak}</b> kun · Eng yaxshi: <b>${o.bestStreak}</b> kun`,
    { ...HTML, reply_markup: openApp('📊 Batafsil statistika', '/stats') },
  );
});

async function toggleReminders(ctx: Context, enabled: boolean) {
  const user = await ensure(ctx);
  if (!user) return;
  await setReminders(db, user.id, enabled);
  await ctx.reply(enabled
    ? '🔔 Eslatmalar yoqildi. Odatlaringiz uchun belgilangan vaqtda xabar yuboraman.'
    : '🔕 Eslatmalar o‘chirildi. Xohlagan payt /reminders_on bilan qayta yoqing.');
}
bot.command('reminders_on', (ctx) => toggleReminders(ctx, true));
bot.command('reminders_off', (ctx) => toggleReminders(ctx, false));

bot.command('timezone', async (ctx) => {
  const user = await ensure(ctx);
  if (!user) return;
  const arg = ctx.match?.toString().trim();
  if (!arg) {
    await ctx.reply(`Joriy vaqt mintaqasi: <b>${esc(user.timezone)}</b>\nO‘zgartirish: <code>/timezone Asia/Tashkent</code>\nIlova ochilganda mintaqa avtomatik yangilanadi.`, HTML);
    return;
  }
  if (!(await setTimezone(db, user.id, arg))) {
    await ctx.reply('Vaqt mintaqasi noto‘g‘ri. Format: <code>Asia/Tashkent</code>', HTML);
    return;
  }
  await ctx.reply(`✅ Vaqt mintaqasi saqlandi: <b>${esc(arg)}</b>`, HTML);
});

/* ---------- inline actions (today list + reminders) ---------- */

// d = done, u = undo, k = skip. Format: <action>:<habitId>:<YYYY-MM-DD>[:r]  (r = came from a reminder message)
bot.callbackQuery(/^([duk]):(\d+):(\d{4}-\d{2}-\d{2})(:r)?$/, async (ctx) => {
  const user = await ensure(ctx);
  if (!user) return ctx.answerCallbackQuery();
  const [, action, id, date, fromReminder] = ctx.match as RegExpMatchArray;
  const status = action === 'd' ? 'COMPLETED' : action === 'k' ? 'SKIPPED' : 'PENDING';
  try {
    await setRecord(db, user.id, { habitId: Number(id), date, status }, todayIn(user.timezone));
  } catch (e) {
    await ctx.answerCallbackQuery({ text: e instanceof HttpError ? e.message : 'Xatolik yuz berdi', show_alert: true });
    return;
  }
  await ctx.answerCallbackQuery({ text: status === 'COMPLETED' ? 'Ajoyib! ✅' : status === 'SKIPPED' ? 'O‘tkazildi ⏭️' : 'Qaytarildi' });
  const v = await todayView(user);
  const edit = fromReminder
    ? ctx.editMessageText(`${status === 'COMPLETED' ? '✅ Bajarildi' : '⏭️ O‘tkazildi'}\n\n${v.text}`, { ...HTML, reply_markup: v.kb })
    : ctx.editMessageText(v.text, { ...HTML, reply_markup: v.kb });
  await edit.catch((e) => { if (!(e instanceof GrammyError && /not modified/i.test(e.description))) throw e; });
});

bot.on('message:text', async (ctx) => {
  await ctx.reply('Buyruqlar ro‘yxati uchun /help ni bosing yoki ilovani oching 👇', { reply_markup: openApp() });
});

bot.catch((err) => {
  const e = err.error;
  if (e instanceof GrammyError) console.error('[bot] Telegram API error:', e.description);
  else if (e instanceof TgHttpError) console.error('[bot] network error:', e.message);
  else console.error('[bot] handler error:', e instanceof Error ? e.message : e);
});

/* ---------- reminder scheduler ---------- */

const retryAfter = new Map<string, number>();
let pausedUntil = 0;
let scanning = false;

async function deliver(r: DueReminder): Promise<void> {
  const text =
    `⏰ <b>Odat vaqti!</b>\n\n${r.icon ? `${esc(r.icon)} ` : ''}<b>${esc(r.name)}</b>` +
    `${r.description ? `\n${esc(r.description)}` : ''}\n\nKichik qadam ham — oldinga qadam.`;
  const kb = new InlineKeyboard().text('✅ Bajardim', `d:${r.habitId}:${r.date}:r`).text('⏭️ O‘tkazish', `k:${r.habitId}:${r.date}:r`);
  const app = webAppLink();
  if (app) kb.row().webApp('📱 Ilovani ochish', app);
  await bot.api.sendMessage(r.telegramId, text, { ...HTML, reply_markup: kb });
}

async function scanReminders() {
  if (scanning || Date.now() < pausedUntil) return;
  scanning = true;
  try {
    for (const r of await findDueReminders(db)) {
      const key = `${r.habitId}:${r.date}:${r.reminderTime}`;
      if (Date.now() < (retryAfter.get(key) ?? 0)) continue;
      if (!(await claimDelivery(db, r))) continue;
      try {
        await deliver(r);
      } catch (e) {
        await releaseDelivery(db, r).catch(() => {});
        if (e instanceof GrammyError && (e.error_code === 403 || (e.error_code === 400 && /chat not found/i.test(e.description)))) {
          // User blocked the bot / deleted the chat: stop trying.
          await db.update(users).set({ remindersEnabled: false, updatedAt: Date.now() }).where(eq(users.id, r.userId));
          console.warn(`[reminders] user ${r.userId} unreachable; reminders disabled`);
        } else if (e instanceof GrammyError && e.error_code === 429) {
          pausedUntil = Date.now() + (e.parameters?.retry_after ?? 30) * 1000;
          console.warn(`[reminders] rate limited; pausing until ${new Date(pausedUntil).toISOString()}`);
          break;
        } else {
          retryAfter.set(key, Date.now() + 2 * 60_000);
          console.warn('[reminders] delivery failed:', e instanceof Error ? e.message : 'unknown');
        }
      }
      await sleep(SEND_GAP_MS);
    }
    for (const [k, until] of retryAfter) if (until < Date.now()) retryAfter.delete(k);
  } catch (e) {
    console.error('[reminders] scan failed:', e instanceof Error ? e.message : e);
  } finally {
    scanning = false;
  }
}

let stopped = false;
function loop(fn: () => Promise<void>, everyMs: number) {
  const run = async () => {
    if (stopped) return;
    try { await fn(); } catch (e) { console.error('[bot] loop error:', e instanceof Error ? e.message : e); }
    if (!stopped) setTimeout(run, everyMs).unref();
  };
  setTimeout(run, 2_000).unref();
}

async function maintenance() {
  await pruneDeliveries(db, todayIn('UTC'));
}

/* ---------- lifecycle ---------- */

async function main() {
  await bot.init(); // validates the token; throws on 401
  console.log(`[bot] running as @${bot.botInfo.username} (app: ${appUrl ?? 'not configured'})`);
  if (!process.env.BOT_USERNAME) console.log(`[bot] tip: set BOT_USERNAME=${bot.botInfo.username} so the web app can link back to the bot`);

  await bot.api.setMyCommands([
    { command: 'start', description: 'Boshlash va ilovani ochish' },
    { command: 'today', description: 'Bugungi odatlar' },
    { command: 'stats', description: 'Oxirgi 7 kun statistikasi' },
    { command: 'reminders_on', description: 'Eslatmalarni yoqish' },
    { command: 'reminders_off', description: 'Eslatmalarni o‘chirish' },
    { command: 'timezone', description: 'Vaqt mintaqasi' },
    { command: 'help', description: 'Yordam' },
  ]).catch((e) => console.warn('[bot] setMyCommands failed:', e.message));
  await bot.api.setMyShortDescription('Odatlar, eslatmalar va statistika — shaxsiy intizom yordamchingiz.').catch(() => {});
  if (appUrl) {
    await bot.api.setChatMenuButton({ menu_button: { type: 'web_app', text: 'Discipline OS', web_app: { url: appUrl } } })
      .catch((e) => console.warn('[bot] setChatMenuButton failed:', e.message));
  }

  loop(scanReminders, SCAN_EVERY_MS);
  loop(maintenance, 6 * 3_600_000);

  await bot.start({ allowed_updates: ['message', 'callback_query'], onStart: () => console.log('[bot] polling started') });
}

function shutdown(signal: string) {
  if (stopped) return;
  stopped = true;
  console.log(`[bot] ${signal} received; stopping`);
  Promise.resolve(bot.stop()).catch(() => {}).finally(() => {
    closeDb().catch(() => {}).finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(0), 5_000).unref();
}
process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (e) => console.error('[bot] unhandled rejection:', e instanceof Error ? e.message : e));

main().catch((e) => {
  if (e instanceof GrammyError && e.error_code === 401) {
    console.error('[bot] BOT_TOKEN noto‘g‘ri (401). Tokenni tekshiring.');
    process.exit(EXIT_CONFIG);
  }
  if (e instanceof GrammyError && e.error_code === 409) {
    console.error('[bot] 409 Conflict: shu token bilan boshqa nusxa polling qilyapti. Faqat bitta nusxa ishlashi kerak.');
  } else {
    console.error('[bot] fatal:', e instanceof Error ? e.message : e);
  }
  process.exit(1);
});
