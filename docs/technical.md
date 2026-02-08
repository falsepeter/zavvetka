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
https://<domain>/<uuid>#<md5-key>
```

Пример:

```text
https://zavvetka.ru/07924a52-11f6-4f81-bcd1-09f795411f41#c22a92514ec06c94f696a7377db58707
```

Часть `#<md5-key>` не отправляется на сервер, поэтому ключ шифрования серверу неизвестен.

### HTTP-маршруты

| Метод | Маршрут | Назначение |
| --- | --- | --- |
| `GET` | `/health` | Проверка доступности Worker. |
| `POST` | `/telegram/webhook` | Входящие updates от Telegram, `/start`, создание заметки, callback-кнопки автоудаления. |
| `POST` | `/api/notes` | Сервисное создание заметки по API (`creatorChatId`, `creatorUserId`). |
| `GET` | `/api/notes/:uuid` | Чтение шифртекста и метаданных заметки. |
| `PUT` | `/api/notes/:uuid` | Сохранение зашифрованного содержимого (`ciphertext`, `iv`). |
| `DELETE` | `/api/notes/:uuid` | Удаление заметки. |
| `POST` | `/api/notes/:uuid/auto-delete` | Изменение режима автоудаления (`mode`). |
| `GET` | `/` | Встроенный минимальный landing HTML. |
| `GET` | `/:uuid` | Встроенная HTML-страница редактора заметки. |

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
  "openCount": 1
}
```

### Шифрование и сохранение

- Ключ извлекается из `location.hash`, ожидается 32 hex-символа.
- Из значения hash вычисляется `SHA-256`, затем импортируется ключ `AES-GCM`.
- Текст заметки шифруется на клиенте; сервер получает только `ciphertext` и `iv` (base64).
- Автосохранение в редакторе запускается через 30 секунд после последнего ввода.

### Telegram-интеграция

- При `/start` бот показывает persistent-кнопку `Создать заметку`.
- При создании заметки отправляется ссылка и inline-кнопки режимов автоудаления.
- При каждом открытии заметки отправляется уведомление создателю с IP (`CF-Connecting-IP`).

### Переменные окружения

Обязательные для основного Worker:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `PUBLIC_DOMAIN`
- KV binding `NOTES_KV` в `wrangler.toml`

Дополнительные (используются как служебные значения в окружении проекта, но не читаются рантаймом `src/index.ts`):

- `TELEGRAM_BOT_USERNAME`
- `TELEGRAM_BOT_WEB_URL`

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
