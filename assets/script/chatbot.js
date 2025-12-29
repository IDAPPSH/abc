// FILE: assets/script/chatbot.js
// Rol: lógica del chatbot (abrir/cerrar, enviar mensajes, quick actions, persistencia local si aplica).
// Regla: no tocar navegación global aquí.
// Actualizado: 2025-12-23

(() => {
  if (window.__IDAPPSH_CHATBOT_INIT__) return;
  window.__IDAPPSH_CHATBOT_INIT__ = true;

  const WORKER_URL = "https://idappsh-ia.idappsh.workers.dev/chat";

  const GREETINGS = [
    "Hola 👋 ¿En qué te puedo apoyar hoy?",
    "¡Buenas! 🙌 ¿En qué te puedo servir?",
    "Hola 😊 ¿En qué te apoyo hoy?",
    "¡Hey! ⚡ ¿Qué necesitas?"
  ];
  const randomGreeting = () => GREETINGS[Math.floor(Math.random() * GREETINGS.length)];

  const SESSION_KEY = "IDAPPSH_CHAT_SESSION_ID";
  const CONTEXT_KEY = "IDAPPSH_CHAT_CONTEXT";

  const makeId = () => (
    (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function")
      ? globalThis.crypto.randomUUID()
      : (Date.now() + "-" + Math.random().toString(16).slice(2))
  );

  document.addEventListener("DOMContentLoaded", () => {
    const launcher = document.getElementById("idappsh-chat-launcher");
    const panel = document.getElementById("idappsh-chat-panel");
    const closeBtn = document.getElementById("idappsh-chat-close");
    const msgList = document.getElementById("idappsh-chat-messages");
    const input = document.getElementById("idappsh-chat-input");
    const sendBtn = document.getElementById("idappsh-chat-send");
    const form = document.getElementById("idappsh-chat-form");

    const missing = [];
    if (!launcher) missing.push("idappsh-chat-launcher");
    if (!panel) missing.push("idappsh-chat-panel");
    if (!closeBtn) missing.push("idappsh-chat-close");
    if (!msgList) missing.push("idappsh-chat-messages");
    if (!input) missing.push("idappsh-chat-input");
    if (!sendBtn) missing.push("idappsh-chat-send");
    if (!form) missing.push("idappsh-chat-form");
    if (missing.length) {
      console.warn("Faltan elementos del chatbot:", missing.join(", "));
      return;
    }

    let booted = false;
    let history = [];
    let currentContext = localStorage.getItem(CONTEXT_KEY) || "inicio";
    let session_id = localStorage.getItem(SESSION_KEY) || makeId();
    localStorage.setItem(SESSION_KEY, session_id);

    const navStack = [];

    function resetChat() {
      msgList.innerHTML = "";
      history = [];
      navStack.length = 0;
      currentContext = localStorage.getItem(CONTEXT_KEY) || "inicio";
    }

    function appendBubble(role, text) {
      const div = document.createElement("div");
      div.className = "msg " + role;
      div.textContent = String(text ?? "");
      msgList.appendChild(div);
      msgList.scrollTop = msgList.scrollHeight;
      return div;
    }

    function appendButtonsRow(buttons, { pushMenu = false } = {}) {
      if (!Array.isArray(buttons) || !buttons.length) return null;

      const wrap = document.createElement("div");
      wrap.className = "action-row";

      buttons.forEach((b) => {
        if (!b || typeof b !== "object") return;

        if (b.url) {
          const href = String(b.url || "").trim();
          if (!href) return;
          const a = document.createElement("a");
          a.className = "action-btn";
          a.href = href;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.textContent = String(b.label || "Abrir");
          wrap.appendChild(a);
          return;
        }

        const label = String(b.label ?? "Opción").trim();
        const send = String(b.send ?? "").trim();
        if (!send) return;

        const btn = document.createElement("button");
        btn.className = "action-btn";
        btn.type = "button";
        btn.textContent = label;
        btn.onclick = () => {
          wrap.remove();
          handleAction(send);
        };
        wrap.appendChild(btn);
      });

      if (!wrap.childNodes.length) return null;

      msgList.appendChild(wrap);
      msgList.scrollTop = msgList.scrollHeight;

      if (pushMenu) {
        const onlySend = buttons.filter(x => x && typeof x === "object" && x.send);
        if (onlySend.length) {
          navStack.push({ context: currentContext, options: onlySend });
          if (navStack.length > 40) navStack.shift();
        }
      }

      return wrap;
    }

    function showStart() {
      appendBubble("assistant", randomGreeting());
      appendButtonsRow([
        { label: "Ver temas", send: "__topics__" },
        { label: "Pregunta directa", send: "__direct__" }
      ], { pushMenu: true });
    }

    function goBackMenu() {
      if (navStack.length < 2) {
        resetChat();
        showStart();
        return;
      }
      navStack.pop();
      const prev = navStack[navStack.length - 1];
      if (prev?.context) {
        currentContext = prev.context;
        localStorage.setItem(CONTEXT_KEY, currentContext);
      }
      appendButtonsRow(prev.options, { pushMenu: false });
    }

    // =========================
    // POSICIONAR PANEL SEGÚN EL LAUNCHER (INLINE STYLE, GANA AL CSS)
    // =========================
    function clamp(n, min, max) {
      return Math.max(min, Math.min(max, n));
    }

    function syncPanelToLauncher() {
      // Si el panel está display:none, offsetHeight será 0; usamos fallback.
      const panelH = panel.offsetHeight || 540;

      const l = launcher.getBoundingClientRect();

      // Queremos el panel "arriba" del launcher (con separación)
      const gap = 14;
      const desiredTop = l.top - panelH - gap;

      const minTop = 12;
      const maxTop = window.innerHeight - panelH - 12;
      const top = clamp(desiredTop, minTop, maxTop);

      // Clave: anulamos bottom del CSS y fijamos top
      panel.style.bottom = "auto";
      panel.style.top = `${top}px`;
    }

    // =========================
    // OPEN/CLOSE
    // =========================
    function openPanel() {
      // Ojo: primero mostramos para poder medir height real
      panel.classList.add("open");
      panel.setAttribute("aria-hidden", "false");

      if (!booted) {
        booted = true;
        resetChat();
        showStart();
      }

      // Espera 1 frame para que el display:flex ya aplique y el height sea real
      requestAnimationFrame(() => {
        syncPanelToLauncher();
        input.focus();
      });
    }

    function closePanel() {
      panel.classList.remove("open");
      panel.setAttribute("aria-hidden", "true");
    }

    launcher.addEventListener("click", (e) => {
      e.stopPropagation();
      if (panel.classList.contains("open")) closePanel();
      else openPanel();
    });

    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closePanel();
    });

    panel.addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("click", (e) => {
      if (!panel.classList.contains("open")) return;
      const clickedInside = panel.contains(e.target) || launcher.contains(e.target);
      if (!clickedInside) closePanel();
    });

    // =========================
    // PRESENCIA: mover launcher por scroll + nudge + (si panel abierto) mover panel
    // =========================
    (function setupPresence() {
      let raf = null;

      const minTop = 140;
      const maxTop = () => Math.max(180, window.innerHeight - 170);

      function setTop(px) {
        document.documentElement.style.setProperty("--cb-launcher-top", px + "px");
      }

      function syncTop() {
        const doc = document.documentElement;
        const maxScroll = Math.max(1, doc.scrollHeight - window.innerHeight);
        const p = Math.min(1, Math.max(0, window.scrollY / maxScroll));
        const top = minTop + (maxTop() - minTop) * p;

        setTop(top);

        // Si está abierto, el panel sigue al launcher en scroll/resize
        if (panel.classList.contains("open")) syncPanelToLauncher();
      }

      function onScroll() {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = null;
          syncTop();
        });
      }

      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll, { passive: true });

      syncTop();

      let lock = false;
      function nudge() {
        if (lock) return;
        if (panel.classList.contains("open")) return;

        lock = true;
        launcher.classList.remove("is-nudging");
        launcher.offsetHeight; // reflow
        launcher.classList.add("is-nudging");

        setTimeout(() => launcher.classList.remove("is-nudging"), 560);
        setTimeout(() => (lock = false), 900);
      }

      document.addEventListener("click", nudge, true);
      document.addEventListener("keydown", nudge, true);

      setInterval(() => {
        if (document.visibilityState !== "visible") return;
        nudge();
      }, 3000);
    })();

    // =========================
    // ENVIAR MENSAJES
    // =========================
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      sendMessage();
    });

    sendBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      sendMessage();
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    async function parseResponse(r) {
      const raw = await r.text();
      let data = {};
      try { data = JSON.parse(raw); }
      catch { data = { reply: raw }; }
      return { raw, data };
    }

    function pickQuickActions(data) {
      const qa = data?.quick_actions;
      if (!Array.isArray(qa)) return [];
      return qa
        .filter(x => x && typeof x === "object" && x.url)
        .map(x => ({
          label: String(x.label || "Abrir"),
          url: String(x.url || "").trim()
        }))
        .filter(x => x.url);
    }

    function pickOptions(data) {
      const opts = data?.options;
      if (!Array.isArray(opts)) return [];
      return opts
        .filter(x => x && typeof x === "object" && x.send)
        .map(x => ({
          label: String(x.label ?? "Opción").trim().slice(0, 60),
          send: String(x.send ?? "").trim().slice(0, 250)
        }))
        .filter(x => x.send);
    }

    function handleAction(send) {
      const s = String(send || "").trim();
      if (!s) return;

      if (s === "__direct__") {
        appendBubble("assistant", "Va. Escribe tu pregunta 🙂");
        input.focus();
        return;
      }

      if (s === "__back__") {
        goBackMenu();
        return;
      }

      if (s === "__topics__") {
        internalSend("__topics__", { showUser: false });
        return;
      }

      internalSend(s, { showUser: true });
    }

    async function internalSend(text, { showUser = true } = {}) {
      const msg = String(text || "").trim();
      if (!msg) return;

      if (showUser) appendBubble("user", msg);
      history.push({ role: "user", content: msg });

      const typing = appendBubble("assistant", "Escribiendo…");

      try {
        const r = await fetch(WORKER_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: msg,
            history,
            context: currentContext,
            session_id,
            page_url: location.href
          })
        });

        const { data, raw } = await parseResponse(r);
        typing.remove();

        if (!r.ok) {
          appendBubble("assistant", "Error del servidor.");
          appendBubble("assistant", String(raw || "").slice(0, 600));
          appendButtonsRow([{ label: "Ver temas", send: "__topics__" }], { pushMenu: true });
          return;
        }

        if (typeof data?.context === "string" && data.context.trim()) {
          currentContext = data.context.trim();
          localStorage.setItem(CONTEXT_KEY, currentContext);
        }

        const reply = String(data?.reply ?? "").trim();
        if (reply) appendBubble("assistant", reply);

        const qa = pickQuickActions(data);
        if (qa.length) appendButtonsRow(qa, { pushMenu: false });

        const options = pickOptions(data);
        if (options.length) {
          appendButtonsRow(options, { pushMenu: true });
        } else {
          appendButtonsRow([{ label: "Ver temas", send: "__topics__" }], { pushMenu: true });
        }

      } catch (e) {
        typing.remove();
        appendBubble("assistant", "Error de conexión (fetch falló).");
        appendButtonsRow([{ label: "Ver temas", send: "__topics__" }], { pushMenu: true });
      }
    }

    function sendMessage() {
      const text = String(input.value || "").trim();
      if (!text) return;
      input.value = "";
      internalSend(text, { showUser: true });
    }
  });
})();
