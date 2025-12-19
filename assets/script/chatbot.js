(() => {
  if (window.__IDAPPSH_CHATBOT_INIT__) return;
  window.__IDAPPSH_CHATBOT_INIT__ = true;

  const WORKER_URL = "https://idappsh-ia.idappsh.workers.dev/chat";

  const GREETINGS = [
    "Hola 👋 ¿En qué te puedo apoyar hoy?",
    "¡Buenas! 🙌 ¿En qué te puedo servir?",
    "Hola 😊 ¿En qué te apoyo hoy?"
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

    let booted = false;
    let history = [];
    let currentContext = localStorage.getItem(CONTEXT_KEY) || "inicio";
    let session_id = localStorage.getItem(SESSION_KEY) || makeId();
    localStorage.setItem(SESSION_KEY, session_id);

    // stack real de menús (options send)
    const navStack = []; // { context, options }

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
        if (!b) return;

        // LINK
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

        // SEND
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
        const onlySend = buttons.filter(x => x && x.send);
        if (onlySend.length) {
          navStack.push({ context: currentContext, options: onlySend });
          if (navStack.length > 30) navStack.shift();
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

    function openPanel() {
      panel.classList.add("open");
      panel.setAttribute("aria-hidden", "false");

      if (!booted) {
        booted = true;
        resetChat();
        showStart();
      }

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

    function pickOptions(data) {
      const opts = data?.options;
      if (!Array.isArray(opts)) return [];
      return opts
        .filter(x => x && typeof x === "object" && x.send)
        .map(x => ({ label: String(x.label ?? "Opción"), send: String(x.send ?? "") }));
    }

    function pickQuickActions(data) {
      const qa = data?.quick_actions;
      if (!Array.isArray(qa)) return [];
      return qa
        .filter(a => a?.url)
        .map(a => ({ label: a.label || "Abrir", url: a.url }));
    }

    function handleAction(send) {
      const s = (send || "").trim();
      if (!s) return;

      if (s === "__direct__") {
        appendBubble("assistant", "Va. Escribe tu pregunta 🙂");
        input.focus();
        return;
      }
      if (s === "__back__") return goBackMenu();
      if (s === "__topics__") return internalSend("__topics__", { showUser: false });

      internalSend(s, { showUser: true });
    }

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

        if (!r.ok) {
          appendBubble("assistant", "Error del servidor.");
          appendBubble("assistant", raw.slice(0, 600));
          appendButtonsRow([{ label: "Ver temas", send: "__topics__" }], { pushMenu: true });
          return;
        }

        if (typeof data?.context === "string" && data.context.trim()) {
          currentContext = data.context.trim();
          localStorage.setItem(CONTEXT_KEY, currentContext);
        }

        const reply = String(data?.reply ?? "").trim();
        if (reply) appendBubble("assistant", reply);

        // ✅ LINKS (quick_actions) SIEMPRE como botones link (NO al stack)
        const qa = pickQuickActions(data);
        if (qa.length) appendButtonsRow(qa, { pushMenu: false });

        // ✅ MENÚ (options) sí al stack para Volver
        const options = pickOptions(data);
        if (options.length) {
          appendButtonsRow(options, { pushMenu: true });
        } else {
          appendButtonsRow([{ label: "Ver temas", send: "__topics__" }], { pushMenu: true });
        }
      } catch {
        typing.remove();
        appendBubble("assistant", "Error de conexión (fetch falló).");
        appendButtonsRow([{ label: "Ver temas", send: "__topics__" }], { pushMenu: true });
      }
    }

    function sendMessage() {
      const text = (input.value || "").trim();
      if (!text) return;
      input.value = "";
      internalSend(text, { showUser: true });
    }
  });
})();
