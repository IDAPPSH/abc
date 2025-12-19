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
    let history = [];
    let currentContext = "inicio";
    let session_id = localStorage.getItem(SESSION_KEY) || makeId();
    localStorage.setItem(SESSION_KEY, session_id);

    // ===== OPEN/CLOSE =====
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

    function showStart() {
      appendBubble("assistant", randomGreeting());
      appendButtonsRow([
        { label: "Ver temas", send: "__topics__" },
        { label: "Pregunta directa", send: "__direct__" }
      ]);
    }

    function showTopics() {
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

    function pickSuggestedButtons(data) {
      const sb = data?.suggested_buttons;
      if (!Array.isArray(sb)) return [];
      return sb
        .filter(x => x && typeof x === "object")
        .map(x => ({
          label: (x.label ?? "Opción").toString().trim(),
          send: (x.send ?? x.value ?? "").toString().trim()
        }))
        .filter(x => x.send);
    }

    function pickQuickActions(data) {
      const qa = data?.quick_actions;
      if (!Array.isArray(qa)) return [];
      return qa
        .filter(a => a?.url)
        .map(a => ({ label: a.label || "Abrir", url: a.url }));
    }

    // ===== Actions =====
    function handleAction(send) {
      const s = (send || "").trim();
      if (!s) return;

      if (s === "__topics__") return showTopics();
      if (s === "__direct__") return showDirect();
      if (s === "__back__") return showStart();

      // change context by telling worker, BUT don't show "__ctx__" as user message
      if (/^__ctx__:/i.test(s)) {
        const ctx = s.split(":")[1]?.trim() || "inicio";
        currentContext = ctx;
        internalSend(s, { showUser: false });
        return;
      }

      // normal question: show as user text
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

        // si el worker trae contexto, lo tomamos
        if (typeof data?.context === "string" && data.context.trim()) {
          currentContext = data.context.trim();
        }

        const reply = (data?.reply ?? "").toString().trim();
        if (!reply) {
          appendBubble("assistant", "El servidor no mandó reply. Respuesta cruda:");
          appendBubble("assistant", raw.slice(0, 800));
          return;
        }

        appendBubble("assistant", reply);
        history.push({ role: "assistant", content: reply });

        // Si pidió humano, muestra links de contacto
        if (data?.needs_human === true) {
          const qa = pickQuickActions(data);
          appendBubble("assistant", "Elige un canal:");
          appendButtonsRow(qa.length ? qa : [
            { label: "WhatsApp", url: "https://wa.me/526633905025" },
            { label: "Telegram", url: "https://t.me/r_alameda" }
          ]);
          return;
        }

        // Botones sugeridos (del worker)
        const suggested = pickSuggestedButtons(data);

        // Siempre damos “Volver a temas”
        const withBack = [
          ...suggested.slice(0, 7),
          { label: "Volver", send: "__topics__" }
        ];

        // Si no hay sugeridos, al menos volver
        if (!suggested.length) {
          appendButtonsRow([{ label: "Ver temas", send: "__topics__" }]);
          return;
        }

        appendBubble("assistant", "Elige una opción o pregunta directo:");
        appendButtonsRow(withBack);

      } catch (e) {
        typing.remove();
        appendBubble("assistant", "Error de conexión real (fetch falló).");
        appendBubble("assistant", "Elige un canal:");
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
    showStart();
  });
})();
