# Запуск и деплой

Актуально на 8 февраля 2026 года.

## 1. Сервисы в репозитории

- Основной Worker (`/`) - `src/index.ts`, `src/note-page.ts`.
- Лендинг Cloudflare Pages - `landing-pages/`.
- Donations Worker - `donations-worker/`.

## 2. Предварительные требования

- Node.js 20+ и npm.
- Аккаунт Cloudflare.
- Telegram Bot Token и webhook secret для основного Worker.
- `wrangler` устанавливается через `npm install` в каждом подпроекте.

## 3. Основной Worker (`zavvetka`)

### 3.1 Установка зависимостей

```bash
npm install
```

### 3.2 Авторизация в Cloudflare

```bash
npx wrangler login
```

### 3.3 Создание KV namespace

```bash
npx wrangler kv namespace create NOTES_KV
npx wrangler kv namespace create NOTES_KV --preview
```

Затем обновите `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "NOTES_KV"
id = "..."
preview_id = "..."
```

### 3.4 Настройка переменных окружения

PowerShell:

```powershell
Copy-Item .dev.vars.example .dev.vars
```

Linux/macOS:

```bash
cp .dev.vars.example .dev.vars
```

Минимально необходимые переменные для dev:

```env
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_SECRET=...
PUBLIC_DOMAIN=http://127.0.0.1:8787
```

Дополнительно в проекте используются служебные значения:

```env
TELEGRAM_BOT_USERNAME=@zavvetka_bot
TELEGRAM_BOT_WEB_URL=https://t.me/zavvetka_bot
```

Для production задайте секреты:

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler secret put PUBLIC_DOMAIN
```

### 3.5 Локальный запуск и проверка

```bash
npm run dev
```

Дополнительные режимы:

```bash
npm run dev:local
npm run dev:remote
```

Проверка health endpoint:

```bash
curl http://127.0.0.1:8787/health
```

PowerShell-альтернатива:

```powershell
Invoke-WebRequest http://127.0.0.1:8787/health
```

### 3.6 Деплой

```bash
npm run deploy
```

### 3.7 Настройка Telegram webhook

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -d "url=https://<YOUR_DOMAIN>/telegram/webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

Проверка:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

### 3.8 Минимальный smoke test

1. Отправить `/start` боту.
2. Нажать `Создать заметку`.
3. Проверить формат ссылки `/uuid#md5`.
4. Открыть заметку, изменить текст, дождаться автосохранения (30+ секунд).
5. Проверить смену режима автоудаления и уведомление об открытии в Telegram.

## 4. Лендинг (`landing-pages/`)

### 4.1 Локальный запуск

```bash
cd landing-pages
npm install
npm run dev
```

### 4.2 Сборка и проверка production

```bash
npm run build
npm run preview
```

### 4.3 Деплой в Cloudflare Pages

```bash
npm run deploy
```

Эквивалент ручной команды:

```bash
npx wrangler pages deploy dist --project-name zavvetka-landing
```

Рекомендуемые настройки проекта в Cloudflare Pages:

- Root directory: `landing-pages`
- Build command: `npm run build`
- Build output directory: `dist`

## 5. Donations Worker (`donations-worker/`)

### 5.1 Локальный запуск

```bash
cd donations-worker
npm install
npm run dev
```

### 5.2 Деплой

Интерактивно:

```bash
npm run deploy
```

Через PowerShell-скрипт (CI/неинтерактивно):

```powershell
.\deploy.ps1 -CloudflareApiToken "..." -CloudflareAccountId "..."
```

Или через переменные окружения:

```powershell
$env:CLOUDFLARE_API_TOKEN="..."
$env:CLOUDFLARE_ACCOUNT_ID="..."
.\deploy.ps1
```

Проверка токена Cloudflare API:

```powershell
curl "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/tokens/verify" -H "Authorization: Bearer <TOKEN>"
```

Проверка редиректа:

```bash
curl -I https://<DONATION_DOMAIN>
```

## 6. Важные замечания

- Ключ шифрования находится только в URL hash и не передается серверу.
- Потеря hash-ключа делает расшифровку невозможной.
- Любой, у кого есть полный URL (`uuid + hash`), получит доступ к заметке.
- В `*.example` и скриптах не храните реальные токены/секреты.
