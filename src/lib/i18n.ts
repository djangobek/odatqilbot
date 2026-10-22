// All user-facing text lives here so Russian/English can be added as extra dictionaries later.
const uz = {
  today: 'Bugun', yesterday: 'Kecha', tomorrow: 'Ertaga',
  navToday: 'Bugun', navHabits: 'Odatlar', navCalendar: 'Kalendar', navStats: 'Statistika',
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
  weekdayShort: ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'],
  weekdayLong: ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'],
  months: ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'],
  stateComplete: 'To‘liq', statePartial: 'Qisman', stateMissed: 'O‘tkazib yuborilgan', stateNone: 'Reja yo‘q', stateOpen: 'Jarayonda',
} as const;

export type Dict = typeof uz;
export const dict: Dict = uz; // add `ru`, `en` and a selector here later
export const t = dict;
