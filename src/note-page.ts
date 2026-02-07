export function renderLandingPage(): string {
  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ZaVVetka</title>
    <style>
      :root { color-scheme: light; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background:
          radial-gradient(circle at 10% 5%, #fef3c7, transparent 35%),
          radial-gradient(circle at 100% 10%, #bfdbfe, transparent 30%),
          linear-gradient(130deg, #fffbeb, #ecfeff);
        color: #0f172a;
        font-family: "Trebuchet MS", "Segoe UI", sans-serif;
      }
      main {
        width: min(760px, calc(100vw - 24px));
        background: #ffffffd6;
        border: 1px solid #bfdbfe;
        border-radius: 18px;
        padding: 24px;
        box-shadow: 0 14px 32px rgba(15, 23, 42, 0.12);
      }
      h1 { margin: 0 0 10px; font-size: 1.7rem; }
      p { margin: 0; line-height: 1.5; color: #334155; }
      code { background: #e0f2fe; border-radius: 6px; padding: 2px 6px; }
    </style>
  </head>
  <body>
    <main>
      <h1>ZaVVetka</h1>
      <p>Откройте ссылку из Telegram в формате <code>/UUID#md5</code>, чтобы расшифровать и редактировать заметку.</p>
    </main>
  </body>
</html>`;
}

export function renderNotePage(uuid: string): string {
  const safeUuid = escapeHtml(uuid);
  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Редактор заметки</title>
    <style>
      :root {
        color-scheme: light;
        --bg-a: #fefce8;
        --bg-b: #e0f2fe;
        --ink: #0f172a;
        --muted: #475569;
        --card: #ffffffdb;
        --accent: #0f766e;
        --danger: #b91c1c;
        --border: #cbd5e1;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        color: var(--ink);
        background:
          radial-gradient(circle at 15% 0%, #fde68a7a, transparent 30%),
          radial-gradient(circle at 100% 5%, #93c5fd7a, transparent 30%),
          linear-gradient(140deg, var(--bg-a), var(--bg-b));
        font-family: "Trebuchet MS", "Segoe UI", sans-serif;
      }
      main {
        width: min(920px, calc(100vw - 24px));
        margin: 18px auto;
        padding: 14px;
      }
      .panel {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 16px;
        box-shadow: 0 16px 34px rgba(15, 23, 42, 0.1);
        backdrop-filter: blur(4px);
      }
      h1 { margin: 0 0 8px; font-size: clamp(1.2rem, 2vw, 1.7rem); letter-spacing: .3px; }
      .meta { margin: 0 0 12px; color: var(--muted); font-size: .95rem; word-break: break-all; }
      .chips { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
      .chip {
        border: 1px solid #bae6fd;
        background: #f0f9ff;
        color: #075985;
        border-radius: 999px;
        padding: 6px 12px;
        font-size: .86rem;
      }
      label { display: block; margin-bottom: 6px; color: #334155; font-size: .95rem; }
      textarea {
        width: 100%;
        min-height: 50vh;
        resize: vertical;
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 12px;
        font-size: 1rem;
        line-height: 1.5;
        color: #0b1120;
        background: #fffffff2;
        font-family: "Consolas", "Courier New", monospace;
      }
      textarea:focus { outline: 2px solid #67e8f9; border-color: #22d3ee; }
      .line {
        margin-top: 9px;
        display: flex;
        gap: 12px;
        justify-content: space-between;
        flex-wrap: wrap;
        color: var(--muted);
        font-size: .9rem;
      }
      .ok { color: #166534; }
      .warn { color: #9a3412; }
      .err { color: #991b1b; }
      .error {
        margin-top: 10px;
        border: 1px solid #fecaca;
        border-radius: 10px;
        padding: 10px;
        background: #fef2f2;
        color: #991b1b;
        font-size: .9rem;
      }
      .actions { margin-top: 14px; display: flex; justify-content: flex-end; }
      .danger {
        border: 0;
        border-radius: 10px;
        padding: 10px 14px;
        background: var(--danger);
        color: #fff;
        cursor: pointer;
        font-size: .95rem;
      }
      .danger:disabled { opacity: .58; cursor: default; }
      @media (max-width: 720px) {
        main { margin: 10px auto; padding: 10px; }
        .panel { padding: 12px; border-radius: 12px; }
        textarea { min-height: 58vh; }
        .actions { justify-content: stretch; }
        .danger { width: 100%; }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="panel">
        <h1>Редактор заметки</h1>
        <p id="meta" class="meta">UUID: ${safeUuid}</p>

        <div class="chips">
          <span id="autoDelete" class="chip">Автоудаление: загрузка...</span>
          <span id="timer" class="chip">Таймер: загрузка...</span>
        </div>

        <label for="editor">Текст заметки</label>
        <textarea id="editor" placeholder="Введите текст заметки..."></textarea>

        <div class="line">
          <span id="saveState" class="warn">Ожидание загрузки...</span>
          <span id="savedAt">Последнее сохранение: —</span>
        </div>

        <div id="error" class="error" hidden></div>

        <div class="actions">
          <button id="deleteBtn" class="danger">Удалить заметку</button>
        </div>
      </section>
    </main>

    <script>
      const NOTE_UUID = ${JSON.stringify(uuid)};
      const API_URL = "/api/notes/" + NOTE_UUID;
      const SAVE_DELAY_MS = 30000;
      const LABELS = {
        off: "Без автоудаления",
        "5m": "5 мин",
        "15m": "15 мин",
        "30m": "30 мин",
        "60m": "60 мин",
        "24h": "24 часа",
        onRead: "Удалить при первом прочтении"
      };

      const ui = {
        editor: document.getElementById("editor"),
        autoDelete: document.getElementById("autoDelete"),
        timer: document.getElementById("timer"),
        saveState: document.getElementById("saveState"),
        savedAt: document.getElementById("savedAt"),
        error: document.getElementById("error"),
        deleteBtn: document.getElementById("deleteBtn")
      };

      let keyHash = "";
      let aesKey = null;
      let dirty = false;
      let saveTimer = null;
      let saveInFlight = false;
      let saveQueued = false;
      let ttlInterval = null;

      void init();

      async function init() {
        try {
          keyHash = decodeURIComponent((window.location.hash || "").replace(/^#/, "").trim()).toLowerCase();
          if (!/^[a-f0-9]{32}$/.test(keyHash)) {
            setReadonly("Ключ шифрования в hash-части ссылки отсутствует или некорректен.");
            setStatus("Нет ключа.", "err");
            showError("Ожидается hash формата md5 (32 hex символа).");
            return;
          }

          aesKey = await deriveKey(keyHash);
          bindEvents();
          await loadNote();
        } catch (error) {
          const message = error instanceof Error ? error.message : "Неизвестная ошибка.";
          setStatus("Ошибка загрузки.", "err");
          showError(message);
          setReadonly("Заметка недоступна.");
        }
      }

      function bindEvents() {
        ui.editor.addEventListener("input", () => {
          dirty = true;
          setStatus("Изменения не сохранены.", "warn");
          scheduleSave();
        });

        ui.deleteBtn.addEventListener("click", async () => {
          if (!confirm("Удалить заметку без возможности восстановления?")) {
            return;
          }
          await removeNote();
        });

        window.addEventListener("beforeunload", (event) => {
          if (!dirty && !saveInFlight) {
            return;
          }
          event.preventDefault();
          event.returnValue = "";
        });
      }

      async function loadNote() {
        setStatus("Загрузка заметки...", "warn");
        const response = await fetch(API_URL, { cache: "no-store" });
        if (response.status === 404) {
          setReadonly("Заметка не найдена или уже удалена.");
          setStatus("Заметка удалена.", "err");
          return;
        }
        if (!response.ok) {
          throw new Error("Не удалось загрузить данные заметки.");
        }

        const payload = await response.json();
        const note = payload.note;
        ui.autoDelete.textContent = "Автоудаление: " + (LABELS[note.autoDelete] || note.autoDelete);
        ui.savedAt.textContent = "Последнее сохранение: " + formatDateTime(note.updatedAt);
        applyTimer(note.expiresAt);

        if (note.ciphertext && note.iv) {
          try {
            ui.editor.value = await decrypt(note.ciphertext, note.iv);
          } catch {
            setReadonly("Ошибка расшифровки.");
            setStatus("Ключ не подходит.", "err");
            showError("Не удалось расшифровать заметку текущим hash-ключом.");
            return;
          }
        } else {
          ui.editor.value = "";
        }

        if (payload.deletedAfterRead) {
          setReadonly("Режим \"Удалить при первом прочтении\": заметка уже удалена.");
          setStatus("Открытие только для чтения.", "warn");
          return;
        }

        dirty = false;
        setStatus("Готово к редактированию.", "ok");
      }

      function scheduleSave() {
        if (saveTimer !== null) {
          clearTimeout(saveTimer);
        }
        saveTimer = setTimeout(() => {
          void save();
        }, SAVE_DELAY_MS);
      }

      async function save() {
        if (!dirty) {
          return;
        }
        if (saveInFlight) {
          saveQueued = true;
          return;
        }
        if (!aesKey) {
          setStatus("Нет ключа шифрования.", "err");
          return;
        }

        saveInFlight = true;
        setStatus("Сохранение...", "warn");
        try {
          const encrypted = await encrypt(ui.editor.value);
          const response = await fetch(API_URL, {
            method: "PUT",
            headers: { "content-type": "application/json; charset=utf-8" },
            body: JSON.stringify(encrypted)
          });
          if (response.status === 404) {
            setReadonly("Заметка удалена и больше не редактируется.");
            setStatus("Сохранение невозможно.", "err");
            return;
          }
          if (!response.ok) {
            throw new Error("Сервер отклонил сохранение.");
          }

          const payload = await response.json();
          dirty = false;
          ui.savedAt.textContent = "Последнее сохранение: " + formatDateTime(payload.updatedAt);
          ui.autoDelete.textContent = "Автоудаление: " + (LABELS[payload.autoDelete] || payload.autoDelete);
          applyTimer(payload.expiresAt);
          setStatus("Сохранено.", "ok");
        } catch (error) {
          setStatus("Ошибка сохранения.", "err");
          showError(error instanceof Error ? error.message : "Не удалось сохранить заметку.");
        } finally {
          saveInFlight = false;
          if (saveQueued) {
            saveQueued = false;
            if (dirty) {
              void save();
            }
          }
        }
      }

      async function removeNote() {
        const response = await fetch(API_URL, { method: "DELETE" });
        if (!response.ok && response.status !== 404) {
          throw new Error("Не удалось удалить заметку.");
        }
        setReadonly("Заметка удалена.");
        setStatus("Заметка удалена.", "err");
      }

      function setReadonly(message) {
        ui.editor.disabled = true;
        ui.editor.placeholder = message;
        ui.deleteBtn.disabled = true;
      }

      function setStatus(text, level) {
        ui.saveState.textContent = text;
        ui.saveState.className = level;
      }

      function showError(text) {
        ui.error.hidden = false;
        ui.error.textContent = text;
      }

      function applyTimer(expiresAt) {
        if (ttlInterval !== null) {
          clearInterval(ttlInterval);
          ttlInterval = null;
        }
        if (!expiresAt) {
          ui.timer.textContent = "Таймер: выключен";
          return;
        }

        const expiresAtMs = Date.parse(expiresAt);
        if (!Number.isFinite(expiresAtMs)) {
          ui.timer.textContent = "Таймер: некорректный";
          return;
        }

        const update = () => {
          const diff = expiresAtMs - Date.now();
          if (diff <= 0) {
            ui.timer.textContent = "Таймер: время истекло";
            setReadonly("Срок жизни заметки истек.");
            setStatus("Заметка удалена по таймеру.", "err");
            clearInterval(ttlInterval);
            ttlInterval = null;
            return;
          }
          ui.timer.textContent = "Таймер: " + formatDuration(diff);
        };
        update();
        ttlInterval = setInterval(update, 1000);
      }

      async function deriveKey(token) {
        const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
        return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
      }

      async function encrypt(text) {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encoded = new TextEncoder().encode(text);
        const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, encoded);
        return {
          ciphertext: bytesToBase64(new Uint8Array(encrypted)),
          iv: bytesToBase64(iv)
        };
      }

      async function decrypt(ciphertext, iv) {
        const encrypted = base64ToBytes(ciphertext);
        const ivBytes = base64ToBytes(iv);
        const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: ivBytes }, aesKey, encrypted);
        return new TextDecoder().decode(decrypted);
      }

      function bytesToBase64(bytes) {
        let binary = "";
        for (let i = 0; i < bytes.length; i += 1) {
          binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
      }

      function base64ToBytes(value) {
        const binary = atob(value);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
      }

      function formatDateTime(value) {
        const date = new Date(value);
        return new Intl.DateTimeFormat("ru-RU", {
          day: "2-digit",
          month: "2-digit",
          year: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        }).format(date);
      }

      function formatDuration(ms) {
        const total = Math.floor(ms / 1000);
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const s = total % 60;
        if (h > 0) {
          return h + "ч " + String(m).padStart(2, "0") + "м " + String(s).padStart(2, "0") + "с";
        }
        return m + "м " + String(s).padStart(2, "0") + "с";
      }
    </script>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
