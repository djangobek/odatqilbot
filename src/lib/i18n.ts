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

// Russian UI copy. Keys not listed here deliberately fall back to Uzbek during gradual content rollout.
const ru: Partial<Record<keyof Dict, string | readonly string[]>> = {
  today:'Сегодня', yesterday:'Вчера', tomorrow:'Завтра', navToday:'Сегодня', navHabits:'Привычки', navSettings:'Настройки', navStats:'Статистика',
  completed:'Выполнено', todo:'Нужно выполнить', skipped:'Пропущено', missed:'Не выполнено', habitsDone:'привычек выполнено', progress:'Прогресс за сегодня', dayProgress:'Прогресс дня',
  noHabitsTitle:'Пока нет привычек', noHabitsText:'Добавьте первую привычку и начните путь к дисциплине.', createFirst:'Создать первую привычку', freeDay:'На этот день планов нет', freeDayText:'Привычек не запланировано. Отдохните.',
  newHabit:'Новая привычка', editHabit:'Изменить привычку', name:'Название', namePh:'Например: читать 20 минут', description:'Описание', category:'Категория', icon:'Значок', startDate:'Дата начала', endDate:'Дата окончания (необязательно)', reminder:'Время напоминания', repeat:'Повторение', everyDay:'Каждый день', workdays:'Рабочие дни', save:'Сохранить', saved:'Сохранено', cancel:'Отмена', close:'Закрыть',
  active:'Активные', archive:'Архив', archiveAction:'В архив', restore:'Восстановить', remove:'Удалить', edit:'Изменить', archiveEmpty:'Архив пуст', archiveHint:'История привычек в архиве сохраняется.', deleteTitle:'Удалить привычку навсегда?', deleteText:'Все ежедневные записи также будут удалены. Чтобы сохранить историю, лучше архивировать привычку.', skip:'Пропустить', unskip:'Вернуть',
  notes:'Заметки дня', wentWell:'Что получилось хорошо', difficult:'Что было сложно', observations:'Наблюдения', calendar:'Календарь', goToday:'К сегодняшнему дню', schedule:'План', completionTime:'Время выполнения', stats:'Статистика', last7:'7 дней', last30:'30 дней', thisMonth:'Этот месяц', allTime:'Всё время', completionRate:'Процент выполнения', currentStreak:'Текущая серия', bestStreak:'Лучшая серия', days:'дн.', dailyChart:'Выполнение по дням', byHabit:'По привычкам', scheduledTotal:'Запланировано', noStats:'Сначала добавьте привычку для статистики', noData:'Нет данных', openBot:'Открыть бота', weekLabel:'Неделя', mainNav:'Главное меню', prevYear:'Предыдущий год', prevMonth:'Предыдущий месяц', nextMonth:'Следующий месяц', nextYear:'Следующий год',
  unsaved:'Несохранённые изменения', loading:'Загрузка…', error:'Произошла ошибка', retry:'Повторить', openInTelegram:'Откройте приложение в Telegram', openInTelegramText:'Это мини-приложение работает только через вашего Telegram-бота.', hello:'Здравствуйте', allDone:'Всё выполнено. Отлично!', keepGoing:'Продолжайте!',
  allSections:'Все', addSection:'Добавить раздел', sectionName:'Название раздела', sectionNamePh:'Например: Изучение языков', renameSection:'Переименовать', deleteSection:'Удалить раздел', deleteSectionTitle:'Удалить раздел?', deleteSectionText:'Привычки не удалятся — они останутся без раздела.', noSection:'Без раздела', section:'Раздел', ok:'ОК', sectionEmpty:'На сегодня в этом разделе нет привычек', sectionEmptyText:'Добавьте новую привычку в этот раздел.', addHabit:'Добавить привычку', moreOptions:'Дополнительно', lessOptions:'Меньше', calendarToggle:'Календарь месяца', collapse:'Свернуть',
  level:'Уровень', levelTitles:['Новичок','Ученик','Устойчивый','Дисциплинированный','Мастер','Наставник','Легенда'], toNext:'до следующего уровня', completions:'выполнений', daysInRow:'дней подряд', achievements:'Достижения', unlocked:'Открыто', locked:'Закрыто', insights:'Аналитика', bestWeekday:'Самый продуктивный день', weakWeekday:'Самый слабый день', needMoreData:'Для анализа нужны данные минимум за 2 недели.', focus:'Фокус-таймер', focusStart:'Старт', focusPause:'Пауза', focusReset:'Сбросить', focusDone:'Время вышло!', markDone:'Отметить выполненным', minutes:'минут',
  settings:'Настройки', remindersSetting:'Напоминания о привычках', remindersHint:'Бот будет присылать сообщения в заданное время.', morningSetting:'Утренний план (08:00)', morningHint:'Список привычек на начало дня.', eveningSetting:'Вечерний итог (21:00)', eveningHint:'Результат дня и невыполненные привычки.', timezoneLabel:'Часовой пояс', timezoneAuto:'Определить по устройству', botSection:'Telegram-бот', authFailed:'Не удалось войти', reopen:'Открыть снова', code:'Код',
  weekdayShort:['Вс','Пн','Вт','Ср','Чт','Пт','Сб'], weekdayLong:['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'], months:['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'], stateComplete:'Полностью', statePartial:'Частично', stateMissed:'Пропущено', stateNone:'Нет плана', stateOpen:'В процессе',
};

export type Language = 'uz' | 'ru';
export function getLanguage(): Language {
  if (typeof window === 'undefined') return 'uz';
  try { return window.localStorage.getItem('discipline-os-language') === 'ru' ? 'ru' : 'uz'; } catch { return 'uz'; }
}
export function setLanguage(language: Language) {
  if (typeof window !== 'undefined') {
    try { window.localStorage.setItem('discipline-os-language', language); } catch { /* private mode */ }
  }
}
// A getter-based dictionary lets existing UI call sites remain compatible; changing language reloads the UI atomically.
export const t = new Proxy(uz as Dict, {
  get(target, key: string | symbol) {
    if (typeof key !== 'string') return Reflect.get(target, key);
    const language = getLanguage();
    if (language === 'ru' && key in ru) return ru[key as keyof Dict] ?? Reflect.get(target, key);
    return Reflect.get(target, key);
  },
});
