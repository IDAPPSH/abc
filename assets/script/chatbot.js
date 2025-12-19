

(() => {
  if (window.__IDAPPSH_CHATBOT_INIT__) return;
  window.__IDAPPSH_CHATBOT_INIT__ = true;

  const WORKER_URL = "https://idappsh-ia.idappsh.workers.dev/chat";

  const GREETINGS = [
    "Hola 👋 ¿En qué te puedo apoyar hoy?",
    "¡Hey! 👋 Dime, ¿qué necesitas hacer?",
    "Hola 😊 Estoy aquí para ayudarte, ¿qué buscas?",
    "¡Bienvenido! 👋 ¿Cómo te puedo echar la mano?",
    "Hola 🤖 Cuéntame, ¿en qué te ayudo?",
    "¡Qué gusto verte! 👋 ¿Qué necesitas hoy?",
    "Hola 😄 Soy tu asistente virtual, ¿qué se te ofrece?",
    "¡Hey! 👋 Pregunta con confianza, ¿qué necesitas?",
    "Hola 👋 Listo para ayudarte, ¿por dónde empezamos?",
    "¡Buenas! 😎 ¿En qué te puedo servir?"
  ];
  const randomGreeting = () => GREETINGS[Math.floor(Math.random() * GREETINGS.length)];

  const SESSION_KEY = "IDAPPSH_CHAT_SESSION_ID";
  const CONTEXT_KEY = "IDAPPSH_CHAT_CONTEXT";
  const makeId = () => (crypto?.randomUUID?.() || (Date.now() + "-" + Math.random().toString(16).slice(2)));

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

    // ===== State =====
    let history = [];
    let session_id = localStorage.getItem(SESSION_KEY) || makeId();
    localStorage.setItem(SESSION_KEY, session_id);

    let currentContext = localStorage.getItem(CONTEXT_KEY) || "inicio";

    // stack para "Volver" (menús anteriores)
    // cada entrada: { context, options }
    let navStack = [];

    // evita re-render del inicio
    let booted = false;

    // ===== OPEN/CLOSE =====
    function openPanel() {
      panel.classList.add("open");
      panel.setAttribute("aria-hidden", "false");
      setTimeout(() => input.focus(), 50);

      if (!booted) {
        booted = true;
        showStartOnce();
      }
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

    // Evita submit/reload
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      sendMessage();
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    sendBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      sendMessage();
    });

    // ===== “PRESENCIA” (movimiento + nudge) =====
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

    // ===== UI helpers =====
    function appendBubble(role, text) {
      const div = document.createElement("div");
      div.className = "msg " + role;
      div.textContent = text;
      msgList.appendChild(div);
      msgList.scrollTop = msgList.scrollHeight;
      return div;
    }

    function appendButtonsRow(buttons) {
      if (!Array.isArray(buttons) || !buttons.length) return null;

      const wrap = document.createElement("div");
      wrap.className = "action-row";

      buttons.forEach((b) => {
        if (!b) return;

        // link button
        if (b.url) {
          const a = document.createElement("a");
          a.className = "action-btn";
          a.href = b.url;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.textContent = b.label || "Abrir";
          wrap.appendChild(a);
          return;
        }

        // send button
        const label = (b.label ?? "Opción").toString().trim();
        const send = (b.send ?? b.value ?? "").toString().trim();
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
      return wrap;
    }

    // ===== Parsing =====
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
        .filter(a => a?.url)
        .map(a => ({ label: a.label || "Abrir", url: a.url }));
    }

    function pickOptions(data) {
      // worker nuevo usa "options": [{label, send}]
      const opts = data?.options;
      if (!Array.isArray(opts)) return [];
      return opts
        .filter(o => o && typeof o === "object")
        .map(o => ({
          label: (o.label ?? "Opción").toString().trim().slice(0, 40),
          send: (o.send ?? "").toString().trim().slice(0, 250)
        }))
        .filter(o => o.send);
    }

    // ===== Start UI =====
    function showStartOnce() {
      appendBubble("assistant", randomGreeting());

      // SOLO dos botones, nada más
      appendButtonsRow([
        { label: "Ver temas", send: "__topics__" },
        { label: "Pregunta directa", send: "__direct__" }
      ]);
    }

    // ===== Navigation stack =====
    function pushMenuState({ context, options }) {
      if (!Array.isArray(options) || !options.length) return;
      navStack.push({ context, options });
      // limita stack
      if (navStack.length > 25) navStack.shift();
    }

    function goBackMenu() {
      // si hay al menos 2 pantallas, volvemos a la anterior
      if (navStack.length >= 2) {
        navStack.pop();
        const prev = navStack[navStack.length - 1];
        if (prev?.context) {
          currentContext = prev.context;
          localStorage.setItem(CONTEXT_KEY, currentContext);
        }
        appendButtonsRow(prev.options);
        return true;
      }

      // si no hay stack, volvemos a inicio (2 botones)
      appendButtonsRow([
        { label: "Ver temas", send: "__topics__" },
        { label: "Pregunta directa", send: "__direct__" }
      ]);
      return true;
    }

    // ===== Actions =====
    function handleAction(send) {
      const s = (send || "").trim();
      if (!s) return;

      if (s === "__direct__") {
        input.focus();
        return;
      }

      if (s === "__back__") {
        goBackMenu();
        return;
      }

      // topics SIEMPRE con worker (no menú local)
      if (s === "__topics__") {
        internalSend("__topics__", { showUser: false });
        return;
      }

      // normal: se manda como si el usuario lo escribió
      internalSend(s, { showUser: true });
    }

    // ===== Worker call =====
    async function internalSend(text, { showUser = true } = {}) {
      const msg = (text || "").trim();
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

        // status no OK
        if (!r.ok) {
          appendBubble("assistant", "Error del servidor.");
          appendBubble("assistant", raw.slice(0, 600));
          const qaFail = pickQuickActions(data);
          appendButtonsRow(qaFail.length ? qaFail : [
            { label: "WhatsApp", url: "https://wa.me/526633905025" },
            { label: "Telegram", url: "https://t.me/r_alameda" }
          ]);
          return;
        }

        // contexto del worker
        if (typeof data?.context === "string" && data.context.trim()) {
          currentContext = data.context.trim();
          localStorage.setItem(CONTEXT_KEY, currentContext);
        }

        const reply = (data?.reply ?? "").toString().trim();
        if (reply) {
          appendBubble("assistant", reply);
          history.push({ role: "assistant", content: reply });
        }

        // humano
        if (data?.needs_human === true) {
          const qa = pickQuickActions(data);
          appendButtonsRow(qa.length ? qa : [
            { label: "WhatsApp", url: "https://wa.me/526633905025" },
            { label: "Telegram", url: "https://t.me/r_alameda" }
          ]);
          return;
        }

        // opciones del worker
        const options = pickOptions(data);

        if (options.length) {
          // guardamos menú para "Volver"
          pushMenuState({ context: currentContext, options });

          // mostramos botones SIN meter “Elige…” como texto extra
          appendButtonsRow(options);
          return;
        }

        // fallback si no hay options
        appendButtonsRow([
          { label: "Ver temas", send: "__topics__" },
          { label: "Pregunta directa", send: "__direct__" }
        ]);

      } catch (e) {
        typing.remove();
        appendBubble("assistant", "Error de conexión real (fetch falló).");
        appendButtonsRow([
          { label: "WhatsApp", url: "https://wa.me/526633905025" },
          { label: "Telegram", url: "https://t.me/r_alameda" }
        ]);
      }
    }

    function sendMessage() {
      const text = (input.value || "").trim();
      if (!text) return;
      input.value = "";
      internalSend(text, { showUser: true });
    }

    // ===== Boot =====
    // IMPORTANTE: NO pintamos nada hasta que abras el panel, para evitar duplicados por recarga/caché.
    // (openPanel() llama showStartOnce() la primera vez)
    // ===== Boot =====
    // showStart();
  });
})();

