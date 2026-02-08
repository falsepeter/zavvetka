import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  ArrowUpRight,
  CheckCircle2,
  Cloud,
  Code,
  Github,
  Heart,
  LockKeyhole,
  MessageSquareDot,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-preact";

const GITHUB_URL = "https://github.com/falsepeter/zavvetka.git";
const SITE_URL = "https://zavvetka.ru";
const BOT_WEB_URL = "https://t.me/zavvetka_bot";
const BOT_USERNAME = "@zavvetka_bot";

const trustCards = [
  {
    icon: LockKeyhole,
    title: "Ключи только у Вас",
    text: "Ключ шифрования не передается по интернету и не хранится на сервере",
    delayClass: "[animation-delay:620ms]",
  },
  {
    icon: ShieldCheck,
    title: "Шифрование на клиенте",
    text: "Контент заметки шифруется и декодируется методом AES-256 только в браузере",
    delayClass: "[animation-delay:740ms]",
  },
  {
    icon: Cloud,
    title: "Данные в облаке",
    text: "Edge-сеть Cloudflare Workers позволяет в пару кликов запустить свой ZaVVetka сервер",
    delayClass: "[animation-delay:860ms]",
  },
];

const flow = [
  "Создаете заметку в Telegram и получаете ссылку формата /UUID#md5.",
  "Открываете ссылку, ключ берется из hash и используется только на фронтенде.",
  "Редактируете текст, автосохранение отправляет уже зашифрованные данные в KV.",
  "При каждом открытии создателю приходит уведомление с IP-адресом читателя.",
];

export default function App() {
  return (
    <div class="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_8%,rgba(34,211,238,0.24),transparent_36%),radial-gradient(circle_at_86%_12%,rgba(37,99,235,0.3),transparent_34%),linear-gradient(180deg,#0D1117,#0B1020)]" />
      <main class="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 md:px-10 md:py-14">
        <section class="group/hero">
          <a
            href={BOT_WEB_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="Открыть Telegram-бота ZaVVetka"
            class="block"
          >
            <div
              class="group relative flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-2xl rounded-b-none border border-border/70 bg-background/50 px-5 py-6 md:px-7 md:py-7 [--spotlight-x:50%] [--spotlight-y:50%]"
              onPointerMove={(event) => {
                if (event.pointerType !== "mouse") return;
                const target = event.currentTarget as HTMLDivElement;
                const rect = target.getBoundingClientRect();
                const x = event.clientX - rect.left;
                const y = event.clientY - rect.top;
                target.style.setProperty("--spotlight-x", `${x}px`);
                target.style.setProperty("--spotlight-y", `${y}px`);
              }}
              onPointerLeave={(event) => {
                if (event.pointerType !== "mouse") return;
                const target = event.currentTarget as HTMLDivElement;
                target.style.setProperty("--spotlight-x", "50%");
                target.style.setProperty("--spotlight-y", "50%");
              }}
            >
              <span class="pointer-events-none absolute inset-0 z-0 rounded-2xl rounded-b-none bg-[radial-gradient(520px_circle_at_var(--spotlight-x)_var(--spotlight-y),rgba(34,211,238,0.22),transparent_60%),radial-gradient(860px_circle_at_var(--spotlight-x)_var(--spotlight-y),rgba(37,99,235,0.18),transparent_70%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div class="relative z-10 flex w-full flex-wrap items-center justify-between gap-4">
                <div class="inline-flex items-center gap-4">
                  <img
                    src="/zavvetka_logo.svg"
                    alt="ZaVVetka logo"
                    width="56"
                    height="56"
                    class="h-14 w-14 rounded-xl ring-1 ring-border/60"
                  />
                  <div>
                    <p class="font-display text-lg tracking-tight">ZaVVetka</p>
                    <p class="block w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm text-muted-foreground">
                      Обмен секретными сообщениями
                    </p>
                  </div>
                </div>
                <span
                  class={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "h-11 w-full px-5 md:w-auto md:min-w-44 border-[#30363d] bg-[#24292f] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] hover:border-[#6e7681] hover:bg-[#1f242a] hover:text-white group-hover/hero:bg-secondary group-hover/hero:text-secondary-foreground group-hover/hero:border-secondary/50",
                  )}
                >
                  <Send class="h-4 w-4" />
                  <span>СТАРТ</span>
                </span>
              </div>
            </div>
          </a>
        </section>

        <section class="relative z-20 rounded-3xl rounded-t-none border border-border/70 bg-card/80 p-5 shadow-glass backdrop-blur-sm md:p-10 mt-[calc(-2em-3px)]">
          <h1 class="animate-fade-up max-w-4xl text-2xl leading-tight tracking-tight md:text-4xl">
            Зашифрованные{" "}
            <span class="inline-block whitespace-nowrap bg-[linear-gradient(135deg,#22D3EE,#2563EB)] bg-clip-text text-transparent">
              end-to-end
            </span>{" "}
            заметки
          </h1>
          <ul class="mt-4 space-y-3 text-md text-foreground/90 uppercase-">
            <li class="flex items-center gap-1 animate-fade-up [animation-delay:0ms]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="4"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="lucide lucide-circle-check h-5 w-5 shrink-0 text-primary/70"
              >
                <path d="m6 12 2 4 8-8"></path>
              </svg>
              Содержимое заметки остается приватным и только вашим
            </li>
            <li class="flex items-center gap-1 animate-fade-up [animation-delay:125ms]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="4"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="lucide lucide-circle-check h-5 w-5 shrink-0 text-primary/70"
              >
                <path d="m6 12 2 4 8-8"></path>
              </svg>
              Делитесь заметкой с помощью ссылки или Telegram WebView
            </li>
            <li class="flex items-center gap-1 animate-fade-up [animation-delay:250ms]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="4"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="lucide lucide-circle-check h-5 w-5 shrink-0 text-primary/70"
              >
                <path d="m6 12 2 4 8-8"></path>
              </svg>
              Запускайте свой личный ZaVVetka сервер для полной безопасности
            </li>
          </ul>

          {/* <div class="mt-5 flex flex-wrap items-center gap-3  animate-fade-up [animation-delay:400ms]">
            <Badge variant="outline">Открытый исходный код</Badge>
            <Badge variant="outline" class="hidden">
              Есть инструкция по запуску своего сервера
            </Badge>
          </div> */}
          <div class="mt-5 w-full animate-fade-up [animation-delay:460ms] lg:max-w-[21rem]">
            <div class="group/donate relative w-full">
              <a
                href="https://zavvetka.ru/donate"
                target="_blank"
                rel="noreferrer"
                class={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "w-full border-red-500/40 bg-red-500/10 hover:border-red-500/70 hover:bg-red-500/20",
                )}
              >
                <Heart class="h-4 w-4 fill-red-500 text-red-500" />
                <span>Поддержать проект</span>
              </a>
              <div class="pointer-events-none absolute bottom-full left-0 z-[9999] mb-2 hidden w-full origin-bottom rounded-xl border border-border/70 bg-card/95 p-2 opacity-0 shadow-glass backdrop-blur-sm transition-all duration-300 translate-y-1 scale-95 [@media(hover:hover)_and_(pointer:fine)]:block group-hover/donate:translate-y-0 group-hover/donate:scale-100 group-hover/donate:opacity-100 group-focus-within/donate:translate-y-0 group-focus-within/donate:scale-100 group-focus-within/donate:opacity-100">
                <img
                  src="/assets/donation.svg"
                  alt="QR-код для поддержки проекта"
                  loading="lazy"
                  class="w-full h-auto rounded-lg"
                />
              </div>
            </div>
          </div>
        </section>

        <section id="trust" class="mt-6 space-y-6">
          <div class="animate-fade-up [animation-delay:520ms]">
            <h2 class="text-2xl tracking-tight md:text-3xl">
              Почему{" "}
              <span class="inline-block whitespace-nowrap bg-[linear-gradient(135deg,#22D3EE,#2563EB)] bg-clip-text text-transparent">
                ZaVVetka.ru
              </span>{" "}
              можно доверять
            </h2>
            <p class="mt-3  text-muted-foreground">
              Архитектура построена таким образом, что даже при компрометации
              серверной части заметки будут в безопасности
            </p>
          </div>
          <div class="grid gap-4 lg:grid-cols-3">
            {trustCards.map(({ icon: Icon, title, text, delayClass }) => (
              <Card
                class={cn("animate-fade-up border-border/70", delayClass)}
                key={title}
              >
                <CardHeader>
                  <div class="flex items-center gap-2">
                    <Icon class="h-5 w-5 shrink-0 text-white/60" />
                    <CardTitle class="whitespace-nowrap text-lg">
                      {title}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>{text}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
        {/* 
        <section class="animate-fade-up [animation-delay:460ms] rounded-2xl border border-border/70 bg-card/90 p-6 md:p-8">
          <div class="flex items-center gap-3">
            <Sparkles class="h-5 w-5 text-primary" />
            <h3 class="font-display text-2xl md:text-3xl">Как это работает</h3>
          </div>
          <Separator class="my-5" />
          <ol class="grid gap-4 md:grid-cols-2">
            {flow.map((item, index) => (
              <li class="flex items-start gap-3 rounded-lg border border-border/60 bg-background/75 p-4" key={item}>
                <span class="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-bold text-primary">
                  {index + 1}
                </span>
                <span class="text-sm text-foreground/90">{item}</span>
              </li>
            ))}
          </ol>
        </section> */}

        <section class="animate-fade-up [animation-delay:1000ms] rounded-2xl border border-border/60 bg-card/90 p-5 md:p-8">
          <div class="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h3 class="flex items-center gap-2 text-2xl tracking-tight md:text-2xl">
                <Code class="hidden h-6 w-6 text-white/60 sm:block" />
                <span>Открытый исходный код</span>
              </h3>
              {/* <p class="mt-3 text-muted-foreground">
                Код можно проверить, воспроизвести локально и развернуть в Cloudflare Workers.<br />
                Прозрачность архитектуры гораздо лучше обещаний и доверия
              </p> */}
              <ul class="mt-4 space-y-2 text-sm text-foreground/90">
                <li class="flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="4"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="lucide lucide-circle-check h-5 w-5 shrink-0 text-secondary"
                  >
                    <path d="m6 12 2 4 8-8"></path>
                  </svg>
                  Простая архитектура без скрытых сервисов
                </li>
                <li class="flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="4"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="lucide lucide-circle-check h-5 w-5 shrink-0 text-secondary"
                  >
                    <path d="m6 12 2 4 8-8"></path>
                  </svg>
                  Техническая документация по запуску и деплою
                </li>
                <li class="flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="4"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="lucide lucide-circle-check h-5 w-5 shrink-0 text-secondary"
                  >
                    <path d="m6 12 2 4 8-8"></path>
                  </svg>
                  Каждый может вносить изменения и участвовать в развитии
                </li>
              </ul>
            </div>
            <div class="flex flex-col gap-3">
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                class={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "w-full border-[#30363d] bg-[#24292f] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] hover:border-[#6e7681] hover:bg-[#1f242a] hover:text-white",
                )}
              >
                <Github class="h-4 w-4" />
                <span>Смотреть репозиторий</span>
                {/* <ArrowUpRight class="h-4 w-4" /> */}
              </a>
              <a
                href="https://t.me/truepeter"
                target="_blank"
                rel="noreferrer"
                class={cn(
                  buttonVariants({ variant: "secondary", size: "lg" }),
                  "w-full",
                )}
              >
                <MessageSquareDot class="h-4 w-4" />
                <span>Написать разработчику</span>
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
