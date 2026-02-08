# Donations Worker

Отдельный Cloudflare Worker для страницы донатов. Любой запрос переадресуется на:

`https://yoomoney.ru/to/4100119459265589/0`

## Локальный запуск

```bash
cd donations-worker
npm install
npm run dev
```

## Деплой

```bash
cd donations-worker
npm run deploy
```

Или через PowerShell-скрипт:

```powershell
cd donations-worker
.\deploy.ps1 -CloudflareApiToken "..." -CloudflareAccountId "..."
```

Скрипт также умеет читать уже выставленные переменные окружения:

```powershell
$env:CLOUDFLARE_API_TOKEN="..."
$env:CLOUDFLARE_ACCOUNT_ID="..."
.\deploy.ps1
```


Проверка cloudflate API токена:
```powershell
curl "https://api.cloudflare.com/client/v4/accounts/****/tokens/verify" -H "Authorization: Bearer ..."
```

