# Запуск в Dev и Публикация в Cloudflare Workers

## 1. Требования

- Node.js 20+ и npm.
- Аккаунт Cloudflare.
- Созданный Telegram бот и токен (`TELEGRAM_BOT_TOKEN`).
- Установленный `wrangler` (через `npm install` в проекте).
- Рабочие ссылки проекта:
  - сайт `https://zavvetka.ru`
  - бот `@zavvetka_bot` (`https://t.me/zavvetka_bot`)

## 2. Установка зависимостей

В корне проекта:

```bash
npm install
```

## 3. Логин в Cloudflare

```bash
npx wrangler login
```

## 4. Создание KV namespace

Прод:

```bash
npx wrangler kv namespace create NOTES_KV
```

Preview (для `wrangler dev`):

```bash
npx wrangler kv namespace create NOTES_KV --preview
```

Скопируйте `id` и `preview_id` и вставьте в `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "NOTES_KV"
id = "..."
preview_id = "..."
```

## 5. Настройка переменных окружения

### Dev

Скопируйте шаблон:

```bash
cp .dev.vars.example .dev.vars
```

Заполните `.dev.vars`:

```env
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_SECRET=...
PUBLIC_DOMAIN=http://127.0.0.1:8787
```

### Prod (секреты Cloudflare)

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler secret put PUBLIC_DOMAIN
```

`PUBLIC_DOMAIN` должен быть прод-доменом, например `https://zavvetka.ru`.

## 6. Запуск в dev режиме

`wrangler dev` запускает локальную среду Workers на базе Miniflare (локальный режим по умолчанию).

### Локальный режим (Miniflare)

```bash
npm run dev
```

Worker будет доступен обычно по адресу:

```text
http://127.0.0.1:8787
```

Проверка:

```bash
curl http://127.0.0.1:8787/health
```

Альтернативная явная команда:

```bash
npm run dev:local
```

### Удаленный режим (для проверки в реальной edge-среде Cloudflare)

```bash
npm run dev:remote
```

## 7. Публикация в Cloudflare Workers

```bash
npm run deploy
```

После деплоя получите URL worker или подключите кастомный домен через Cloudflare dashboard.

## 8. Настройка Telegram webhook

После деплоя установите webhook:

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -d "url=https://<YOUR_DOMAIN>/telegram/webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

Проверка webhook:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

## 9. Минимальный чек-лист проверки

1. Открыть бота, отправить `/start`.
2. Нажать `Создать заметку`.
3. Проверить, что пришла ссылка формата `/uuid#md5`.
4. Открыть ссылку, ввести текст.
5. Подождать 30+ секунд после ввода, проверить статус сохранения.
6. Проверить таймер автоудаления.
7. Проверить уведомление об открытии заметки в Telegram.

## 10. Важные замечания

- Ключ шифрования хранится только в URL hash и не передается на сервер.
- Потеря hash-ключа означает невозможность расшифровать заметку.
- Любой, у кого есть ссылка целиком (`uuid + hash`), получит доступ к заметке.
