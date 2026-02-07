# ZaVVetka Landing (Cloudflare Pages)

Отдельный лендинг на `Preact` с UI-компонентами в стиле `shadcn-ui`, Tailwind и сборкой через Vite.

## Что внутри

- Современный лендинг с секциями:
  - описание проекта,
  - почему ему можно доверять,
  - как работает архитектура,
  - CTA на GitHub.
- Компоненты shadcn-style:
  - `src/components/ui/button.tsx`
  - `src/components/ui/card.tsx`
  - `src/components/ui/badge.tsx`
  - `src/components/ui/separator.tsx`
- Готовая конфигурация Cloudflare Pages:
  - `wrangler.toml` с `pages_build_output_dir = "./dist"`
- Бренд-ассеты в `public/`:
  - `zavvetka_logo.svg`
  - `zavvetka_logo_512.png`
  - `zavvetka_favicon.ico`
- Цветовая палитра:
  - `Background`: `#0D1117`
  - `Primary 1`: `#22D3EE`
  - `Primary 2`: `#2563EB`

## Запуск локально

```bash
cd landing-pages
npm install
npm run dev
```

## Production build

```bash
npm run build
npm run preview
```

## Деплой на Cloudflare Pages

```bash
npm run deploy
```

Или вручную:

```bash
npm run build
npx wrangler pages deploy dist --project-name zavvetka-landing
```

## GitHub ссылка

В лендинге уже указана ссылка на текущий репозиторий:

```ts
const GITHUB_URL = "https://github.com/falsepeter/zavvetka.git";
```
