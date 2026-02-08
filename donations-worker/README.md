# Donations Worker

Отдельный Cloudflare Worker для URL доната.

- Worker name: `zavvetka-donat`
- Entry point: `src/index.ts`
- Логика: любой входящий запрос отвечает `302` на `https://yoomoney.ru/to/4100119459265589/0`

## Локальный запуск

```bash
cd donations-worker
npm install
npm run dev
```

Доступны режимы:

```bash
npm run dev:local
npm run dev:remote
```

## Деплой

Базовый вариант:

```bash
cd donations-worker
npm run deploy
```

PowerShell-скрипт для неинтерактивного запуска:

```powershell
cd donations-worker
.\deploy.ps1 -CloudflareApiToken "..." -CloudflareAccountId "..."
```

Скрипт также использует заранее заданные переменные:

```powershell
$env:CLOUDFLARE_API_TOKEN="..."
$env:CLOUDFLARE_ACCOUNT_ID="..."
.\deploy.ps1
```

## Проверки

Проверка Cloudflare API токена:

```powershell
curl "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/tokens/verify" -H "Authorization: Bearer <TOKEN>"
```

Проверка редиректа:

```bash
curl -I https://<DONATION_DOMAIN>
```
