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

    const missing = [];
    if (!launcher) missing.push("idappsh-chat-launcher");
    if (!panel) missing.push("idappsh-chat-panel");
    if (!closeBtn) missing.push("idappsh-chat-close");
    if (!msgList) missing.push("idappsh-chat-messages");
    if (!input) missing.push("idappsh-chat-input");
    if (!sendBtn) missing.push("idappsh-chat-send");

    if (missing.length) {
      console.warn("Faltan elementos del chatbot:", missing.join(", "));
      return;
    }

    let history = [];
    let session_id = localStorage.getItem(SESSION_KEY) || makeId();
    localStorage.setItem(SESSION_KEY, session_id);

    let currentContext = localStorage.getItem(CONTEXT_KEY) || "inicio";

    // ======= OPEN/CLOSE =======
    function openPanel() {
      panel.classList.add("open");
      panel.setAttribute("aria-hidden", "false");
      setTimeout(() => input.focus(), 50);
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

    // ======= PRESENCIA (tu nudge + movimiento) =======
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
        launcher.offsetHeight;
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

    // ======= UI =======
    function appendBubble(role, text) {
      const div = document.createElement("div");
      div.className = "msg " + role;
      div.textContent = text;
      msgList.appendChild(div);
      msgList.scrollTop = msgList.scrollHeight;
      return div;
    }

    function appendActionsRow(buttons, { asLinks = false } = {}) {
      if (!Array.isArray(buttons) || !buttons.length) return null;

      const wrap = document.createElement("div");
      wrap.className = "action-row";

      buttons.forEach((b) => {
        if (!b) return;

        if (asLinks) {
          if (!b.url) return;
          const a = document.createElement("a");
          a.className = "action-btn";
          a.href = b.url;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.textContent = b.label || "Abrir";
          wrap.appendChild(a);
          return;
        }

        const label = (b.label ?? "Opción").toString().trim();
        const send = (b.send ?? b.value ?? "").toString().trim();
        if (!send) return;

        const btn = document.createElement("button");
        btn.className = "action-btn";
        btn.type = "button";
        btn.textContent = label;
        btn.onclick = () => {
          wrap.remove();
          handleButtonSend(send);
        };
        wrap.appendChild(btn);
      });

      if (!wrap.childNodes.length) return null;
      msgList.appendChild(wrap);
      msgList.scrollTop = msgList.scrollHeight;
      return wrap;
    }

    function appendHumanEscalation(actions = []) {
      appendBubble("assistant", "Elige un canal:");
      const list = (actions || []).filter(a => a?.url);
      if (list.length) return appendActionsRow(list, { asLinks: true });

      return appendActionsRow([
        { label: "WhatsApp", url: "https://wa.me/526633905025" },
        { label: "Telegram", url: "https://t.me/r_alameda" }
      ], { asLinks: true });
    }

    function showStart() {
      appendBubble("assistant", randomGreeting());
      appendActionsRow([
        { label: "Ver temas", send: "__topics__" },
        { label: "Pregunta directa", send: "__direct__" }
      ]);
    }

    function handleButtonSend(send) {
      const s = (send || "").trim();
      if (!s) return;

      if (s === "__direct__") {
        appendBubble("assistant", "Va. Escribe tu pregunta 🙂");
        input.focus();
        return;
      }

      // Todos los demás botones se mandan al worker (incluye __topics__ y __ctx__)
      internalSend(s, { showUser: false });
    }

    function pickReply(data) {
      return (data?.reply ?? data?.message ?? data?.text ?? data?.answer ?? "").toString().trim();
    }

    function pickActions(data) {
      const qa = data?.quick_actions;
      return Array.isArray(qa) ? qa : [];
    }

    function pickSuggestedButtons(data) {
      const sb = data?.suggested_buttons;
      if (!Array.isArray(sb)) return [];
      return sb
        .filter(x => x && typeof x === "object")
        .map(x => ({
          label: (x.label ?? "").toString().trim() || "Opción",
          send: (x.send ?? x.value ?? "").toString().trim()
        }))
        .filter(x => x.send)
        .slice(0, 8);
    }

    async function internalSend(text, { showUser = true } = {}) {
      const msg = (text || "").trim();
      if (!msg) return;

      if (showUser) {
        appendBubble("user", msg);
        history.push({ role: "user", content: msg });
      } else {
        // comandos internos NO los mostramos como mensaje del usuario
        history.push({ role: "user", content: msg });
      }

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

        const data = await r.json().catch(() => ({}));
        typing.remove();

        if (typeof data?.context === "string" && data.context.trim()) {
          currentContext = data.context.trim();
          localStorage.setItem(CONTEXT_KEY, currentContext);
        }

        const reply = pickReply(data);
        const actions = pickActions(data);
        const suggested = pickSuggestedButtons(data);

        if (!reply) {
          appendBubble("assistant", "No pude responder.");
          // fallback mínimo
          appendActionsRow([{ label: "Ver temas", send: "__topics__" }]);
          return;
        }

        appendBubble("assistant", reply);
        history.push({ role: "assistant", content: reply });

        if (data?.needs_human === true) {
          appendHumanEscalation(actions);
          return;
        }

        if (suggested.length) {
          appendActionsRow(suggested);
        } else {
          // fallback mínimo
          appendActionsRow([{ label: "Ver temas", send: "__topics__" }]);
        }

      } catch (e) {
        typing.remove();
        appendBubble("assistant", "Error de conexión.");
        appendHumanEscalation([
          { label: "WhatsApp", url: "https://wa.me/526633905025" },
          { label: "Telegram", url: "https://t.me/r_alameda" }
        ]);
      }
    }

    async function sendMessage() {
      const text = (input.value || "").trim();
      if (!text) return;
      input.value = "";
      internalSend(text, { showUser: true });
    }

    // Boot
    showStart();
  });
})();

