# ZaVVetka

<p align="center">
  <img src="assets/branding/zavvetka_logo_512.png" alt="ZaVVetka logo" width="160" />
</p>

Телеграм-бот + Cloudflare Worker для зашифрованных заметок.

Ключ шифрования хранится только в `hash` части ссылки (`#...`) и не попадает на сервер. Сервер хранит в Cloudflare KV только шифртекст и метаданные заметки.

## Ссылки проекта

- Сайт: `https://zavvetka.ru`
- Telegram бот: `@zavvetka_bot`
- Web-ссылка на бота: `https://t.me/zavvetka_bot`
- GitHub: `https://github.com/falsepeter/zavvetka.git`

## Что реализовано

- Лендинг для проекта на Preact (Cloudflare Pages). Подробнее в [landing-pages/README.md](landing-pages/README.md).
- Кнопка Telegram `Создать заметку` (`/start` + reply keyboard).
- Сообщение от бота:
  - `Заметка от DD.MM.YY HH:MM создана`.
  - Полная ссылка вида `https://domain/UUID#md5`.
  - Кнопка `Редактировать` (Telegram `web_app`).
  - Переключатель автоудаления:
    - `5 мин`, `15 мин`, `30 мин`, `60 мин`, `24 часа`, `Удалить при первом прочтении`, `Без автоудаления`.
- Страница заметки:
  - минималистичный редактор текста (desktop + mobile),
  - AES-256-GCM шифрование/дешифрование на фронтенде,
  - автосохранение через 30 секунд после последнего ввода (debounce),
  - защита от параллельных сохранений,
  - статус последнего сохранения с секундами,
  - кнопка удаления,
  - таймер автоудаления.
- Уведомление создателю при каждом открытии:
  - `Заметка от ... только что была открыта с IP адреса: ...`

## Формат ссылки

```text
https://<домен>/<uuid>#<md5-ключ>
```

Пример:

```text
https://zavvetka.ru/07924a52-11f6-4f81-bcd1-09f795411f41#c22a92514ec06c94f696a7377db58707
```

`hash` часть (`#...`) не уходит на сервер, поэтому сервер не знает ключ шифрования.

## Архитектура

- `src/index.ts`
  - HTTP маршрутизация Worker.
  - Telegram webhook (`/telegram/webhook`).
  - API заметок (`/api/notes/*`).
  - Работа с Cloudflare KV (`NOTES_KV`).
- `src/note-page.ts`
  - HTML/CSS/JS страницы заметки.
  - Клиентское шифрование/дешифрование через Web Crypto API.
  - Логика автосохранения, удаления, таймера.
- Хранилище:
  - Cloudflare KV, ключ: `note:<uuid>`.

## Модель данных в KV

```json
{
  "uuid": "07924a52-11f6-4f81-bcd1-09f795411f41",
  "ciphertext": "base64",
  "iv": "base64",
  "createdAt": "2026-02-07T10:00:00.000Z",
  "updatedAt": "2026-02-07T10:00:30.000Z",
  "creatorChatId": 123456789,
  "creatorUserId": 123456789,
  "autoDelete": "off|5m|15m|30m|60m|24h|onRead",
  "expiresAt": "2026-02-07T10:05:00.000Z",
  "openCount": 1
}
```

## API

- `POST /telegram/webhook`
  - Вход Telegram updates.
- `GET /api/notes/:uuid`
  - Возвращает шифртекст и метаданные.
  - Отправляет уведомление создателю об открытии.
  - Если режим `onRead`, удаляет заметку после чтения.
- `PUT /api/notes/:uuid`
  - Обновляет `ciphertext`, `iv`, `updatedAt`.
- `DELETE /api/notes/:uuid`
  - Удаляет заметку.
- `POST /api/notes/:uuid/auto-delete`
  - Изменяет режим автоудаления (доп. endpoint).
- `POST /api/notes`
  - Технический endpoint создания заметки (доп. endpoint).
- `GET /:uuid`
  - Отдает web-редактор заметки.

## Шифрование

- На фронтенде:
  - ключ берется из `location.hash`,
  - проверяется как 32 hex (`md5` формат),
  - из него строится AES ключ: `SHA-256(hash)`,
  - контент шифруется `AES-256-GCM`.
- На сервере:
  - нет ключа шифрования,
  - хранится только `{ciphertext, iv}` и метаданные.

## Переменные окружения

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `PUBLIC_DOMAIN`
- KV binding: `NOTES_KV`

Файлы:

- `wrangler.toml`
- `.dev.vars.example`

## Документация запуска и деплоя

Подробная пошаговая инструкция:

- `docs/dev-deploy.md`
- `landing-pages/README.md` (отдельный лендинг на Preact для Cloudflare Pages)

## Быстрые команды

```bash
npm install
npm run dev
npm run dev:remote
npm run deploy
```

## Ограничения текущей версии

- Нет авторизации по пользователю на открытие/редактирование заметки.
- Любой, у кого есть `uuid + hash-ключ`, может читать и редактировать.
- `onRead` удаляет заметку сразу после первого успешного `GET /api/notes/:uuid`.
