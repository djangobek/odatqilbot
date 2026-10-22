# Audit va tuzatishlar

## Production / Railway
| Muammo | Tuzatish |
|---|---|
| `tsx` devDependency edi, productionda bot ishga tushmasligi mumkin edi | `dependencies` ga ko'chirildi, Dockerfile `npm prune --omit=dev` qiladi |
| Build Nixpacks'ga bog'liq, volume ruxsatlari noaniq | Deterministik `Dockerfile` (root, `/app/data`), `railway.json` yangilandi |
| Bot yiqilsa (masalan 409) butun servis o'chardi | `start.mjs` botni alohida nazorat qiladi (backoff bilan qayta ishga tushiradi); config xatosida (kod 78) restart-loop yo'q, web ishlayveradi |
| `SESSION_SECRET` uzunligi turli joyda turlicha (16/32) | Hamma joyda productionda ≥32 |
| `WEB_APP_URL` qo'lda va hardcode | `src/lib/env.ts` — yagona manba; Railway domeniga fallback |
| `.env.example` to'liq emas | Barcha o'zgaruvchilar tavsiflangan |
| Avtomatik zaxira yo'q | Bot jarayoni kunlik snapshot + rotatsiya |

## Xavfsizlik / barqarorlik
- So'rov hajmi cheklovi (64 KB), foydalanuvchi bo'yicha rate-limit (300/daq), `x-real-ip` bilan IP aniqlash.
- Sana oralig'i `2020-01-01…2100-12-31` va odatlar soni ≤100: `startDate=0001-01-01` orqali bitta thread'ni band qiladigan statistik hisob (DoS) yopildi.
- Odat tahrirlanganda `endDate < startDate` tekshiruvi serverga ham qo'shildi.
- HSTS, `object-src 'none'`, `base-uri`, `form-action`, API javoblari `no-store`.

## Bot
- Qo'lda yozilgan SQL va takroriy jadval logikasi olib tashlandi: web bilan bir xil servis kodi ishlatiladi.
- Eslatma: aniq-daqiqa sharti o'rniga 10 daqiqalik "catch-up" oynasi; yuborishdan oldin slot band qilinadi (dublikat yo'q), vaqtincha xatoda qaytariladi.
- 403 (bloklagan) → eslatma o'chiriladi; 429 → `retry_after` kutiladi; xabarlar orasida pauza.
- Yangi: `/stats`, `/timezone`, `/today` ichida belgilash tugmalari, eslatmada ✅/⏭️ tugmalar, bot tavsifi, 7 ta buyruq menyusi.

## Frontend / dizayn
- **Safe-area xatosi:** `.pb-safe` Tailwind `p-5/pb-3` ni bosib ketardi → modal tugmasi va pastki menyu chetga yopishib qolardi. Aniq `calc()` bilan almashtirildi.
- Toast taymeri bir-birini o'chirardi; context har renderda yangi obyekt edi → Modal fokusni o'g'irlardi. Tuzatildi.
- Kun izohi (note) qayta yuklashda yozilayotgan matnni o'chirib yuborardi; endi "saqlanmagan" holati bor.
- `useApi` oy/davr almashganda eski ma'lumotni indikatorsiz ko'rsatardi (`loading` hech qachon true bo'lmasdi) → `refreshing` holati.
- Kalendarda ma'nosiz `setKey(k => k)`; progress "2/3 → 100%" nomuvofiqligi (o'tkazilganlar maxrajga qo'shilardi) tuzatildi.
- Sessiya (7 kun) tugasa — avtomatik qayta autentifikatsiya; yarim tundan keyin "bugun" yangilanadi.
- Skeleton yuklash, 44px tap-targetlar, 11px+ yorliqlar, iOS focus-zoom yo'q (16px input), zoom taqiqi olib tashlandi, `disableVerticalSwipes`.
- Telegramdan tashqarida: "Botni ochish" tugmasi (`BOT_USERNAME` dan).

## Tekshirilmadi (bu muhitda internet yo'q edi)
`npm install`, `tsc`, `vitest`, `next build`, Docker build bu yerda ishga tushirilmadi. Fayllarning sintaksisi va sof logika (env, vaqt mintaqalari) tekshirilgan. Deploydan oldin lokalda: `npm install && npm run typecheck && npm test && npm run build`.

## PostgreSQL migration

- Storage moved from SQLite (better-sqlite3, file + volume) to PostgreSQL (`pg` + Drizzle `node-postgres`), configured with `DATABASE_URL`.
- All data access is async; transactions use `db.transaction(async tx => ...)`. Reminder claiming is `INSERT .. ON CONFLICT DO NOTHING RETURNING` (one winner across concurrent scanners); user upsert is one atomic `ON CONFLICT DO UPDATE`.
- `telegram_id` and all epoch-ms timestamps are `bigint` (32-bit `integer` would overflow); booleans are native.
- Migrations regenerated for PostgreSQL; the runner retries until the DB is reachable and holds an advisory lock.
- SQLite backup code removed; use managed Postgres backups or `npm run db:backup` (pg_dump).
- `scripts/sqlite-to-postgres.mjs` imports an existing SQLite file transactionally, preserving ids.
