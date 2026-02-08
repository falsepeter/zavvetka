# Техническая документация

Актуально на 8 февраля 2026 года.

## Состав репозитория

- `src/` - основной Cloudflare Worker (`zavvetka`) с Telegram webhook и API заметок.
- `landing-pages/` - отдельный фронтенд-лендинг на Preact + Vite для Cloudflare Pages.
- `donations-worker/` - отдельный Cloudflare Worker с редиректом на страницу доната.
- `docs/` - эксплуатационная и техническая документация.

## Основной Worker (`src/index.ts`, `src/note-page.ts`)

### Формат ссылки заметки

```text
https://<domain>/view/<uuid>#<md5-key>
https://<domain>/edit/<uuid>?access=<edit-access-token>#<md5-key>
```

Пример:

```text
https://zavvetka.ru/view/07924a52-11f6-4f81-bcd1-09f795411f41#c22a92514ec06c94f696a7377db58707
https://zavvetka.ru/edit/07924a52-11f6-4f81-bcd1-09f795411f41?access=AbC123xYz987LmN456QwErTy#c22a92514ec06c94f696a7377db58707
```

Часть `#<md5-key>` не отправляется на сервер, поэтому ключ шифрования серверу неизвестен.
Параметр `access` отправляется на сервер и используется для проверки права редактирования заметки.
Требования к `access`: только `A-Z`, `a-z`, `0-9`, длина `16..128`, минимум по одному символу каждого типа.

### HTTP-маршруты

| Метод | Маршрут | Назначение |
| --- | --- | --- |
| `GET` | `/health` | Проверка доступности Worker + состояние Telegram webhook (`getWebhookInfo`) + количество заметок в KV. |
| `POST` | `/telegram/webhook` | Входящие updates от Telegram, `/start`, создание заметки, callback-кнопки автоудаления. |
| `POST` | `/api/notes` | Сервисное создание заметки по API (`creatorChatId`, `creatorUserId`). |
| `GET` | `/api/notes/:uuid` | Чтение шифртекста и метаданных заметки. |
| `PUT` | `/api/notes/:uuid?access=<token>` | Сохранение зашифрованного содержимого (`ciphertext`, `iv`) с проверкой edit-access. |
| `DELETE` | `/api/notes/:uuid?access=<token>` | Удаление заметки с проверкой edit-access. |
| `POST` | `/api/notes/:uuid/auto-delete?access=<token>` | Изменение режима автоудаления (`mode`) с проверкой edit-access. |
| `GET` | `/` | Встроенный минимальный landing HTML. |
| `GET` | `/view/:uuid` | Встроенная HTML-страница просмотра заметки (read-only). |
| `GET` | `/edit/:uuid?access=<token>` | Встроенная HTML-страница редактирования заметки (доступ проверяется по `access`). |
| `GET` | `/:uuid` | Legacy-маршрут: работает как просмотр (`/view/:uuid`) для обратной совместимости. |

### Поведение автоудаления

Поддерживаются режимы: `off`, `5m`, `15m`, `30m`, `60m`, `24h`, `onRead`.

- Таймерные режимы устанавливают `expiresAt` относительно момента переключения режима.
- При `onRead` заметка удаляется сразу после успешного `GET /api/notes/:uuid`, а клиент получает `deletedAfterRead: true`.
- При чтении просроченной заметки запись удаляется из KV и возвращается `404`.

### Модель данных в KV

Ключ в KV: `note:<uuid>`.

```json
{
  "uuid": "07924a52-11f6-4f81-bcd1-09f795411f41",
  "ciphertext": "base64",
  "iv": "base64",
  "createdAt": "2026-02-07T10:00:00.000Z",
  "updatedAt": "2026-02-07T10:00:30.000Z",
  "creatorChatId": 123456789,
  "creatorUserId": 123456789,
  "autoDelete": "off",
  "expiresAt": null,
  "openCount": 1,
  "editAccessToken": "AbC123xYz987LmN456QwErTy"
}
```

### Шифрование и сохранение

- Ключ извлекается из `location.hash`, ожидается 32 hex-символа.
- Из значения hash вычисляется `SHA-256`, затем импортируется ключ `AES-GCM`.
- Текст заметки шифруется на клиенте; сервер получает только `ciphertext` и `iv` (base64).
- Автосохранение в редакторе запускается через 30 секунд после последнего ввода.

### Telegram-интеграция

- При `/start` бот показывает persistent-кнопку `Создать заметку`.
- При создании заметки бот отправляет:
  - ссылку просмотра (`/view/:uuid#md5`);
  - кнопку `Редактировать` (`/edit/:uuid?access=...#md5`);
  - отдельное сообщение с кнопкой `Автоудаление: <текущий режим>`.
- По нажатию `Автоудаление: ...` бот отправляет новое сообщение с inline-кнопками всех режимов.
- После выбора режима бот удаляет сообщение со списком режимов и обновляет текст кнопки `Автоудаление: ...`.
- При каждом открытии заметки отправляется уведомление создателю с IP (`CF-Connecting-IP`).

### Формат `/health`

- Корневые поля ответа:
  - `ok`
  - `now`
  - `webhook`
  - `notesKv`
- `webhook` - состояние webhook из Telegram `getWebhookInfo`.
- При успешном запросе Telegram (`webhook.ok = true`) возвращаются:
  - `url` (текущий webhook URL)
  - `pendingUpdates`
  - `hasCustomCertificate`
  - `ipAddress`
  - `maxConnections`
  - `allowedUpdates`
  - `lastErrorMessage`
  - `lastErrorDate`, `lastErrorAt`
  - `lastSynchronizationErrorDate`, `lastSynchronizationErrorAt`
  - `info` (сырой `result` от Telegram API)
- При ошибке Telegram (`webhook.ok = false`) возвращаются `description`, `pendingUpdates`, `info` и служебное поле `currentWebhookUrl`.
- `notesKv` - состояние подсчёта заметок в KV по префиксу `note:`.
- При успешном подсчёте (`notesKv.ok = true`) возвращаются:
  - `count` (текущее количество заметок)
  - `pagesScanned` (количество страниц, прочитанных через `KV.list`)
- При ошибке подсчёта (`notesKv.ok = false`) возвращаются `description`, `count = null`, `pagesScanned = null`.

### Переменные окружения

Обязательные для основного Worker:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `PUBLIC_DOMAIN`
- KV binding `NOTES_KV` в `wrangler.toml`


Команды для создания переменных окружения:

Локально (`.dev.vars`):

```powershell
Copy-Item .dev.vars.example .dev.vars
```

```bash
cp .dev.vars.example .dev.vars
```


### Запуск Telegram-бота на Cloudflare Worker

1. Установите зависимости и авторизуйтесь в Cloudflare:

```bash
npm install
npx wrangler login
```

2. Проверьте, что в `wrangler.toml` настроен KV binding `NOTES_KV` (`id` и `preview_id`).

Команды для создания KV namespace (Cloudflare):

```bash
npx wrangler kv namespace create "NOTES_KV"
npx wrangler kv namespace create "NOTES_KV" --preview
```

3. Задайте production-секреты Worker:

Скрипт читает все переменные из `.dev.vars` и загружает их в secrets Worker:

```powershell
.\scripts\set-worker-secrets.ps1
```

`PUBLIC_DOMAIN` указывайте как публичный домен Worker (без завершающего `/`), например `https://zavvetka.ru`.

4. Выполните деплой Worker:

```bash
npm run deploy
```

5. Установите webhook в Telegram на маршрут Worker `/telegram/webhook`:

```powershell
.\scripts\set-telegram-webhook.ps1
```

6. Проверьте webhook и доступность Worker:

```powershell
.\scripts\check-telegram-webhook.ps1
```

7. Если обработка апдейтов Telegram остановилась, сбросьте webhook и установите его заново:

Скрипт удаления webhook:

```powershell
.\scripts\delete-telegram-webhook.ps1
```

Опционально можно удалить накопившиеся необработанные апдейты:

```powershell
.\scripts\delete-telegram-webhook.ps1 -DropPendingUpdates
```

После удаления webhook установите его заново:

```powershell
.\scripts\set-telegram-webhook.ps1
```

Такая последовательность (`delete webhook` -> `set webhook`) может помочь перезапустить «зависший» процесс обработки апдейтов.

Важно: Worker проверяет заголовок `X-Telegram-Bot-Api-Secret-Token`; если он не совпадает с `TELEGRAM_WEBHOOK_SECRET`, webhook-запросы будут отклоняться с `401`.

## Лендинг (`landing-pages/`)

- Стек: Preact, Vite, Tailwind CSS, `lucide-preact`.
- Деплой: Cloudflare Pages (`wrangler pages deploy dist --project-name zavvetka-landing`).
- Точка входа UI: `landing-pages/src/App.tsx`.

## Donations Worker (`donations-worker/`)

- Любой запрос отвечает `302` на `https://yoomoney.ru/to/4100119459265589/0`.
- Точка входа: `donations-worker/src/index.ts`.
- Worker name: `zavvetka-donat` (см. `donations-worker/wrangler.toml`).

## Смежные документы

- Инструкция запуска и деплоя: `docs/dev-deploy.md`.
- Документация лендинга: `landing-pages/README.md`.
- Документация donations-worker: `donations-worker/README.md`.
