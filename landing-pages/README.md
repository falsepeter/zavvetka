# Cайт ZaVVetka.ru

Лендинг на `Preact.js` с UI-компонентами в стиле `shadcn-ui` с прекомпилятором Tailwind и сборкой через Vite.

![Landing screenshot](../assets/readme_landing_2.jpg)

## Ссылки

- Сайт: `https://zavvetka.ru`
- Telegram bot: `@zavvetka_bot`
- Ссылка на Telegram bot: `https://t.me/zavvetka_bot`
- GitHub репозиторий: `https://github.com/falsepeter/zavvetka.git`
- Написать разработчику: `https://t.me/truepeter`

## Палитра цветов

- Фоновый: `#0D1117`
- Первичный: `#22D3EE`
- Вторичный: `#2563EB`

## Структура

- `wrangler.toml` — конфиг файл для Cloudflare Pages.
- `src/App.tsx` — тексты, блоки, ссылки, CTA.
- `src/index.css` — базовые стили, шрифты, палитра.
- `src/components/` - компоненты
- `public/` — логотипы и favicon.

## Запуск локального режима

```bash
cd landing-pages
npm install
npm run dev
```

## Сборка проекта (production build)

```bash
npm run build
npm run preview
```

## Размещение на Cloudflare Pages

```bash
npm run deploy
```

Или вручную:

```bash
npm run build
npx wrangler pages deploy dist --project-name zavvetka-landing
```

### Настройки размещения

- `Root directory`: `landing-pages`
- `Build command`: `npm run build`
- `Build output directory`: `dist`

### Переменные окружения

- Для работы лендинга не требуются.
- Для деплоя через CI/неинтерактивный режим нужен `CLOUDFLARE_API_TOKEN`.
