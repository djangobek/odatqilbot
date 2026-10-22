// All user-facing text lives here.
const uz = {
  today: 'Bugun', yesterday: 'Kecha', tomorrow: 'Ertaga',
  navToday: 'Bugun', navHabits: 'Odatlar', navSettings: 'Sozlamalar', navStats: 'Statistika',
  completed: 'Bajarilgan', todo: 'Bajarilishi kerak', skipped: 'O‘tkazilgan', missed: 'Bajarilmagan',
  habitsDone: 'odat bajarildi', progress: 'Bugungi jarayon', dayProgress: 'Kun jarayoni',
  noHabitsTitle: 'Hali odatlar yo‘q', noHabitsText: 'Birinchi odatingizni qo‘shib, intizom yo‘lini boshlang.',
  createFirst: 'Birinchi odatni yaratish',
  freeDay: 'Bu kun bo‘sh', freeDayText: 'Rejalashtirilgan odat yo‘q. Dam oling.',
  newHabit: 'Yangi odat', editHabit: 'Odatni tahrirlash',
  name: 'Nomi', namePh: 'Masalan: 20 daqiqa kitob o‘qish', description: 'Izoh', category: 'Turkum', icon: 'Belgi',
  startDate: 'Boshlanish sanasi', endDate: 'Tugash sanasi (ixtiyoriy)', reminder: 'Eslatma vaqti', repeat: 'Takrorlanishi',
  everyDay: 'Har kuni', workdays: 'Ish kunlari', save: 'Saqlash', saved: 'Saqlandi', cancel: 'Bekor qilish', close: 'Yopish',
  active: 'Faol', archive: 'Arxiv', archiveAction: 'Arxivlash', restore: 'Tiklash', remove: 'O‘chirish', edit: 'Tahrirlash',
  archiveEmpty: 'Arxiv bo‘sh', archiveHint: 'Arxivlangan odatlar tarixi saqlanadi.',
  deleteTitle: 'Odatni butunlay o‘chirasizmi?',
  deleteText: 'Barcha kunlik yozuvlar ham o‘chadi. Tarixni saqlash uchun arxivlash yaxshiroq.',
  skip: 'O‘tkazib yuborish', unskip: 'Qaytarish',
  notes: 'Kun yozuvlari', wentWell: 'Nima yaxshi o‘tdi', difficult: 'Nima qiyin bo‘ldi', observations: 'Kuzatuvlar',
  calendar: 'Kalendar', goToday: 'Bugunga', schedule: 'Reja', completionTime: 'Bajarilgan vaqt',
  stats: 'Statistika', last7: '7 kun', last30: '30 kun', thisMonth: 'Shu oy', allTime: 'Hammasi',
  completionRate: 'Bajarish foizi', currentStreak: 'Joriy seriya', bestStreak: 'Eng yaxshi seriya', days: 'kun',
  dailyChart: 'Kunlik bajarilish', byHabit: 'Odatlar kesimida', scheduledTotal: 'Rejalashtirilgan',
  noStats: 'Statistika uchun avval odat qo‘shing', noData: 'Ma’lumot yo‘q',
  openBot: 'Botni ochish', weekLabel: 'Hafta', mainNav: 'Asosiy', prevYear: 'Oldingi yil', prevMonth: 'Oldingi oy', nextMonth: 'Keyingi oy', nextYear: 'Keyingi yil',
  unsaved: 'Saqlanmagan o‘zgarishlar', loading: 'Yuklanmoqda…', error: 'Xatolik yuz berdi', retry: 'Qayta urinish',
  openInTelegram: 'Ilovani Telegram orqali oching', openInTelegramText: 'Bu mini-ilova faqat Telegram botingiz orqali ishlaydi.',
  hello: 'Salom', allDone: 'Hammasi bajarildi. Zo‘r!', keepGoing: 'Davom eting!',
  // sections
  allSections: 'Hammasi', addSection: 'Bo‘lim qo‘shish', sectionName: 'Bo‘lim nomi', sectionNamePh: 'Masalan: Til o‘rganish', renameSection: 'Nomini o‘zgartirish',
  deleteSection: 'Bo‘limni o‘chirish', deleteSectionTitle: 'Bo‘limni o‘chirasizmi?', deleteSectionText: 'Odatlar o‘chmaydi — ular bo‘limsiz qoladi.',
  noSection: 'Bo‘limsiz', section: 'Bo‘lim', ok: 'OK', sectionEmpty: 'Bu bo‘limda bugun odat yo‘q', sectionEmptyText: 'Shu bo‘limga yangi odat qo‘shing.', addHabit: 'Odat qo‘shish',
  moreOptions: 'Qo‘shimcha', lessOptions: 'Kamroq', calendarToggle: 'Oy kalendari', collapse: 'Yig‘ish',
  // gamification
  level: 'Daraja', levelTitles: ['Boshlovchi', 'O‘rganuvchi', 'Barqaror', 'Intizomli', 'Usta', 'Ustoz', 'Afsona'],
  toNext: 'keyingi darajagacha', completions: 'bajarilish', daysInRow: 'kun ketma-ket',
  achievements: 'Yutuqlar', unlocked: 'Ochilgan', locked: 'Yopiq', insights: 'Kuzatuv',
  bestWeekday: 'Eng kuchli kun', weakWeekday: 'Eng zaif kun', needMoreData: 'Tahlil uchun kamida 2 hafta ma’lumot kerak.',
  focus: 'Fokus taymer', focusStart: 'Boshlash', focusPause: 'Pauza', focusReset: 'Qayta', focusDone: 'Vaqt tugadi!', markDone: 'Bajarildi deb belgilash', minutes: 'daqiqa',
  // settings
  settings: 'Sozlamalar', remindersSetting: 'Odat eslatmalari', remindersHint: 'Har bir odat vaqtida botdan xabar keladi.',
  morningSetting: 'Ertalabki reja (08:00)', morningHint: 'Kun boshida bugungi odatlar ro‘yxati.',
  eveningSetting: 'Kechki xulosa (21:00)', eveningHint: 'Kun natijasi va bajarilmagan odatlar.',
  timezoneLabel: 'Vaqt mintaqasi', timezoneAuto: 'Qurilmadan aniqlash', botSection: 'Telegram bot', 
  authFailed: 'Kirib bo‘lmadi', reopen: 'Qayta ochish', code: 'Kod',
  weekdayShort: ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'],
  weekdayLong: ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'],
  months: ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'],
  stateComplete: 'To‘liq', statePartial: 'Qisman', stateMissed: 'O‘tkazib yuborilgan', stateNone: 'Reja yo‘q', stateOpen: 'Jarayonda',
} as const;

export type Dict = typeof uz;
export const dict: Dict = uz; // add `ru`, `en` and a selector here later
export const t = dict;
