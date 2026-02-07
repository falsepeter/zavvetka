import { renderLandingPage, renderNotePage } from "./note-page";

interface Env {
  NOTES_KV: KVNamespace;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  PUBLIC_DOMAIN: string;
}

type AutoDeleteMode = "off" | "5m" | "15m" | "30m" | "60m" | "24h" | "onRead";

interface NoteRecord {
  uuid: string;
  ciphertext: string;
  iv: string;
  createdAt: string;
  updatedAt: string;
  creatorChatId: number;
  creatorUserId: number;
  autoDelete: AutoDeleteMode;
  expiresAt: string | null;
  openCount: number;
}

interface TelegramUser {
  id: number;
}

interface TelegramChat {
  id: number;
}

interface TelegramMessage {
  message_id: number;
  chat: TelegramChat;
  from?: TelegramUser;
  text?: string;
}

interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  data?: string;
}

interface TelegramUpdate {
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

interface TelegramApiResult {
  ok: boolean;
  description?: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const AUTO_DELETE_OPTIONS: Array<{ mode: AutoDeleteMode; ms: number | null }> = [
  { mode: "off", ms: null },
  { mode: "5m", ms: 5 * 60 * 1000 },
  { mode: "15m", ms: 15 * 60 * 1000 },
  { mode: "30m", ms: 30 * 60 * 1000 },
  { mode: "60m", ms: 60 * 60 * 1000 },
  { mode: "24h", ms: 24 * 60 * 60 * 1000 },
  { mode: "onRead", ms: null },
];

const AUTO_DELETE_LABELS: Record<AutoDeleteMode, string> = {
  off: "Без автоудаления",
  "5m": "5 мин",
  "15m": "15 мин",
  "30m": "30 мин",
  "60m": "60 мин",
  "24h": "24 часа",
  onRead: "Удалить при первом прочтении",
};

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      return await routeRequest(request, env, ctx);
    } catch (error) {
      console.error("Unhandled error:", error);
      return jsonResponse({ ok: false, error: "Внутренняя ошибка сервера." }, 500);
    }
  },
};

async function routeRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === "/health") {
    return jsonResponse({ ok: true, now: new Date().toISOString() });
  }

  if (url.pathname === "/telegram/webhook") {
    return handleTelegramWebhook(request, env, url.origin);
  }

  if (url.pathname.startsWith("/api/notes")) {
    return handleNotesApi(request, env, ctx, url);
  }

  if (url.pathname === "/") {
    return htmlResponse(renderLandingPage());
  }

  const uuid = extractUuidFromPath(url.pathname);
  if (uuid) {
    return htmlResponse(renderNotePage(uuid));
  }

  return jsonResponse({ ok: false, error: "Маршрут не найден." }, 404);
}

async function handleTelegramWebhook(
  request: Request,
  env: Env,
  origin: string,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Метод не поддерживается." }, 405);
  }

  const webhookSecret = env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (webhookSecret) {
    const incomingSecret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (incomingSecret !== webhookSecret) {
      return jsonResponse({ ok: false, error: "Некорректный webhook secret." }, 401);
    }
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return jsonResponse({ ok: false, error: "Некорректный JSON webhook-а." }, 400);
  }

  if (update.message?.text) {
    const chatId = update.message.chat.id;
    const userId = update.message.from?.id ?? chatId;
    const text = update.message.text.trim();

    if (text === "/start") {
      await sendTelegramMessage(env, {
        chat_id: chatId,
        text:
          "Нажмите кнопку \"Создать заметку\", чтобы получить ссылку и открыть редактор.",
        reply_markup: {
          keyboard: [[{ text: "Создать заметку" }]],
          resize_keyboard: true,
          is_persistent: true,
        },
      });
      return jsonResponse({ ok: true });
    }

    if (text.toLowerCase() === "создать заметку") {
      await createNoteAndSendToTelegram(env, origin, chatId, userId);
      return jsonResponse({ ok: true });
    }
  }

  if (update.callback_query?.data) {
    await handleAutoDeleteCallback(env, update.callback_query);
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ ok: true });
}

async function handleAutoDeleteCallback(env: Env, query: TelegramCallbackQuery): Promise<void> {
  const callbackData = query.data ?? "";
  const parts = callbackData.split(":");
  if (parts.length !== 3 || parts[0] !== "auto") {
    await answerTelegramCallback(env, query.id, "Неизвестная команда.");
    return;
  }

  const uuid = parts[1];
  const mode = parts[2] as AutoDeleteMode;
  if (!UUID_PATTERN.test(uuid) || !isAutoDeleteMode(mode)) {
    await answerTelegramCallback(env, query.id, "Некорректные параметры.");
    return;
  }

  const note = await readNote(env, uuid);
  if (!note) {
    await answerTelegramCallback(env, query.id, "Заметка не найдена.");
    return;
  }

  if (note.creatorUserId !== query.from.id) {
    await answerTelegramCallback(env, query.id, "Только создатель может менять автоудаление.");
    return;
  }

  applyAutoDeleteMode(note, mode, Date.now());
  await writeNote(env, note);
  await answerTelegramCallback(env, query.id, `Автоудаление: ${AUTO_DELETE_LABELS[mode]}`);
}

async function createNoteAndSendToTelegram(
  env: Env,
  origin: string,
  creatorChatId: number,
  creatorUserId: number,
): Promise<void> {
  const nowIso = new Date().toISOString();
  const uuid = crypto.randomUUID();
  const hashKey = await generateMd5Key();

  const note: NoteRecord = {
    uuid,
    ciphertext: "",
    iv: "",
    createdAt: nowIso,
    updatedAt: nowIso,
    creatorChatId,
    creatorUserId,
    autoDelete: "off",
    expiresAt: null,
    openCount: 0,
  };

  await writeNote(env, note);

  const baseUrl = normalizePublicDomain(env.PUBLIC_DOMAIN, origin);
  const noteUrl = `${baseUrl}/${uuid}#${hashKey}`;
  const message = [
    `Заметка от ${formatDateRu(note.createdAt)} создана.`,
    "",
    `Ссылка: ${noteUrl}`,
    "",
    "Кнопка ниже открывает webview-редактор, а остальные кнопки переключают автоудаление.",
  ].join("\n");

  await sendTelegramMessage(env, {
    chat_id: creatorChatId,
    text: message,
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [
        [{ text: "Редактировать", web_app: { url: noteUrl } }],
        [
          { text: "5 мин", callback_data: `auto:${uuid}:5m` },
          { text: "15 мин", callback_data: `auto:${uuid}:15m` },
        ],
        [
          { text: "30 мин", callback_data: `auto:${uuid}:30m` },
          { text: "60 мин", callback_data: `auto:${uuid}:60m` },
        ],
        [
          { text: "24 часа", callback_data: `auto:${uuid}:24h` },
          { text: "Первое прочтение", callback_data: `auto:${uuid}:onRead` },
        ],
        [{ text: "Без автоудаления", callback_data: `auto:${uuid}:off` }],
      ],
    },
  });
}

async function handleNotesApi(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  url: URL,
): Promise<Response> {
  const parts = url.pathname.split("/").filter(Boolean);

  if (parts.length === 2 && request.method === "POST") {
    return createNoteFromApi(request, env, url.origin);
  }

  if (parts.length < 3) {
    return jsonResponse({ ok: false, error: "UUID заметки не указан." }, 400);
  }

  const uuid = parts[2];
  if (!UUID_PATTERN.test(uuid)) {
    return jsonResponse({ ok: false, error: "Некорректный UUID." }, 400);
  }

  if (parts.length === 4 && parts[3] === "auto-delete" && request.method === "POST") {
    return updateAutoDeleteFromApi(request, env, uuid);
  }

  if (parts.length !== 3) {
    return jsonResponse({ ok: false, error: "Маршрут API не найден." }, 404);
  }

  const note = await readNote(env, uuid);
  if (!note) {
    return jsonResponse({ ok: false, error: "Заметка не найдена." }, 404);
  }

  if (isExpired(note, Date.now())) {
    await deleteNote(env, uuid);
    return jsonResponse({ ok: false, error: "Заметка удалена по таймеру." }, 404);
  }

  if (request.method === "GET") {
    const ip = request.headers.get("CF-Connecting-IP") ?? "0.0.0.0";

    const responsePayload = {
      ok: true,
      note: serializeNoteForClient(note),
      deletedAfterRead: note.autoDelete === "onRead",
    };

    note.openCount += 1;
    if (note.autoDelete === "onRead") {
      await deleteNote(env, uuid);
    } else {
      await writeNote(env, note);
    }

    ctx.waitUntil(notifyCreatorAboutOpen(env, note, ip));
    return jsonResponse(responsePayload);
  }

  if (request.method === "PUT") {
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ ok: false, error: "Некорректный JSON тела запроса." }, 400);
    }

    if (!isValidUpdatePayload(payload)) {
      return jsonResponse(
        { ok: false, error: "Ожидаются строковые поля ciphertext и iv." },
        400,
      );
    }

    note.ciphertext = payload.ciphertext;
    note.iv = payload.iv;
    note.updatedAt = new Date().toISOString();
    await writeNote(env, note);

    return jsonResponse({
      ok: true,
      updatedAt: note.updatedAt,
      autoDelete: note.autoDelete,
      expiresAt: note.expiresAt,
    });
  }

  if (request.method === "DELETE") {
    await deleteNote(env, uuid);
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ ok: false, error: "Метод не поддерживается." }, 405);
}

async function createNoteFromApi(request: Request, env: Env, origin: string): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Некорректный JSON тела запроса." }, 400);
  }

  const value = payload as Record<string, unknown>;
  if (
    typeof payload !== "object" ||
    payload === null ||
    typeof value.creatorChatId !== "number" ||
    typeof value.creatorUserId !== "number"
  ) {
    return jsonResponse(
      { ok: false, error: "Ожидаются числовые поля creatorChatId и creatorUserId." },
      400,
    );
  }

  const nowIso = new Date().toISOString();
  const uuid = crypto.randomUUID();
  const hashKey = await generateMd5Key();

  const note: NoteRecord = {
    uuid,
    ciphertext: "",
    iv: "",
    createdAt: nowIso,
    updatedAt: nowIso,
    creatorChatId: value.creatorChatId as number,
    creatorUserId: value.creatorUserId as number,
    autoDelete: "off",
    expiresAt: null,
    openCount: 0,
  };

  await writeNote(env, note);

  return jsonResponse({
    ok: true,
    noteUrl: `${normalizePublicDomain(env.PUBLIC_DOMAIN, origin)}/${uuid}#${hashKey}`,
    note: serializeNoteForClient(note),
  });
}

async function updateAutoDeleteFromApi(
  request: Request,
  env: Env,
  uuid: string,
): Promise<Response> {
  const note = await readNote(env, uuid);
  if (!note) {
    return jsonResponse({ ok: false, error: "Заметка не найдена." }, 404);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Некорректный JSON тела запроса." }, 400);
  }

  const mode = (payload as Record<string, unknown>)?.mode;
  if (!isAutoDeleteMode(mode)) {
    return jsonResponse({ ok: false, error: "Некорректный режим автоудаления." }, 400);
  }

  applyAutoDeleteMode(note, mode, Date.now());
  await writeNote(env, note);

  return jsonResponse({
    ok: true,
    autoDelete: note.autoDelete,
    expiresAt: note.expiresAt,
  });
}

function serializeNoteForClient(note: NoteRecord): Record<string, unknown> {
  return {
    uuid: note.uuid,
    ciphertext: note.ciphertext,
    iv: note.iv,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    autoDelete: note.autoDelete,
    autoDeleteLabel: AUTO_DELETE_LABELS[note.autoDelete],
    expiresAt: note.expiresAt,
    openCount: note.openCount,
  };
}

function isValidUpdatePayload(payload: unknown): payload is { ciphertext: string; iv: string } {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }
  const value = payload as Record<string, unknown>;
  return typeof value.ciphertext === "string" && typeof value.iv === "string";
}

function isAutoDeleteMode(mode: unknown): mode is AutoDeleteMode {
  return (
    mode === "off" ||
    mode === "5m" ||
    mode === "15m" ||
    mode === "30m" ||
    mode === "60m" ||
    mode === "24h" ||
    mode === "onRead"
  );
}

function applyAutoDeleteMode(note: NoteRecord, mode: AutoDeleteMode, nowMs: number): void {
  note.autoDelete = mode;
  const option = AUTO_DELETE_OPTIONS.find((item) => item.mode === mode);
  if (!option || option.ms === null) {
    note.expiresAt = null;
    return;
  }
  note.expiresAt = new Date(nowMs + option.ms).toISOString();
}

function isExpired(note: NoteRecord, nowMs: number): boolean {
  if (!note.expiresAt) {
    return false;
  }
  const expiresAtMs = Date.parse(note.expiresAt);
  if (!Number.isFinite(expiresAtMs)) {
    return true;
  }
  return nowMs >= expiresAtMs;
}

async function notifyCreatorAboutOpen(env: Env, note: NoteRecord, ip: string): Promise<void> {
  const text = `Заметка от ${formatDateRu(note.createdAt)} только что была открыта с IP адреса: ${ip}`;
  await sendTelegramMessage(env, {
    chat_id: note.creatorChatId,
    text,
    disable_web_page_preview: true,
  });
}

async function sendTelegramMessage(
  env: Env,
  payload: Record<string, unknown>,
): Promise<TelegramApiResult> {
  return callTelegramApi(env, "sendMessage", payload);
}

async function answerTelegramCallback(
  env: Env,
  callbackId: string,
  text: string,
): Promise<TelegramApiResult> {
  return callTelegramApi(env, "answerCallbackQuery", {
    callback_query_id: callbackId,
    text,
    show_alert: false,
  });
}

async function callTelegramApi(
  env: Env,
  method: string,
  payload: Record<string, unknown>,
): Promise<TelegramApiResult> {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    console.error("TELEGRAM_BOT_TOKEN is empty.");
    return { ok: false, description: "Missing TELEGRAM_BOT_TOKEN" };
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });

  let result: TelegramApiResult = { ok: false, description: "Telegram API error." };
  try {
    result = (await response.json()) as TelegramApiResult;
  } catch {
    result = { ok: false, description: "Invalid Telegram API response." };
  }

  if (!response.ok || !result.ok) {
    console.error("Telegram API failure:", method, result.description);
  }
  return result;
}

async function readNote(env: Env, uuid: string): Promise<NoteRecord | null> {
  const raw = await env.NOTES_KV.get(noteStorageKey(uuid));
  if (!raw) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }

  if (!isValidStoredNote(parsed, uuid)) {
    return null;
  }
  return parsed;
}

function isValidStoredNote(input: unknown, uuid: string): input is NoteRecord {
  if (typeof input !== "object" || input === null) {
    return false;
  }
  const value = input as Record<string, unknown>;
  if (value.uuid !== uuid) {
    return false;
  }
  return (
    typeof value.ciphertext === "string" &&
    typeof value.iv === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string" &&
    typeof value.creatorChatId === "number" &&
    typeof value.creatorUserId === "number" &&
    isAutoDeleteMode(value.autoDelete) &&
    (value.expiresAt === null || typeof value.expiresAt === "string") &&
    typeof value.openCount === "number"
  );
}

async function writeNote(env: Env, note: NoteRecord): Promise<void> {
  await env.NOTES_KV.put(noteStorageKey(note.uuid), JSON.stringify(note));
}

async function deleteNote(env: Env, uuid: string): Promise<void> {
  await env.NOTES_KV.delete(noteStorageKey(uuid));
}

function noteStorageKey(uuid: string): string {
  return `note:${uuid}`;
}

function extractUuidFromPath(pathname: string): string | null {
  const candidate = pathname.startsWith("/") ? pathname.slice(1) : pathname;
  if (!UUID_PATTERN.test(candidate)) {
    return null;
  }
  return candidate;
}

async function generateMd5Key(): Promise<string> {
  const seed = `${crypto.randomUUID()}|${Date.now()}|${Math.random()}`;
  const bytes = new TextEncoder().encode(seed);

  try {
    const digest = await crypto.subtle.digest("MD5", bytes);
    return toHex(digest);
  } catch {
    const random = crypto.getRandomValues(new Uint8Array(16));
    return toHex(random.buffer);
  }
}

function toHex(buffer: ArrayBufferLike): string {
  return Array.from(new Uint8Array(buffer))
    .map((item) => item.toString(16).padStart(2, "0"))
    .join("");
}

function normalizePublicDomain(publicDomain: string, fallbackOrigin: string): string {
  const value = publicDomain?.trim() || fallbackOrigin;
  return value.replace(/\/+$/, "");
}

function formatDateRu(isoValue: string): string {
  const date = new Date(isoValue);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  });
}

function htmlResponse(html: string): Response {
  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
