(() => {
  if (window.__IDAPPSH_CHATBOT_INIT__) return;
  window.__IDAPPSH_CHATBOT_INIT__ = true;

  const WORKER_URL = "https://idappsh-ia.idappsh.workers.dev/chat";

  const GREETINGS = [
    "Hola 👋 ¿En qué te puedo apoyar hoy?",
    "¡Hey! ✋ ¿Qué necesitas hacer?",
    "Hola 😊 Estoy aquí para ayudarte, ¿qué buscas?",
    "¡Bienvenido! 🎉 ¿Cómo te puedo ayudar?",
    "Hola 🤖 Cuéntame, ¿en qué te ayudo?",
    "¡Qué gusto verte! 😄 ¿Qué necesitas hoy?",
    "Hola 🗣️ ¿Qué se te ofrece?",
    "¡Hey! ❓ Pregunta con confianza",
    "Hola 🧭 ¿Por dónde empezamos?",
    "¡Buenas! 🙌 ¿En qué te puedo servir?",
    "Hola 💬 ¿En qué te apoyo hoy?",
    "¡Hey! ⚡ ¿Qué necesitas?"
  ];
  const randomGreeting = () => GREETINGS[Math.floor(Math.random() * GREETINGS.length)];

  const SESSION_KEY = "IDAPPSH_CHAT_SESSION_ID";
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

    // ===== state =====
    let booted = false;
    let history = [];
    let currentContext = "inicio";
    let session_id = localStorage.getItem(SESSION_KEY) || makeId();
    localStorage.setItem(SESSION_KEY, session_id);

    // navegación simple
    const navStack = []; // guarda { context } para volver

    // ===== OPEN/CLOSE =====
    function openPanel() {
      panel.classList.add("open");
      panel.setAttribute("aria-hidden", "false");

      // ✅ Inicializa SOLO al abrir por primera vez
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

    // Evita submit/reload
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

    // ===== UI helpers =====
    function resetChat() {
      msgList.innerHTML = "";
      history = [];
      currentContext = "inicio";
      navStack.length = 0;
    }

    function escapeHtml(s) {
      return (s ?? "").toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function linkify(text) {
      let t = escapeHtml(text);

      // http/https
      t = t.replace(/(https?:\/\/[^\s<]+)/g, (m) =>
        `<a href="${m}" target="_blank" rel="noopener noreferrer">${m}</a>`
      );

      // mailto:
      t = t.replace(/(mailto:[^\s<]+)/g, (m) => {
        const label = m.replace("mailto:", "");
        return `<a href="${m}">${label}</a>`;
      });

      // [texto](url) (markdown básico)
      t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, (m, label, url) => {
        const safeLabel = escapeHtml(label);
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">${safeLabel}</a>`;
      });

      // saltos de línea
      t = t.replace(/\n/g, "<br/>");
      return t;
    }

    function appendBubble(role, text) {
      const div = document.createElement("div");
      div.className = "msg " + role;

      if (role === "assistant") {
        div.innerHTML = linkify(text);
      } else {
        div.textContent = text;
      }

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

        // link (redirige)
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

        // send (manda texto al worker)
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
      return wrap;
    }

    // ===== Start / Topics =====
    function showStart() {
      appendBubble("assistant", randomGreeting());
      appendButtonsRow([
        { label: "Ver temas", send: "__topics__" },
        { label: "Pregunta directa", send: "__direct__" }
      ]);
    }

    function showTopics() {
      navStack.push({ context: currentContext });

      appendBubble("assistant", "Elige un tema:");
      appendButtonsRow([
        { label: "Servicios", send: "__ctx__:servicios" },
        { label: "GEKOS", send: "__ctx__:gekos" },
        { label: "Soporte", send: "__ctx__:soporte" },
        { label: "Cotización", send: "__ctx__:cotizacion" },
        { label: "Links / contacto", send: "__ctx__:links_utiles" },
        { label: "Volver", send: "__back__" }
      ]);
    }

    function showDirect() {
      appendBubble("assistant", "Va. Escribe tu pregunta 🙂");
      input.focus();
    }

    // ===== Robust parse =====
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

    // ✅ CLAVE: ahora soporta options con url y/o send

    function pickOptions(data) {
      const opts = data?.options;
      if (!Array.isArray(opts)) return [];
      return opts
        .filter(x => x && typeof x === "object")
        .map(x => ({
          label: String(x.label ?? "Opción").trim().slice(0, 60),
          send: x.send ? String(x.send).trim().slice(0, 250) : "",
          url: x.url ? String(x.url).trim().slice(0, 800) : ""
        }))
        .filter(x => x.send || x.url);
    }


    // ===== Actions =====
    function handleAction(send) {
      const s = (send || "").trim();
      if (!s) return;

      if (s === "__topics__") return showTopics();
      if (s === "__direct__") return showDirect();

      if (s === "__back__") {
        const prev = navStack.pop();
        if (!prev) {
          resetChat();
          showStart();
          return;
        }
        currentContext = prev.context || "inicio";
        resetChat();
        showStart();
        return;
      }

      if (/^__ctx__:/i.test(s)) {
        const ctx = s.split(":")[1]?.trim() || "inicio";
        currentContext = ctx;
        internalSend(`Cambiar tema a ${ctx}`, { showUser: false });
        return;
      }

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

        if (typeof data?.context === "string" && data.context.trim()) {
          currentContext = data.context.trim();
        }

        const reply = String(data?.reply ?? "").trim();
        if (!reply) {
          appendBubble("assistant", "El servidor no mandó reply. Respuesta cruda:");
          appendBubble("assistant", raw.slice(0, 800));
          return;
        }

        appendBubble("assistant", reply);
        history.push({ role: "assistant", content: reply });

        // needs_human → quick actions
        if (data?.needs_human === true) {
          const qa = pickQuickActions(data);
          appendBubble("assistant", "Elige un canal:");
          appendButtonsRow(qa.length ? qa : [
            { label: "WhatsApp", url: "https://wa.me/526633905025" },        // :contentReference[oaicite:3]{index=3}
            { label: "Telegram", url: "https://t.me/Lourdes_tec" }             // :contentReference[oaicite:4]{index=4}
          ]);
          return;
        }

        // ✅ opciones generadas por el worker (send/url)
        const options = pickOptions(data);

        if (options.length) {
          appendBubble("assistant", "Elige una opción o pregunta directo:");
          appendButtonsRow([
            ...options.slice(0, 10),
            { label: "Ver temas", send: "__topics__" }
          ]);
        } else {
          appendButtonsRow([{ label: "Ver temas", send: "__topics__" }]);
        }

      } catch (e) {
        typing.remove();
        appendBubble("assistant", "Error de conexión (fetch falló).");
        appendBubble("assistant", "Elige un canal:");
        appendButtonsRow([
          { label: "WhatsApp", url: "https://wa.me/526633905025" },          // :contentReference[oaicite:5]{index=5}
          { label: "Telegram", url: "https://t.me/Lourdes_tec" }               // :contentReference[oaicite:6]{index=6}
        ]);
      }
    }

    function sendMessage() {
      const text = (input.value || "").trim();
      if (!text) return;
      input.value = "";
      internalSend(text, { showUser: true });
    }

    // ✅ OJO: ya NO llamamos showStart() aquí.
    // Se hace hasta que abras el panel.
  });
})();
