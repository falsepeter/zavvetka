import { renderAccessDeniedPage, renderLandingPage, renderNotePage } from "./note-page";
import type { NotePageMode } from "./note-page";

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
  editAccessToken: string;
}

interface NotePageRoute {
  mode: NotePageMode;
  uuid: string;
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
  message?: TelegramMessage;
  data?: string;
}

interface TelegramUpdate {
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

interface TelegramInlineKeyboardButton {
  text: string;
  callback_data?: string;
  web_app?: { url: string };
}

interface TelegramInlineKeyboardMarkup {
  inline_keyboard: TelegramInlineKeyboardButton[][];
}

interface TelegramWebhookInfo {
  url?: string;
  has_custom_certificate?: boolean;
  pending_update_count?: number;
  ip_address?: string;
  last_error_date?: number;
  last_error_message?: string;
  last_synchronization_error_date?: number;
  max_connections?: number;
  allowed_updates?: string[];
  [key: string]: unknown;
}

interface TelegramApiResult<T = unknown> {
  ok: boolean;
  description?: string;
  result?: T;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACCESS_TOKEN_PATTERN = /^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])[A-Za-z0-9]{16,128}$/;
const ACCESS_TOKEN_UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ACCESS_TOKEN_LOWER = "abcdefghijklmnopqrstuvwxyz";
const ACCESS_TOKEN_DIGITS = "0123456789";
const ACCESS_TOKEN_ALPHABET = `${ACCESS_TOKEN_UPPER}${ACCESS_TOKEN_LOWER}${ACCESS_TOKEN_DIGITS}`;
const ACCESS_TOKEN_LENGTH = 24;

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
const AUTO_DELETE_LEGACY_CALLBACK_PREFIX = "auto";
const AUTO_DELETE_MENU_CALLBACK_PREFIX = "auto_menu";
const AUTO_DELETE_SET_CALLBACK_PREFIX = "auto_set";

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
    return handleHealth(env);
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

  const noteRoute = extractNoteRoute(url.pathname);
  if (noteRoute) {
    return handleNotePageRequest(request, env, url, noteRoute);
  }

  return jsonResponse({ ok: false, error: "Маршрут не найден." }, 404);
}

async function handleNotePageRequest(
  request: Request,
  env: Env,
  url: URL,
  route: NotePageRoute,
): Promise<Response> {
  if (request.method !== "GET") {
    return jsonResponse({ ok: false, error: "Метод не поддерживается." }, 405);
  }

  if (route.mode === "edit") {
    const note = await readNote(env, route.uuid);
    if (note) {
      const accessToken = getAccessTokenFromUrl(url);
      if (!hasEditAccess(note, accessToken)) {
        return htmlResponse(renderAccessDeniedPage(route.uuid), 403);
      }
    }
  }

  return htmlResponse(renderNotePage(route.uuid, route.mode));
}

async function handleHealth(env: Env): Promise<Response> {
  const [webhookState, notesKvState] = await Promise.all([
    getTelegramWebhookState(env),
    getNotesKvState(env),
  ]);

  return jsonResponse({
    ok: true,
    now: new Date().toISOString(),
    webhook: webhookState,
    notesKv: notesKvState,
  });
}

async function getTelegramWebhookState(env: Env): Promise<Record<string, unknown>> {
  const webhookInfo = await callTelegramApi<TelegramWebhookInfo>(env, "getWebhookInfo", null);
  const info = webhookInfo.result;

  if (!webhookInfo.ok || !info || typeof info !== "object") {
    return {
      ok: false,
      currentWebhookUrl: null,
      pendingUpdates: null,
      info: null,
      description: webhookInfo.description ?? "Telegram API error.",
    };
  }

  const lastErrorAt =
    typeof info.last_error_date === "number"
      ? new Date(info.last_error_date * 1000).toISOString()
      : undefined;
  const lastSynchronizationErrorAt =
    typeof info.last_synchronization_error_date === "number"
      ? new Date(info.last_synchronization_error_date * 1000).toISOString()
      : undefined;

  return {
    ok: true,
    url: typeof info.url === "string" ? info.url : undefined,
    pendingUpdates: typeof info.pending_update_count === "number" ? info.pending_update_count : undefined,
    hasCustomCertificate: info.has_custom_certificate === true ? true : undefined,
    ipAddress: typeof info.ip_address === "string" ? info.ip_address : undefined,
    maxConnections: typeof info.max_connections === "number" ? info.max_connections : undefined,
    allowedUpdates: Array.isArray(info.allowed_updates) ? info.allowed_updates : undefined,
    lastErrorMessage: typeof info.last_error_message === "string" ? info.last_error_message : undefined,
    lastErrorDate:
      typeof info.last_error_date === "number" ? info.last_error_date : undefined,
    lastErrorAt,
    lastSynchronizationErrorDate:
      typeof info.last_synchronization_error_date === "number"
        ? info.last_synchronization_error_date
        : undefined,
    lastSynchronizationErrorAt,
    info,
  };
}

async function getNotesKvState(env: Env): Promise<Record<string, unknown>> {
  try {
    let count = 0;
    let cursor: string | undefined;
    let pages = 0;

    do {
      const listResult = await env.NOTES_KV.list({
        prefix: noteStorageKey(""),
        cursor,
      });

      count += listResult.keys.length;
      pages += 1;
      cursor = listResult.list_complete ? undefined : listResult.cursor;
    } while (cursor);

    return {
      ok: true,
      count,
      pagesScanned: pages,
    };
  } catch (error) {
    console.error("NOTES_KV list failure:", error);
    return {
      ok: false,
      count: null,
      pagesScanned: null,
      description: "Не удалось получить количество заметок в KV.",
    };
  }
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
  if (parts.length === 3 && parts[0] === AUTO_DELETE_LEGACY_CALLBACK_PREFIX) {
    const uuid = parts[1];
    const mode = parts[2] as AutoDeleteMode;
    await applyAutoDeleteFromCallback(env, query, uuid, mode);
    return;
  }

  if (parts.length === 2 && parts[0] === AUTO_DELETE_MENU_CALLBACK_PREFIX) {
    const uuid = parts[1];
    await openAutoDeleteMenuFromCallback(env, query, uuid);
    return;
  }

  if (parts.length === 4 && parts[0] === AUTO_DELETE_SET_CALLBACK_PREFIX) {
    const uuid = parts[1];
    const mode = parts[2] as AutoDeleteMode;
    const targetMessageId = Number.parseInt(parts[3], 10);
    await setAutoDeleteFromMenuCallback(env, query, uuid, mode, targetMessageId);
    return;
  }

  await answerTelegramCallback(env, query.id, "Неизвестная команда.");
}

async function applyAutoDeleteFromCallback(
  env: Env,
  query: TelegramCallbackQuery,
  uuid: string,
  mode: AutoDeleteMode,
): Promise<void> {
  if (!UUID_PATTERN.test(uuid) || !isAutoDeleteMode(mode)) {
    await answerTelegramCallback(env, query.id, "Некорректные параметры.");
    return;
  }

  const note = await readOwnedNoteForAutoDeleteCallback(env, query, uuid);
  if (!note) {
    return;
  }

  applyAutoDeleteMode(note, mode, Date.now());
  await writeNote(env, note);
  await answerTelegramCallback(env, query.id, `Автоудаление: ${AUTO_DELETE_LABELS[mode]}`);
}

async function openAutoDeleteMenuFromCallback(
  env: Env,
  query: TelegramCallbackQuery,
  uuid: string,
): Promise<void> {
  if (!UUID_PATTERN.test(uuid)) {
    await answerTelegramCallback(env, query.id, "Некорректные параметры.");
    return;
  }

  const callbackMessage = query.message;
  if (!callbackMessage) {
    await answerTelegramCallback(env, query.id, "Сообщение для выбора не найдено.");
    return;
  }

  const note = await readOwnedNoteForAutoDeleteCallback(env, query, uuid);
  if (!note) {
    return;
  }

  const sendResult = await sendTelegramMessage(env, {
    chat_id: callbackMessage.chat.id,
    text: `Текущий режим: ${AUTO_DELETE_LABELS[note.autoDelete]}. Выберите новый режим автоудаления:`,
    reply_markup: buildAutoDeleteSelectionReplyMarkup(uuid, callbackMessage.message_id),
  });

  if (!sendResult.ok) {
    await answerTelegramCallback(env, query.id, "Не удалось открыть список режимов.");
    return;
  }

  await answerTelegramCallback(env, query.id, "Выберите режим автоудаления.");
}

async function setAutoDeleteFromMenuCallback(
  env: Env,
  query: TelegramCallbackQuery,
  uuid: string,
  mode: AutoDeleteMode,
  targetMessageId: number,
): Promise<void> {
  if (!UUID_PATTERN.test(uuid) || !isAutoDeleteMode(mode)) {
    await answerTelegramCallback(env, query.id, "Некорректные параметры.");
    return;
  }

  if (!Number.isInteger(targetMessageId) || targetMessageId <= 0) {
    await answerTelegramCallback(env, query.id, "Некорректные параметры.");
    return;
  }

  const menuMessage = query.message;
  if (!menuMessage) {
    await answerTelegramCallback(env, query.id, "Сообщение с выбором не найдено.");
    return;
  }

  const note = await readOwnedNoteForAutoDeleteCallback(env, query, uuid);
  if (!note) {
    return;
  }

  applyAutoDeleteMode(note, mode, Date.now());
  await writeNote(env, note);

  const chatId = menuMessage.chat.id;
  const menuMessageId = menuMessage.message_id;
  const deleteMenuResult = await deleteTelegramMessage(env, chatId, menuMessageId);

  if (!deleteMenuResult.ok) {
    console.error("Failed to delete auto-delete selection message.");
  }

  const updateControlButtonResult = await editTelegramMessageReplyMarkup(
    env,
    chatId,
    targetMessageId,
    buildAutoDeleteControlReplyMarkup(uuid, mode),
  );

  if (!updateControlButtonResult.ok) {
    await answerTelegramCallback(env, query.id, "Режим сохранен, но кнопку обновить не удалось.");
    return;
  }

  await answerTelegramCallback(env, query.id, `Автоудаление: ${AUTO_DELETE_LABELS[mode]}`);
}

async function readOwnedNoteForAutoDeleteCallback(
  env: Env,
  query: TelegramCallbackQuery,
  uuid: string,
): Promise<NoteRecord | null> {
  const note = await readNote(env, uuid);
  if (!note) {
    await answerTelegramCallback(env, query.id, "Заметка не найдена.");
    return null;
  }

  if (note.creatorUserId !== query.from.id) {
    await answerTelegramCallback(env, query.id, "Только создатель может менять автоудаление.");
    return null;
  }

  return note;
}

function buildAutoDeleteControlReplyMarkup(
  uuid: string,
  mode: AutoDeleteMode,
): TelegramInlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        {
          text: `Автоудаление: ${AUTO_DELETE_LABELS[mode]}`,
          callback_data: `${AUTO_DELETE_MENU_CALLBACK_PREFIX}:${uuid}`,
        },
      ],
    ],
  };
}

function buildAutoDeleteSelectionReplyMarkup(
  uuid: string,
  targetMessageId: number,
): TelegramInlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        {
          text: AUTO_DELETE_LABELS["5m"],
          callback_data: buildAutoDeleteSetCallbackData(uuid, "5m", targetMessageId),
        },
        {
          text: AUTO_DELETE_LABELS["15m"],
          callback_data: buildAutoDeleteSetCallbackData(uuid, "15m", targetMessageId),
        },
      ],
      [
        {
          text: AUTO_DELETE_LABELS["30m"],
          callback_data: buildAutoDeleteSetCallbackData(uuid, "30m", targetMessageId),
        },
        {
          text: AUTO_DELETE_LABELS["60m"],
          callback_data: buildAutoDeleteSetCallbackData(uuid, "60m", targetMessageId),
        },
      ],
      [
        {
          text: AUTO_DELETE_LABELS["24h"],
          callback_data: buildAutoDeleteSetCallbackData(uuid, "24h", targetMessageId),
        },
        {
          text: AUTO_DELETE_LABELS.onRead,
          callback_data: buildAutoDeleteSetCallbackData(uuid, "onRead", targetMessageId),
        },
      ],
      [
        {
          text: AUTO_DELETE_LABELS.off,
          callback_data: buildAutoDeleteSetCallbackData(uuid, "off", targetMessageId),
        },
      ],
    ],
  };
}

function buildAutoDeleteSetCallbackData(
  uuid: string,
  mode: AutoDeleteMode,
  targetMessageId: number,
): string {
  return `${AUTO_DELETE_SET_CALLBACK_PREFIX}:${uuid}:${mode}:${targetMessageId}`;
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
    editAccessToken: generateAccessToken(),
  };

  await writeNote(env, note);

  const baseUrl = normalizePublicDomain(env.PUBLIC_DOMAIN, origin);
  const viewUrl = buildViewNoteUrl(baseUrl, uuid, hashKey);
  const editUrl = buildEditNoteUrl(baseUrl, uuid, hashKey, note.editAccessToken);
  const message = [
    `Заметка от ${formatDateRu(note.createdAt)} создана.`,
    "",
    `Ссылка для просмотра: ${viewUrl}`,
    "",
    "Кнопка ниже открывает webview-редактор.",
  ].join("\n");

  await sendTelegramMessage(env, {
    chat_id: creatorChatId,
    text: message,
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [[{ text: "Редактировать", web_app: { url: editUrl } }]],
    },
  });

  await sendTelegramMessage(env, {
    chat_id: creatorChatId,
    text: "Настройка автоудаления заметки:",
    reply_markup: buildAutoDeleteControlReplyMarkup(uuid, note.autoDelete),
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
    return updateAutoDeleteFromApi(request, env, uuid, url);
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

  const accessToken = getAccessTokenFromUrl(url);
  if ((request.method === "PUT" || request.method === "DELETE") && !hasEditAccess(note, accessToken)) {
    return jsonResponse({ ok: false, error: "Доступ к редактированию запрещен." }, 403);
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
    editAccessToken: generateAccessToken(),
  };

  await writeNote(env, note);
  const baseUrl = normalizePublicDomain(env.PUBLIC_DOMAIN, origin);
  const viewUrl = buildViewNoteUrl(baseUrl, uuid, hashKey);
  const editUrl = buildEditNoteUrl(baseUrl, uuid, hashKey, note.editAccessToken);

  return jsonResponse({
    ok: true,
    viewUrl,
    editUrl,
    noteUrl: viewUrl,
    note: serializeNoteForClient(note),
  });
}

async function updateAutoDeleteFromApi(
  request: Request,
  env: Env,
  uuid: string,
  url: URL,
): Promise<Response> {
  const note = await readNote(env, uuid);
  if (!note) {
    return jsonResponse({ ok: false, error: "Заметка не найдена." }, 404);
  }

  const accessToken = getAccessTokenFromUrl(url);
  if (!hasEditAccess(note, accessToken)) {
    return jsonResponse({ ok: false, error: "Доступ к редактированию запрещен." }, 403);
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

async function editTelegramMessageReplyMarkup(
  env: Env,
  chatId: number,
  messageId: number,
  replyMarkup: TelegramInlineKeyboardMarkup,
): Promise<TelegramApiResult> {
  return callTelegramApi(env, "editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: replyMarkup,
  });
}

async function deleteTelegramMessage(
  env: Env,
  chatId: number,
  messageId: number,
): Promise<TelegramApiResult> {
  return callTelegramApi(env, "deleteMessage", {
    chat_id: chatId,
    message_id: messageId,
  });
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

async function callTelegramApi<T = unknown>(
  env: Env,
  method: string,
  payload: Record<string, unknown> | null = null,
): Promise<TelegramApiResult<T>> {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    console.error("TELEGRAM_BOT_TOKEN is empty.");
    return { ok: false, description: "Missing TELEGRAM_BOT_TOKEN" };
  }

  const requestInit: RequestInit = {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
  };
  if (payload !== null) {
    requestInit.body = JSON.stringify(payload);
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, requestInit);

  let result: TelegramApiResult<T> = { ok: false, description: "Telegram API error." };
  try {
    result = (await response.json()) as TelegramApiResult<T>;
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

  const value = parsed as Record<string, unknown>;
  const storedAccessToken =
    typeof value.editAccessToken === "string" ? value.editAccessToken : null;
  const editAccessToken = isValidAccessToken(storedAccessToken)
    ? storedAccessToken
    : generateAccessToken();

  const note: NoteRecord = {
    uuid: value.uuid as string,
    ciphertext: value.ciphertext as string,
    iv: value.iv as string,
    createdAt: value.createdAt as string,
    updatedAt: value.updatedAt as string,
    creatorChatId: value.creatorChatId as number,
    creatorUserId: value.creatorUserId as number,
    autoDelete: value.autoDelete as AutoDeleteMode,
    expiresAt: value.expiresAt as string | null,
    openCount: value.openCount as number,
    editAccessToken,
  };

  if (storedAccessToken !== editAccessToken) {
    await writeNote(env, note);
  }

  return note;
}

function isValidStoredNote(input: unknown, uuid: string): boolean {
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
    typeof value.openCount === "number" &&
    (value.editAccessToken === undefined || typeof value.editAccessToken === "string")
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

function extractNoteRoute(pathname: string): NotePageRoute | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 2 && (parts[0] === "view" || parts[0] === "edit")) {
    if (!UUID_PATTERN.test(parts[1])) {
      return null;
    }
    return {
      mode: parts[0],
      uuid: parts[1],
    };
  }

  if (parts.length === 1 && UUID_PATTERN.test(parts[0])) {
    // Backward compatibility for old links: /<uuid>#<md5>
    return {
      mode: "view",
      uuid: parts[0],
    };
  }

  return null;
}

function getAccessTokenFromUrl(url: URL): string | null {
  const candidate = url.searchParams.get("access")?.trim();
  if (!candidate || !isValidAccessToken(candidate)) {
    return null;
  }
  return candidate;
}

function hasEditAccess(note: NoteRecord, accessToken: string | null): boolean {
  return typeof accessToken === "string" && note.editAccessToken === accessToken;
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

function generateAccessToken(length = ACCESS_TOKEN_LENGTH): string {
  if (length < 3) {
    throw new Error("Access token length must be at least 3.");
  }

  const bytes = crypto.getRandomValues(new Uint8Array(length));
  const chars: string[] = [];
  for (let i = 0; i < bytes.length; i += 1) {
    chars.push(ACCESS_TOKEN_ALPHABET[bytes[i] % ACCESS_TOKEN_ALPHABET.length]);
  }

  const requiredAlphabets = [ACCESS_TOKEN_UPPER, ACCESS_TOKEN_LOWER, ACCESS_TOKEN_DIGITS];
  const usedIndices = new Set<number>();
  for (const alphabet of requiredAlphabets) {
    let index = randomIndex(length);
    while (usedIndices.has(index)) {
      index = randomIndex(length);
    }
    usedIndices.add(index);
    chars[index] = randomCharFromAlphabet(alphabet);
  }

  return chars.join("");
}

function isValidAccessToken(token: string | null): token is string {
  return typeof token === "string" && ACCESS_TOKEN_PATTERN.test(token);
}

function randomIndex(maxExclusive: number): number {
  if (maxExclusive <= 0) {
    return 0;
  }
  const value = crypto.getRandomValues(new Uint32Array(1))[0];
  return value % maxExclusive;
}

function randomCharFromAlphabet(alphabet: string): string {
  const index = randomIndex(alphabet.length);
  return alphabet[index];
}

function buildViewNoteUrl(baseUrl: string, uuid: string, hashKey: string): string {
  return `${baseUrl}/view/${uuid}#${hashKey}`;
}

function buildEditNoteUrl(
  baseUrl: string,
  uuid: string,
  hashKey: string,
  accessToken: string,
): string {
  const params = new URLSearchParams({ access: accessToken });
  return `${baseUrl}/edit/${uuid}?${params.toString()}#${hashKey}`;
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

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
