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
  LockKeyhole,
  MessageSquareDot,
  ShieldCheck,
  Sparkles,
} from "lucide-preact";

const GITHUB_URL = "https://github.com/falsepeter/zavvetka.git";

const trustCards = [
  {
    icon: LockKeyhole,
    title: "Ключа нет на сервере",
    text: "Ключ шифрования передается только в hash URL. Сервер хранит шифртекст и не может его расшифровать.",
  },
  {
    icon: ShieldCheck,
    title: "Шифрование в браузере",
    text: "Контент заметки шифруется AES-256-GCM на клиенте до отправки в Cloudflare KV.",
  },
  {
    icon: Cloud,
    title: "Инфраструктура на Cloudflare",
    text: "Worker и Pages работают на edge-сети Cloudflare с быстрым откликом и простой эксплуатацией.",
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
      <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_6%,rgba(14,116,144,0.2),transparent_38%),radial-gradient(circle_at_88%_12%,rgba(249,115,22,0.22),transparent_35%),linear-gradient(180deg,rgba(240,249,255,0.95),rgba(255,251,235,1))]" />
      <main class="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 py-10 md:px-10 md:py-14">
        <section class="animate-fade-up rounded-3xl border border-border/60 bg-card/85 p-7 shadow-glass backdrop-blur-sm md:p-10">
          <div class="flex flex-wrap items-center gap-3">
            <Badge>Telegram + Cloudflare</Badge>
            <Badge variant="outline">Preact + shadcn-ui</Badge>
          </div>
          <h1 class="mt-6 max-w-4xl font-display text-4xl leading-tight tracking-tight md:text-6xl">
            ZaVVetka: приватные заметки из Telegram, которые сервер не может прочитать
          </h1>
          <p class="mt-5 max-w-3xl text-base text-muted-foreground md:text-lg">
            Проект делает одно важное обещание: содержимое заметки остается вашим. Ключ
            шифрования хранится только у пользователя, а Cloudflare Worker работает с
            зашифрованным payload.
          </p>
          <div class="mt-8 flex flex-wrap items-center gap-3">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              class={buttonVariants({ size: "lg" })}
            >
              <span>GitHub проекта</span>
              <ArrowUpRight class="h-4 w-4" />
            </a>
            <a href="#trust" class={buttonVariants({ size: "lg", variant: "outline" })}>
              <span>Почему можно доверять</span>
            </a>
          </div>
        </section>

        <section id="trust" class="space-y-6">
          <div class="animate-fade-up [animation-delay:120ms]">
            <h2 class="font-display text-3xl tracking-tight md:text-4xl">Почему проекту можно доверять</h2>
            <p class="mt-3 max-w-3xl text-muted-foreground">
              Архитектура построена так, чтобы даже при компрометации серверной части
              открытый текст заметки не оказался на бэкенде.
            </p>
          </div>
          <div class="grid gap-4 md:grid-cols-3">
            {trustCards.map(({ icon: Icon, title, text }, index) => (
              <Card
                class="animate-fade-up border-border/70"
                style={{ animationDelay: `${220 + index * 120}ms` }}
                key={title}
              >
                <CardHeader>
                  <Icon class="mb-3 h-6 w-6 text-primary" />
                  <CardTitle>{title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{text}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

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
        </section>

        <section class="animate-fade-up [animation-delay:620ms] rounded-2xl border border-border/60 bg-card/90 p-6 md:p-8">
          <div class="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <h3 class="font-display text-2xl tracking-tight md:text-3xl">Открытый исходный код</h3>
              <p class="mt-3 text-muted-foreground">
                Код можно проверить, воспроизвести локально и развернуть в Cloudflare Pages.
                Прозрачность архитектуры важнее рекламных обещаний.
              </p>
              <ul class="mt-4 space-y-2 text-sm text-foreground/90">
                <li class="flex items-center gap-2">
                  <CheckCircle2 class="h-4 w-4 text-primary" /> Техническая документация по
                  запуску и деплою
                </li>
                <li class="flex items-center gap-2">
                  <CheckCircle2 class="h-4 w-4 text-primary" /> Проверяемая схема шифрования
                  и хранения
                </li>
                <li class="flex items-center gap-2">
                  <CheckCircle2 class="h-4 w-4 text-primary" /> Простая архитектура без скрытых
                  сервисов
                </li>
              </ul>
            </div>
            <div class="flex flex-col gap-3">
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                class={cn(buttonVariants({ size: "lg" }), "w-full")}
              >
                <span>Смотреть репозиторий</span>
                <ArrowUpRight class="h-4 w-4" />
              </a>
              <a
                href="https://zavvetka.ru"
                target="_blank"
                rel="noreferrer"
                class={cn(buttonVariants({ variant: "secondary", size: "lg" }), "w-full")}
              >
                <span>Открыть проект</span>
                <MessageSquareDot class="h-4 w-4" />
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
