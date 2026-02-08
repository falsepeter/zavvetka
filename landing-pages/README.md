# Лендинг ZaVVetka (`landing-pages`)

Отдельное SPA-приложение для публичной страницы проекта на Cloudflare Pages.

![Landing screenshot](../assets/readme_landing_2.jpg)

## Стек

- `Preact`
- `Vite`
- `Tailwind CSS`
- `lucide-preact`
- UI-компоненты в стиле shadcn (`src/components/ui`)

## Структура

- `src/App.tsx` - основной контент страницы, CTA, блок доверия, блок Open Source.
- `src/index.css` - тема, шрифты, базовые токены и утилиты.
- `src/components/ui/*` - переиспользуемые UI-компоненты.
- `src/lib/utils.ts` - утилиты (`cn` и т.п.).
- `public/` - статические ассеты (лого, favicon, QR).
- `wrangler.toml` - конфигурация деплоя в Cloudflare Pages.

## Команды

```bash
cd landing-pages
npm install
npm run dev
npm run check
npm run build
npm run preview
```

## Деплой в Cloudflare Pages

```bash
cd landing-pages
npm run deploy
```

Ручной эквивалент:

```bash
npm run build
npx wrangler pages deploy dist --project-name zavvetka-landing
```

### Рекомендуемые настройки проекта в Cloudflare Pages

- `Root directory`: `landing-pages`
- `Build command`: `npm run build`
- `Build output directory`: `dist`

## Переменные окружения

- Для runtime лендинга переменные окружения не требуются.
- Для CI-деплоя нужен `CLOUDFLARE_API_TOKEN`.

## Ссылки проекта

- Сайт: `https://zavvetka.ru`
- Telegram bot: `@zavvetka_bot` (`https://t.me/zavvetka_bot`)
- GitHub: `https://github.com/falsepeter/zavvetka.git`
