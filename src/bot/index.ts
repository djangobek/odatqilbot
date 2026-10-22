import { Bot, GrammyError, HttpError as TgHttpError, InlineKeyboard, type Context } from 'grammy';
import { closeDb, getDb } from '../db';
import { channelLink, getBotToken, resolveWebAppUrl, supportLink, validateProductionEnv, webAppLink } from '../lib/env';
import { todayIn } from '../lib/dates';
import { STREAK_MILESTONES, levelOf, quoteOfDay } from '../lib/quotes';
import { createHabitSchema } from '../lib/validation';
import { getDay, getStats } from '../server/queries';
import { claimDelivery, findDueReminders, pruneDeliveries, releaseDelivery, type DueReminder } from '../server/reminders';
import { setRecord } from '../server/records';
import { createHabit } from '../server/habits';
import { createSection, listSections, type SectionDto } from '../server/sections';
import { claimDigest, findDueDigests, pruneDigests, releaseDigest, type DueDigest } from '../server/digests';
import { setReminders, setTimezone, updateSettings, upsertTelegramUser } from '../server/users';
import { broadcastStatus, claimNext, finishBroadcast, markRecipient, markUserBlocked, nextBatch, refreshCounts, renderBroadcast } from '../server/broadcasts';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { HttpError } from '../server/errors';

const EXIT_CONFIG = 78; // tells the supervisor not to restart-loop on a configuration error

const token = getBotToken();
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
    kb.webApp('🌱 Odatlar', webAppLink('/habits')!).webApp('📊 Statistika', webAppLink('/stats')!).row();
    kb.webApp('⚙️ Sozlamalar', webAppLink('/settings')!);
  }
  return nonEmpty(kb);
}

/* ---------- user + day helpers ---------- */

async function ensure(ctx: Context) {
  if (!ctx.from || ctx.from.is_bot) return null;
  const user = await upsertTelegramUser(db, {
    id: ctx.from.id, first_name: ctx.from.first_name, last_name: ctx.from.last_name,
    username: ctx.from.username, language_code: ctx.from.language_code,
  });
  if (user.banned) {
    // Blocked by an admin: no commands, no buttons.
    if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: 'Hisobingiz bloklangan', show_alert: true }).catch(() => {});
    else await ctx.reply('🚫 Hisobingiz bloklangan.').catch(() => {});
    return null;
  }
  if (user.botBlocked) {
    // The person is talking to the bot again, so broadcasts can reach them.
    await db.update(users).set({ botBlocked: false, updatedAt: Date.now() }).where(eq(users.id, user.id));
  }
  return user;
}

type UserRow = typeof users.$inferSelect;

const bar = (pct: number, n = 10) => '▰'.repeat(Math.round((pct / 100) * n)) + '▱'.repeat(n - Math.round((pct / 100) * n));
const SPARK = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
const WD_SHORT = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];

type DayData = Awaited<ReturnType<typeof getDay>>['day'];
const itemLine = (i: DayData['items'][number]) =>
  `${i.status === 'COMPLETED' ? '✅' : i.status === 'SKIPPED' ? '⏭️' : '⬜️'} ${i.icon ? `${esc(i.icon)} ` : ''}${esc(i.name)}${i.time ? ` <i>· ${i.time}</i>` : ''}`;

/** Habit lines, grouped under their section when the person uses sections. */
function groupedLines(items: DayData['items'], sections: SectionDto[]): string[] {
  if (!sections.length) return items.map(itemLine);
  const out: string[] = [];
  const known = new Set(sections.map((x) => x.id));
  const blocks = [
    ...sections.map((sec) => ({ title: sec.name, list: items.filter((i) => i.sectionId === sec.id) })),
    { title: 'Bo‘limsiz', list: items.filter((i) => i.sectionId === null || !known.has(i.sectionId)) },
  ];
  for (const g of blocks) {
    if (!g.list.length) continue;
    out.push(`\n📂 <b>${esc(g.title)}</b>`, ...g.list.map(itemLine));
  }
  return out;
}

async function todayView(user: UserRow) {
  const today = todayIn(user.timezone);
  const [{ day }, sections] = await Promise.all([getDay(db, user.id, today, today), listSections(db, user.id)]);
  const counted = day.completed + day.missed + day.pending;
  const pct = counted ? Math.round((day.completed / counted) * 100) : 0;
  const text = day.items.length
    ? `📅 <b>Bugungi odatlar</b>\n${groupedLines(day.items, sections).join('\n')}\n\n${bar(pct)} <b>${day.completed}/${counted}</b> · ${pct}%${day.completed === counted && counted > 0 ? ' 🎉' : ''}`
    : 'Bugun uchun rejalashtirilgan odat yo‘q. Dam oling yoki yangi odat qo‘shing: <code>/add Kitob o‘qish 21:00</code> 🌱';
  const kb = new InlineKeyboard();
  for (const i of day.items) {
    const done = i.status === 'COMPLETED';
    kb.text(`${done ? '✅' : '⬜️'} ${i.name}`.slice(0, 40), `${done ? 'u' : 'd'}:${i.habitId}:${today}`).row();
  }
  const app = webAppLink();
  if (app) kb.webApp('📱 Ilovani ochish', app);
  return { text, kb: nonEmpty(kb), today, day };
}

/** Quick-add syntax: "Kitob o‘qish 21:00 #Kitoblar" (time and #section are optional). */
function parseQuickAdd(raw: string) {
  let text = ` ${raw.trim()} `;
  let reminderTime: string | undefined;
  let section: string | undefined;
  const tm = text.match(/\s([01]?\d|2[0-3])[:.]([0-5]\d)(?=\s)/);
  if (tm) { reminderTime = `${tm[1].padStart(2, '0')}:${tm[2]}`; text = text.replace(tm[0], ' '); }
  const sm = text.match(/\s#(\S+)(?=\s)/);
  if (sm) { section = sm[1].replaceAll('_', ' '); text = text.replace(sm[0], ' '); }
  return { name: text.replace(/\s+/g, ' ').trim(), reminderTime, section };
}

async function quickAdd(ctx: Context, raw: string) {
  const user = await ensure(ctx);
  if (!user) return;
  const { name, reminderTime, section } = parseQuickAdd(raw);
  if (!name) {
    await ctx.reply('Yangi odat qo‘shish:\n<code>/add Kitob o‘qish 21:00 #Kitoblar</code>\n\nVaqt (21:00) va #bo‘lim ixtiyoriy. Bo‘lim yo‘q bo‘lsa, yaratiladi.\nQisqacha: <code>+ Suv ichish 09:00</code>', HTML);
    return;
  }
  try {
    let sectionId: number | undefined;
    if (section) {
      const found = (await listSections(db, user.id)).find((x) => x.name.toLowerCase() === section.toLowerCase());
      sectionId = found ? found.id : (await createSection(db, user.id, section.slice(0, 30))).id;
    }
    const today = todayIn(user.timezone);
    const input = createHabitSchema.parse({ name, weekdays: 127, reminderTime, sectionId });
    await createHabit(db, user.id, input, today);
    await ctx.reply(
      `✅ Odat qo‘shildi: <b>${esc(name)}</b>${reminderTime ? `\n⏰ Eslatma: ${reminderTime}` : ''}${section ? `\n📂 Bo‘lim: ${esc(section)}` : ''}\n\nHar kuni takrorlanadi. Kunlarni ilovada o‘zgartirishingiz mumkin.`,
      { ...HTML, reply_markup: openApp('📱 Ilovada ko‘rish', '/habits') },
    );
  } catch (e) {
    await ctx.reply(e instanceof HttpError || (e instanceof Error && e.name === 'ZodError') ? `⚠️ ${e instanceof HttpError ? e.message : 'Nom yoki vaqt noto‘g‘ri'}` : 'Xatolik yuz berdi, keyinroq urinib ko‘ring.');
  }
}

/** Celebration after completing a habit from the bot: all done today -> cheer, plus streak milestones. */
async function celebrate(ctx: Context, user: UserRow, today: string, day: DayData) {
  const counted = day.completed + day.missed + day.pending;
  if (counted === 0 || day.completed !== counted) return;
  const s = await getStats(db, user.id, 'all', today);
  const streak = s.overview.currentStreak;
  const lv = levelOf(s.overview.completed);
  const milestone = (STREAK_MILESTONES as readonly number[]).includes(streak);
  await ctx.reply(
    `🎉 <b>Bugungi barcha odatlar bajarildi!</b>\n🔥 Seriya: <b>${streak}</b> kun${milestone ? ' — yangi cho‘qqi! 🏆' : ''}\n⭐ Daraja ${lv.level} · ${bar(Math.round(lv.progress * 100))}\n\n<i>${esc(quoteOfDay(today))}</i>`,
    HTML,
  ).catch(() => {});
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
    '3️⃣ Shu yerning o‘zida ham /today orqali belgilashingiz mumkin\n4️⃣ Tez qo‘shish: <code>/add Kitob 21:00 #Til</code>\n\n' +
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
    '/add — tez odat qo‘shish: <code>/add Kitob 21:00 #Til</code>\n' +
    '/sections — bo‘limlar va ulardagi odatlar\n' +
    '/week — 7 kunlik grafik\n' +
    '/streak — seriya, daraja va yutuqlar\n' +
    '/motivation — kunlik motivatsiya\n' +
    '/settings — eslatma, ertalabki reja, kechki xulosa\n' +
    '/timezone — vaqt mintaqasi (<code>/timezone Asia/Tashkent</code>)\n' +
    '/help — yordam\n\n' +
    '💡 Qisqa yo‘l: xabarni <b>+</b> bilan boshlang — <code>+ Suv ichish 09:00</code>',
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

bot.command('add', (ctx) => quickAdd(ctx, ctx.match?.toString() ?? ''));

bot.command('sections', async (ctx) => {
  const user = await ensure(ctx);
  if (!user) return;
  const [sections, today] = [await listSections(db, user.id), todayIn(user.timezone)];
  if (!sections.length) {
    await ctx.reply('Hali bo‘lim yo‘q. Bo‘lim — alohida ishlar uchun guruh (masalan: Til, Kitoblar, Sport).\n\nYaratish: <code>/add Ingliz tili 20:00 #Til</code> yoki ilovada “+” tugmasi.', { ...HTML, reply_markup: openApp() });
    return;
  }
  const { day } = await getDay(db, user.id, today, today);
  const lines = sections.map((sec) => {
    const list = day.items.filter((i) => i.sectionId === sec.id);
    const done = list.filter((i) => i.status === 'COMPLETED').length;
    return `📂 <b>${esc(sec.name)}</b> — ${list.length ? `${done}/${list.length} bugun` : 'bugun odat yo‘q'}`;
  });
  await ctx.reply(`<b>Bo‘limlar</b>\n\n${lines.join('\n')}`, { ...HTML, reply_markup: openApp('📱 Ilovada boshqarish') });
});

bot.command('week', async (ctx) => {
  const user = await ensure(ctx);
  if (!user) return;
  const today = todayIn(user.timezone);
  const s = await getStats(db, user.id, '7d', today);
  if (!s.hasData) {
    await ctx.reply('Hali odat yo‘q. Birinchi odatni qo‘shing: <code>/add Kitob 21:00</code> 🌱', HTML);
    return;
  }
  const rows = s.daily.map((d) => {
    const wd = WD_SHORT[new Date(`${d.date}T00:00:00Z`).getUTCDay()];
    const glyph = d.percent === null ? '·' : SPARK[Math.min(7, Math.floor((d.percent / 100) * 7.99))];
    return `${wd} ${glyph.repeat(3)} ${d.percent === null ? '–' : `${d.percent}%`}`;
  });
  const o = s.overview;
  await ctx.reply(
    `📈 <b>Hafta grafigi</b>\n\n<code>${rows.join('\n')}</code>\n\nO‘rtacha: <b>${o.rate === null ? '–' : `${o.rate}%`}</b> · 🔥 ${o.currentStreak} kun`,
    { ...HTML, reply_markup: openApp('📊 Batafsil statistika', '/stats') },
  );
});

bot.command('streak', async (ctx) => {
  const user = await ensure(ctx);
  if (!user) return;
  const s = await getStats(db, user.id, 'all', todayIn(user.timezone));
  if (!s.hasData) {
    await ctx.reply('Hali odat yo‘q. Boshlash uchun: <code>/add Suv ichish 09:00</code> 🌱', HTML);
    return;
  }
  const o = s.overview;
  const lv = levelOf(o.completed);
  const next = STREAK_MILESTONES.find((m) => m > o.currentStreak);
  await ctx.reply(
    `🔥 <b>Seriya: ${o.currentStreak} kun</b> (eng yaxshi: ${o.bestStreak})\n` +
    `⭐ <b>Daraja ${lv.level}</b> ${bar(Math.round(lv.progress * 100))}\n` +
    `✅ Jami bajarilgan: <b>${o.completed}</b> (keyingi darajagacha ${lv.to - o.completed})\n` +
    `${next ? `🎯 Keyingi maqsad: <b>${next}</b> kunlik seriya (${next - o.currentStreak} kun qoldi)` : '👑 Siz barcha seriya maqsadlarini bosib o‘tdingiz!'}`,
    { ...HTML, reply_markup: openApp('🏆 Yutuqlarni ko‘rish', '/stats') },
  );
});

bot.command('motivation', async (ctx) => {
  const user = await ensure(ctx);
  if (!user) return;
  await ctx.reply(`💬 <i>${esc(quoteOfDay(todayIn(user.timezone)))}</i>`, { ...HTML, reply_markup: openApp() });
});

/* ---------- settings (inline toggles) ---------- */

function settingsView(u: UserRow) {
  const row = (on: boolean, label: string) => `${on ? '🔔' : '🔕'} ${label}: ${on ? 'yoqilgan' : 'o‘chiq'}`;
  const kb = new InlineKeyboard()
    .text(row(u.remindersEnabled, 'Odat eslatmalari'), 's:r').row()
    .text(row(u.morningDigest, 'Ertalabki reja (08:00)'), 's:m').row()
    .text(row(u.eveningDigest, 'Kechki xulosa (21:00)'), 's:e').row();
  const app = webAppLink('/settings');
  if (app) kb.webApp('⚙️ Ilovada sozlash', app);
  return { text: `⚙️ <b>Sozlamalar</b>\n\nVaqt mintaqasi: <b>${esc(u.timezone)}</b>\nTugmani bosib yoqing yoki o‘chiring.`, kb };
}

bot.command('settings', async (ctx) => {
  const user = await ensure(ctx);
  if (!user) return;
  const v = settingsView(user);
  await ctx.reply(v.text, { ...HTML, reply_markup: v.kb });
});

bot.callbackQuery(/^s:([rme])$/, async (ctx) => {
  const user = await ensure(ctx);
  if (!user) return ctx.answerCallbackQuery();
  const k = (ctx.match as RegExpMatchArray)[1];
  const next = await updateSettings(db, user.id,
    k === 'r' ? { remindersEnabled: !user.remindersEnabled } : k === 'm' ? { morningDigest: !user.morningDigest } : { eveningDigest: !user.eveningDigest });
  await ctx.answerCallbackQuery({ text: 'Saqlandi ✅' });
  const v = settingsView(next);
  await ctx.editMessageText(v.text, { ...HTML, reply_markup: v.kb }).catch(() => {});
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
  if (status === 'COMPLETED') await celebrate(ctx, user, v.today, v.day);
  const edit = fromReminder
    ? ctx.editMessageText(`${status === 'COMPLETED' ? '✅ Bajarildi' : '⏭️ O‘tkazildi'}\n\n${v.text}`, { ...HTML, reply_markup: v.kb })
    : ctx.editMessageText(v.text, { ...HTML, reply_markup: v.kb });
  await edit.catch((e) => { if (!(e instanceof GrammyError && /not modified/i.test(e.description))) throw e; });
});

bot.on('message:text', async (ctx) => {
  const text = ctx.message.text.trim();
  if (text.startsWith('+')) return quickAdd(ctx, text.slice(1));
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
    `${r.description ? `\n${esc(r.description)}` : ''}\n\n<i>${esc(quoteOfDay(r.date))}</i>`;
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

async function deliverDigest(d: DueDigest): Promise<boolean> {
  const user = (await db.select().from(users).where(eq(users.id, d.userId)))[0];
  if (!user) return true;
  const v = await todayView(user);
  const counted = v.day.completed + v.day.missed + v.day.pending;
  if (counted === 0 && v.day.skipped === 0) return true; // nothing planned: stay silent
  if (d.kind === 'evening' && v.day.pending === 0) {
    // Everything is done: short congratulation instead of a list.
    const s = await getStats(db, user.id, 'all', v.today);
    await bot.api.sendMessage(d.telegramId, `🌙 <b>Kun yakuni</b>\n\nBugun hammasi bajarildi — ${v.day.completed}/${counted} 🎉\n🔥 Seriya: <b>${s.overview.currentStreak}</b> kun\n\n<i>${esc(quoteOfDay(v.today))}</i>`, HTML);
    return true;
  }
  const head = d.kind === 'morning'
    ? `☀️ <b>Xayrli tong, ${esc(user.displayName.split(' ')[0])}!</b>\nBugun ${counted} ta odat sizni kutmoqda.\n\n<i>${esc(quoteOfDay(v.today))}</i>\n\n`
    : `🌙 <b>Kun yakuni</b>\nHali ${v.day.pending} ta odat qoldi — hali ulgurasiz!\n\n`;
  await bot.api.sendMessage(d.telegramId, head + v.text.replace(/^📅 <b>Bugungi odatlar<\/b>\n/, ''), { ...HTML, reply_markup: v.kb });
  return true;
}

async function scanDigests() {
  if (Date.now() < pausedUntil) return;
  for (const d of await findDueDigests(db)) {
    if (!(await claimDigest(db, d))) continue;
    try {
      await deliverDigest(d);
    } catch (e) {
      await releaseDigest(db, d).catch(() => {});
      if (e instanceof GrammyError && (e.error_code === 403 || (e.error_code === 400 && /chat not found/i.test(e.description)))) {
        await db.update(users).set({ morningDigest: false, eveningDigest: false, remindersEnabled: false, updatedAt: Date.now() }).where(eq(users.id, d.userId));
      } else if (e instanceof GrammyError && e.error_code === 429) {
        pausedUntil = Date.now() + (e.parameters?.retry_after ?? 30) * 1000;
        break;
      } else {
        console.warn('[digest] delivery failed:', e instanceof Error ? e.message : 'unknown');
        // The slot was released; the next scan retries until the catch-up window ends.
      }
    }
    await sleep(SEND_GAP_MS);
  }
}

/* ---------- broadcasts (written in the admin panel) ---------- */

let casting = false;
const BATCH = 25;

async function scanBroadcasts() {
  if (casting || Date.now() < pausedUntil) return;
  casting = true;
  try {
    const b = await claimNext(db);
    if (!b) return;
    const kb = new InlineKeyboard();
    if (b.buttonLabel && b.buttonUrl) {
      if (b.buttonUrl === 'app') { const u = webAppLink(); if (u) kb.webApp(b.buttonLabel, u); }
      else kb.url(b.buttonLabel, b.buttonUrl);
    }
    const markup = nonEmpty(kb);
    console.log(`[broadcast] #${b.id} started (${b.total} recipients)`);
    outer: while (!stopped) {
      const batch = await nextBatch(db, b.id, BATCH);
      if (!batch.length) { await refreshCounts(db, b.id); await finishBroadcast(db, b.id); console.log(`[broadcast] #${b.id} finished`); break; }
      for (const r of batch) {
        try {
          await bot.api.sendMessage(r.telegramId, renderBroadcast(b.text, r.name), { ...HTML, reply_markup: markup });
          await markRecipient(db, r.rid, 'sent');
        } catch (e) {
          if (e instanceof GrammyError && (e.error_code === 403 || (e.error_code === 400 && /chat not found/i.test(e.description)))) {
            await markRecipient(db, r.rid, 'blocked', e.description);
            await markUserBlocked(db, r.userId);
          } else if (e instanceof GrammyError && e.error_code === 429) {
            // Leave this recipient pending; the next scan resumes exactly here.
            pausedUntil = Date.now() + (e.parameters?.retry_after ?? 30) * 1000;
            console.warn(`[broadcast] rate limited; pausing until ${new Date(pausedUntil).toISOString()}`);
            await refreshCounts(db, b.id);
            break outer;
          } else {
            await markRecipient(db, r.rid, 'failed', e instanceof Error ? e.message : 'unknown');
          }
        }
        await sleep(SEND_GAP_MS);
      }
      await refreshCounts(db, b.id);
      if ((await broadcastStatus(db, b.id)) !== 'sending') { console.log(`[broadcast] #${b.id} stopped (cancelled)`); break; }
    }
  } catch (e) {
    console.error('[broadcast] failed:', e instanceof Error ? e.message : e);
  } finally {
    casting = false;
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
  await pruneDigests(db, todayIn('UTC'));
}

/* ---------- lifecycle ---------- */

async function main() {
  await bot.init(); // validates the token; throws on 401
  console.log(`[bot] running as @${bot.botInfo.username} (app: ${appUrl ?? 'not configured'})`);
  if (!process.env.BOT_USERNAME) console.log(`[bot] tip: set BOT_USERNAME=${bot.botInfo.username} so the web app can link back to the bot`);

  await bot.api.setMyCommands([
    { command: 'start', description: 'Boshlash va ilovani ochish' },
    { command: 'today', description: 'Bugungi odatlar' },
    { command: 'add', description: 'Tez odat qo‘shish' },
    { command: 'sections', description: 'Bo‘limlar' },
    { command: 'week', description: '7 kunlik grafik' },
    { command: 'streak', description: 'Seriya va daraja' },
    { command: 'motivation', description: 'Kunlik motivatsiya' },
    { command: 'settings', description: 'Eslatma va xulosa sozlamalari' },
    { command: 'stats', description: 'Oxirgi 7 kun statistikasi' },
    { command: 'timezone', description: 'Vaqt mintaqasi' },
    { command: 'help', description: 'Yordam' },
  ]).catch((e) => console.warn('[bot] setMyCommands failed:', e.message));
  await bot.api.setMyShortDescription('Odatlar, eslatmalar va statistika — shaxsiy intizom yordamchingiz.').catch(() => {});
  if (appUrl) {
    await bot.api.setChatMenuButton({ menu_button: { type: 'web_app', text: 'Discipline OS', web_app: { url: appUrl } } })
      .catch((e) => console.warn('[bot] setChatMenuButton failed:', e.message));
  }

  loop(scanReminders, SCAN_EVERY_MS);
  loop(scanDigests, 60_000);
  loop(scanBroadcasts, 3_000);
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
