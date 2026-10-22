// Short daily motivation lines (shared by the Mini App and the bot). Pure data: no framework imports.
export const QUOTES = [
  'Kichik qadam ham — oldinga qadam.',
  'Motivatsiya kelib-ketadi, intizom qoladi.',
  'Bugungi kichik g‘alaba ertangi katta natijaning poydevori.',
  'Mukammallik emas, izchillik muhim.',
  'Boshlash uchun tayyor bo‘lishni kutmang.',
  'Zanjirni uzmang: bugun ham bajaring.',
  'Har kuni 1% yaxshiroq — yil oxirida 37 baravar.',
  'Odatlar taqdirni emas, kunni o‘zgartirishdan boshlanadi.',
  'Qiyin bo‘lsa ham bajarilgan odat — eng kuchli odat.',
  'Bugun qilgan ishingiz ertangi “men”ingizga sovg‘a.',
  'Sekin bo‘lsa ham to‘xtamang.',
  'Intizom — o‘zingizga bergan va’daga sodiqlik.',
  'Kecha o‘tdi, ertaga hali kelmadi. Bugun — sizniki.',
  'Katta o‘zgarish kichik takrorlardan quriladi.',
] as const;

/** Same line for the whole day, different on the next day. */
export function quoteOfDay(date: string): string {
  let h = 0;
  for (const ch of date) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return QUOTES[h % QUOTES.length];
}

/** XP-style level derived from the total number of completed habit-days. */
export function levelOf(completed: number) {
  const level = Math.floor(Math.sqrt(Math.max(0, completed) / 4)) + 1;
  const from = 4 * (level - 1) ** 2;
  const to = 4 * level ** 2;
  return { level, from, to, progress: Math.min(1, Math.max(0, (completed - from) / (to - from))) };
}

export const STREAK_MILESTONES = [3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 365] as const;
