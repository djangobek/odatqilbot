# Discipline OS

Telegram Mini App: odatlar, **bo‘limlar (sections)**, oy kalendari (Bugun sahifasida), statistika va yutuqlar, fokus taymer, kunlik yozuvlar va Telegram bot (eslatmalar, ertalabki reja, kechki xulosa, tez qo‘shish).

**Stack:** Next.js 15 · React 19 · TypeScript · Tailwind · Drizzle + PostgreSQL · grammY · Zod · Vitest

## Railway'ga joylash (qadam-baqadam)

1. Loyihani **private** GitHub repoga yuklang (`package-lock.json` ni ham commit qiling: lokalda `npm install` qilsangiz yaratiladi).
2. Railway → **New Project → Deploy from GitHub repo**. `Dockerfile` avtomatik aniqlanadi.
3. Loyihaga **+ New → Database → Add PostgreSQL** qo'shing (Volume kerak emas — ma'lumotlar Postgres'da).
4. Servis → **Settings → Networking → Generate Domain** (HTTPS domen beriladi).
5. **Variables** bo'limiga qo'shing:

| O'zgaruvchi | Majburiy | Izoh |
|---|---|---|
| `BOT_TOKEN` | ✅ | @BotFather tokeni |
| `SESSION_SECRET` | ✅ | kamida 32 belgi: `openssl rand -hex 32` |
| `WEB_APP_URL` | ➖ | Mini App manzili. Bo'sh qoldirsangiz Railway'ning `RAILWAY_PUBLIC_DOMAIN` i ishlatiladi |
| `BOT_USERNAME` | tavsiya | `@`siz; Telegramdan tashqarida ochilganda botga havola ko'rsatadi |
| `DATABASE_URL` | ✅ | Railway'da: `${{Postgres.DATABASE_URL}}` (Postgres servisiga reference) |
| `DATABASE_SSL` | ➖ | faqat provayder SSL talab qilsa: `true` (o'z-o'zidan imzolangan sertifikat uchun `no-verify`). Railway ichki tarmog'ida kerak emas |
| `SUPPORT_URL`, `CHANNEL_URL` | ixtiyoriy | botning `/help` xabarida tugma bo'lib chiqadi |

6. Deploy tugagach `https://DOMEN/api/health` → `{"ok":true}` bo'lishi kerak. Loglarda `[bot] running as @...` ko'rinadi.
7. Botga `/start` yozing → **📱 Ilovani ochish**.

> Faqat **1 replika** ishlating (long polling). Bir xil token bilan ikkinchi bot jarayonini (masalan lokal kompyuterda) ishga tushirmang — Telegram `409 Conflict` qaytaradi.

Barcha havolalar env'dan olinadi: bot tugmalari (`/`, `/habits`, `/stats`, `/settings`), menyu tugmasi, eslatma xabarlaridagi tugma, Telegramdan tashqarida ko'rsatiladigan "Botni ochish" havolasi (`/api/config`).

## Lokal ishga tushirish (Windows / PowerShell)

```powershell
Copy-Item .env.example .env.local
docker compose up -d db     # lokal PostgreSQL (yoki o'z Postgres'ingiz; DATABASE_URL ni moslang)
npm install
npm run db:migrate
npm run dev          # http://localhost:3000 (dev-login faqat lokal)
npm run bot          # alohida oynada, BOT_TOKEN kerak
```

Telegram ichida sinash uchun HTTPS tunnel (masalan Cloudflare Tunnel) oching va `WEB_APP_URL` ga qo'ying.

## Bot buyruqlari

`/start` · `/today` (shu yerning o'zida ✅ belgilash) · `/stats` · `/reminders_on` · `/reminders_off` · `/timezone Asia/Tashkent` · `/help`

Eslatma xabarida **✅ Bajardim / ⏭️ O'tkazish** tugmalari bor. Bot ishlamay turgan bo'lsa ham eslatma 10 daqiqagacha kechikib yuboriladi; botni bloklagan foydalanuvchiga eslatma avtomatik o'chiriladi.

## Tekshiruvlar

```powershell
npm run typecheck
npm test            # Postgres server shart emas: PGlite (WASM Postgres) ishlatiladi
npm run build
```

Haqiqiy Postgres bilan (tezroq, production'ga o'xshash) — har test o'z schema'sida ishlaydi va oxirida o'chiriladi:

```powershell
$env:TEST_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/discipline_test"
npm test
```

## Ma'lumotlar

PostgreSQL (`DATABASE_URL`). Migratsiyalar `npm start` paytida avtomatik qo'llanadi (baza hali tayyor bo'lmasa kutadi va qayta urinadi; ikki nusxa bir vaqtda ishga tushsa advisory lock himoya qiladi).

**Zaxira:** Railway Postgres servisining **Backups** bo'limini yoqing. Qo'lda dump kerak bo'lsa: `npm run db:backup` (`pg_dump` o'rnatilgan bo'lishi kerak) → `backups/discipline-*.dump`; tiklash: `pg_restore --clean --no-owner -d "$DATABASE_URL" fayl.dump`.

### SQLite'dan ko'chirish (bir martalik)

Eski `discipline.db` dagi foydalanuvchilar, odatlar, yozuvlar va izohlarni Postgres'ga o'tkazish:

```powershell
npm install
$env:DATABASE_URL = "postgresql://..."      # Railway: Postgres → Connect → Public URL
npm run db:migrate                           # sxemani yaratadi
npm run db:import-sqlite -- ./data/discipline.db
```

Skript bitta tranzaksiyada ishlaydi (xatoda hech narsa yozilmaydi), ID'larni saqlaydi, hisoblagichlarni (identity) davom ettiradi va qatorlar sonini solishtiradi. Maqsadli baza bo'sh bo'lmasa to'xtaydi (`--force` avval tozalaydi). SQLite fayli faqat o'qish rejimida ochiladi. Railway'dagi eski volume'dan faylni oldin yuklab oling (masalan `railway run` / volume backup orqali).


## Yangi imkoniyatlar

- **Bo‘limlar**: Bugun sahifasidagi `+` tugmasi bilan yarating ("Til", "Kitoblar"...). Har bir odat bitta bo‘limga tegishli; bo‘limni o‘chirsangiz odatlar saqlanadi.
- **Bot**: `/add Kitob 21:00 #Til` yoki `+ Suv ichish 09:00` (tez qo‘shish), `/sections`, `/week`, `/streak`, `/motivation`, `/settings` (eslatma · 08:00 reja · 21:00 xulosa).
- **Daraja va yutuqlar**: bajarilgan odatlar soniga qarab daraja, 9 ta yutuq nishoni, eng kuchli/zaif hafta kuni.
- **Baza**: `0001_sections` migratsiyasi (yangi jadvallar + ustunlar) ishga tushganda avtomatik qo‘llanadi; mavjud ma’lumotlar o‘zgarmaydi.

## "Telegram autentifikatsiyadan o‘tmadi" bo‘lsa

Ilova xato kodini ko‘rsatadi:

| Kod | Sabab | Yechim |
|---|---|---|
| `bad_signature` | Web servisdagi `BOT_TOKEN` ilovani ochgan bot tokeniga mos emas | Railway’da **web** va **bot** servislarida bir xil token; `/api/health` dagi `botId` bot ID’si bilan mos kelishi kerak |
| `expired` | initData eskirgan (`TELEGRAM_AUTH_MAX_AGE`, standart 7 kun) | Ilovani botdan qayta oching |
| `future_date` | Telefon vaqti noto‘g‘ri | Avtomatik sana/vaqtni yoqing |
| `no_bot_token` | Serverda `BOT_TOKEN` yo‘q | O‘zgaruvchini qo‘shing |

Token endi avtomatik tozalanadi (bo‘sh joy, qo‘shtirnoq, `bot` prefiksi) — Railway’da ko‘p uchraydigan xato shu edi.


## Admin panel

Set `ADMIN_TELEGRAM_IDS=<your numeric Telegram id>` (ask @userinfobot; several ids separated by commas) on the **web and bot** services, then run `npm run db:migrate` (migration `0002_admin`).

* An admin who opens the Mini App lands on `/admin` automatically and can switch to the regular user view (and back) with one tap.
* **Boshqaruv** – users, DAU/WAU/MAU, 30-day charts, top habits, feature usage.
* **Foydalanuvchilar** – search, filters, details, ban/unban, promote/demote, delete, direct message, CSV export.
* **Xabarlar** – mass messages (audiences, `{name}`, **bold**/__italic__, button, scheduling, live progress, cancel). Messages are delivered by the bot process (`npm run bot`), rate-limited, resumable after restarts; users who blocked the bot are detected automatically.
* **Tizim** – maintenance mode, in-app announcement banner, health, audit log of every admin action.

Admin API lives under `/api/admin/*`; the role is re-checked in the database on every request.
