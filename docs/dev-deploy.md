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

### 3.6 Миграция `editAccessToken` в KV

Начиная с версии с маршрутами `/view/:uuid` и `/edit/:uuid?access=...` заметки хранят дополнительное поле `editAccessToken`.

Перед деплоем обновления выполните миграцию существующих ключей `note:*`:

```powershell
$env:CLOUDFLARE_API_TOKEN="..."
$env:CLOUDFLARE_ACCOUNT_ID="..."
.\scripts\migrate-note-edit-access.ps1 -DryRun
.\scripts\migrate-note-edit-access.ps1
```

Что делает скрипт:

- Читает `NOTES_KV` namespace id из `wrangler.toml` (или принимает `-NamespaceId`).
- Обходит ключи с префиксом `note:`.
- Для заметок без валидного `editAccessToken` генерирует новый alphanumeric-токен и сохраняет запись обратно.

Важно:

- Старые ссылки формата `/:uuid#md5` после миграции работают как просмотр.
- Для редактирования нужна новая ссылка `/edit/:uuid?access=...#md5`; если она ранее не была выдана пользователю, редактирование старой заметки недоступно.

Требования к токену:

- Только `A-Z`, `a-z`, `0-9`.
- Длина по умолчанию: 24 символа (минимум 16).
- Минимум по одному символу: `A-Z`, `a-z`, `0-9`.

### 3.7 Деплой

```bash
npm run deploy
```

### 3.8 Настройка Telegram webhook

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -d "url=https://<YOUR_DOMAIN>/telegram/webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

Проверка:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

### 3.9 Минимальный smoke test

1. Отправить `/start` боту.
2. Нажать `Создать заметку`.
3. Проверить формат ссылки просмотра `/view/:uuid#md5`.
4. Проверить, что кнопка `Редактировать` открывает `/edit/:uuid?access=...#md5`.
5. Проверить наличие кнопки `Автоудаление: Без автоудаления` в отдельном сообщении.
6. Нажать кнопку `Автоудаление: ...`, убедиться, что пришло меню выбора режима.
7. Выбрать режим, убедиться, что меню удалилось, а текст кнопки обновился.
8. Убедиться, что в режиме просмотра текст read-only.
9. Открыть режим редактирования, изменить текст, дождаться автосохранения (30+ секунд).
10. Проверить уведомление об открытии заметки в Telegram.

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
- Ссылка `/view/:uuid#hash` открывает заметку только в режиме просмотра.
- Для редактирования нужен `/edit/:uuid?access=...#hash` и валидный `access` токен.
- В `*.example` и скриптах не храните реальные токены/секреты.
