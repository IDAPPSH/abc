(() => {
  if (window.__IDAPPSH_CHATBOT_INIT__) return;
  window.__IDAPPSH_CHATBOT_INIT__ = true;

  const WORKER_URL = "https://idappsh-ia.idappsh.workers.dev/chat";
  const BUTTONS_URL = "https://idappsh.site/kb/buttons_kb.json";

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

  const makeId = () =>
    (crypto?.randomUUID?.() || (Date.now() + "-" + Math.random().toString(16).slice(2)));

  const ALLOWED_CONTEXTS = new Set([
    "inicio", "servicios", "gekos", "soporte", "cotizacion", "links_utiles", "topics"
  ]);

  document.addEventListener("DOMContentLoaded", () => {
    const launcher = document.getElementById("idappsh-chat-launcher");
    const panel = document.getElementById("idappsh-chat-panel");
    const closeBtn = document.getElementById("idappsh-chat-close");
    const msgList = document.getElementById("idappsh-chat-messages");
    const input = document.getElementById("idappsh-chat-input");
    const sendBtn = document.getElementById("idappsh-chat-send");

    // Validación DOM
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

    // Estado
    let history = [];
    let assistantCount = 0;

    let session_id = localStorage.getItem(SESSION_KEY) || makeId();
    localStorage.setItem(SESSION_KEY, session_id);

    let currentContext = (localStorage.getItem(CONTEXT_KEY) || "inicio").toLowerCase();
    if (!ALLOWED_CONTEXTS.has(currentContext)) currentContext = "inicio";

    // KB botones local
    let buttonsKB = null;

    // ======= OPEN/CLOSE =======
    function openPanel() {
      panel.classList.add("open");
      panel.setAttribute("aria-hidden", "false");
      setTimeout(() => input.focus(), 50);
    }
    function closePanelFn() {
      panel.classList.remove("open");
      panel.setAttribute("aria-hidden", "true");
    }

    launcher.addEventListener("click", (e) => {
      e.stopPropagation();
      if (panel.classList.contains("open")) closePanelFn();
      else openPanel();
    });

    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closePanelFn();
    });

    panel.addEventListener("click", (e) => e.stopPropagation());

    document.addEventListener("click", (e) => {
      if (!panel.classList.contains("open")) return;
      const clickedInside = panel.contains(e.target) || launcher.contains(e.target);
      if (!clickedInside) closePanelFn();
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

    // ======= “PRESENCIA” (movimiento + nudge) =======
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

    // ======= UI helpers =======
    function appendBubble(role, text) {
      const div = document.createElement("div");
      div.className = "msg " + role;
      div.textContent = text;
      msgList.appendChild(div);
      msgList.scrollTop = msgList.scrollHeight;
      return div;
    }

    // Botones/acciones
    function appendActionsRow(buttons, { asLinks = false } = {}) {
      if (!Array.isArray(buttons) || !buttons.length) return null;

      const wrap = document.createElement("div");
      wrap.className = "action-row";

      buttons.forEach((b) => {
        if (!b) return;

        // Links (WhatsApp/Telegram)
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

        // Chips con set_context + send
        const label = (b.label ?? "Opción").toString().trim();
        const send = (b.send ?? b.value ?? "").toString().trim();
        const set_context = (b.set_context ?? b.context ?? "").toString().trim().toLowerCase();

        // permitimos chips que solo cambian contexto, o solo mandan pregunta, o ambos
        if (!send && !set_context) return;

        const btn = document.createElement("button");
        btn.className = "action-btn";
        btn.type = "button";
        btn.textContent = label;

        btn.onclick = () => {
          wrap.remove();
          handleButtonSend({ send, set_context, label });
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

    function appendHelpfulButtons() {
      const row = document.createElement("div");
      row.className = "help-row";

      const q = document.createElement("div");
      q.className = "help-q";
      q.textContent = "¿Te ayudó esta respuesta?";
      row.appendChild(q);

      const yes = document.createElement("button");
      yes.className = "help-btn yes";
      yes.type = "button";
      yes.textContent = "Sí ✅";
      yes.onclick = () => {
        row.remove();
        appendBubble("assistant", "Perfecto. Elige una opción o pregunta directo:");
        showContextGuide(currentContext);
      };

      const no = document.createElement("button");
      no.className = "help-btn no";
      no.type = "button";
      no.textContent = "No 😕";
      no.onclick = () => {
        row.remove();
        appendBubble("assistant", "Va. Elige una opción o dime qué intentabas lograr:");
        showContextGuide(currentContext);
        input.focus();
      };

      row.appendChild(yes);
      row.appendChild(no);
      msgList.appendChild(row);
      msgList.scrollTop = msgList.scrollHeight;
    }

    // ======= Buttons KB (frontend) =======
    async function loadButtonsKB() {
      try {
        const r = await fetch(BUTTONS_URL, { cache: "no-store" });
        if (!r.ok) throw new Error("HTTP " + r.status);
        buttonsKB = await r.json();
      } catch (e) {
        console.warn("No pude cargar buttons_kb.json:", e);
        buttonsKB = null;
      }
    }

    function getChips(ctx) {
      const chips = buttonsKB?.contexts?.[ctx]?.chips;
      return Array.isArray(chips) ? chips : [];
    }

    function showTopicsMenu() {
      appendBubble("assistant", "Elige un tema:");
      appendActionsRow(getChips("topics"));
    }

    function showContextGuide(ctx) {
      if (!buttonsKB) return;
      const chips = getChips(ctx);
      if (!chips.length) return;
      appendBubble("assistant", "Opciones:");
      appendActionsRow(chips);
    }

    function showStart() {
      appendBubble("assistant", randomGreeting());

      // Si tienes chips en inicio, úsalos; si no, fallback
      const startChips = getChips("inicio");
      if (startChips.length) {
        appendActionsRow(startChips);
      } else {
        appendActionsRow([
          { label: "Ver temas", send: "__topics__" },
          { label: "Pregunta directa", send: "__direct__" }
        ]);
      }
    }

    // ======= Botón -> acción =======
    function handleButtonSend(payload) {
      let send = "";
      let set_context = "";

      if (typeof payload === "string") {
        send = payload.trim();
      } else if (payload && typeof payload === "object") {
        send = (payload.send || "").trim();
        set_context = (payload.set_context || "").trim().toLowerCase();
      }

      // aplica contexto si viene
      if (set_context && ALLOWED_CONTEXTS.has(set_context)) {
        currentContext = set_context;
        localStorage.setItem(CONTEXT_KEY, currentContext);
      }

      // comandos UI
      if (send === "__topics__") {
        showTopicsMenu();
        return;
      }

      if (send === "__direct__") {
        appendBubble("assistant", "Va. Escribe tu pregunta 🙂");
        input.focus();
        return;
      }

      // muestra menú del contexto actual (sin preguntar al worker)
      if (send === "__show_ctx_menu__" || send === "__menu__") {
        showContextGuide(currentContext);
        return;
      }

      // humano
      if (send === "__human__") {
        appendHumanEscalation([]);
        return;
      }

      // si solo cambió contexto (y no hay send), guía
      if (!send && set_context) {
        appendBubble("assistant", `Listo. Tema: ${currentContext.toUpperCase()}.`);
        showContextGuide(currentContext);
        return;
      }

      // manda la pregunta real al worker
      if (send) internalSend(send, { showUser: true });
    }

    // ======= Worker helpers =======
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
          send: (x.send ?? x.value ?? "").toString().trim(),
          set_context: (x.set_context ?? x.context ?? "").toString().trim().toLowerCase()
        }))
        .filter(x => x.send || x.set_context);
    }

    function mergeButtons(a, b, limit = 8) {
      const seen = new Set();
      const out = [];

      [...(a || []), ...(b || [])].forEach(x => {
        const key = ((x?.set_context || "") + "|" + (x?.send || x?.value || x?.label || "")).trim();
        if (!key || seen.has(key)) return;
        seen.add(key);
        out.push(x);
      });

      return out.slice(0, limit);
    }

    async function internalSend(text, { showUser = true } = {}) {
      const msg = (text || "").trim();
      if (!msg) return;

      if (showUser) {
        appendBubble("user", msg);
        history.push({ role: "user", content: msg });
      } else {
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
            context: currentContext,   // 🔥 sticky context
            session_id,
            page_url: location.href
          })
        });

        const data = await r.json().catch(() => ({}));
        typing.remove();

        // actualiza contexto si el worker manda uno válido
        if (typeof data?.context === "string") {
          const ctx = data.context.trim().toLowerCase();
          if (ALLOWED_CONTEXTS.has(ctx)) {
            currentContext = ctx;
            localStorage.setItem(CONTEXT_KEY, currentContext);
          }
        }

        const reply = pickReply(data);
        const actions = pickActions(data);
        const suggestedFromWorker = pickSuggestedButtons(data);

        if (!reply) {
          appendBubble("assistant", "No pude responder. Elige una opción:");
          showContextGuide(currentContext);
          return;
        }

        appendBubble("assistant", reply);
        history.push({ role: "assistant", content: reply });
        assistantCount++;

        // humano solo si worker lo pide
        if (data?.needs_human === true) {
          appendHumanEscalation(actions);
          return;
        }

        // Botones: mezcla worker + local (por contexto)
        const localButtons = getChips(currentContext);
        const merged = mergeButtons(suggestedFromWorker, localButtons, 8);

        if (merged.length) {
          appendBubble("assistant", "Sigue por aquí:");
          appendActionsRow(merged);
        } else {
          showContextGuide(currentContext);
        }

        if (assistantCount % 4 === 0) appendHelpfulButtons();

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

    // ======= Boot =======
    (async () => {
      await loadButtonsKB();

      // arranque guiado
      showStart();

      // si ya traes contexto guardado (ej. gekos), guía de una vez
      if (currentContext && currentContext !== "inicio") {
        showContextGuide(currentContext);
      }
    })();
  });
})();
