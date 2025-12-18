(() => {
  if (window.__IDAPPSH_CHATBOT_INIT__) return;
  window.__IDAPPSH_CHATBOT_INIT__ = true;

  const WORKER_URL = "https://idappsh-ia.idappsh.workers.dev/chat";

  // Saludos aleatorios (solo al inicio)
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

  // Sesión persistente (para que el bot “recuerde” aunque recargues)
  const SESSION_KEY = "IDAPPSH_CHAT_SESSION_ID";
  const CONTEXT_KEY = "IDAPPSH_CHAT_CONTEXT";
  const makeId = () =>
    (crypto?.randomUUID?.() || (Date.now() + "-" + Math.random().toString(16).slice(2)));

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
    let assistantCount = 0;

    // Contexto “bloqueado” por sesión (esto evita respuestas fuera de tema)
    let session_id = localStorage.getItem(SESSION_KEY) || makeId();
    localStorage.setItem(SESSION_KEY, session_id);

    let currentContext = localStorage.getItem(CONTEXT_KEY) || "inicio";

    // Si el usuario eligió “Pregunta directa”, no estorbamos con menús
    let directMode = false;

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

    // ======= UI helpers =======
    function appendBubble(role, text) {
      const div = document.createElement("div");
      div.className = "msg " + role;
      div.textContent = text;
      msgList.appendChild(div);
      msgList.scrollTop = msgList.scrollHeight;
      return div;
    }

    function appendActionsRow(buttons, { asLinks = false } = {}) {
      if (!buttons || !buttons.length) return null;

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

        const btn = document.createElement("button");
        btn.className = "action-btn";
        btn.type = "button";
        btn.textContent = b.label || "Opción";
        btn.onclick = () => {
          wrap.remove();
          smartSend(b.send ?? b.value ?? b.label ?? "");
        };
        wrap.appendChild(btn);
      });

      msgList.appendChild(wrap);
      msgList.scrollTop = msgList.scrollHeight;
      return wrap;
    }

    function appendHumanEscalation(actions = []) {
      // mensaje corto (no “se responde solo”)
      appendBubble("assistant", "Elige un canal:");

      const list = (actions || []).filter(a => a?.url);
      if (list.length) return appendActionsRow(list, { asLinks: true });

      return appendActionsRow([
        { label: "WhatsApp", url: "https://wa.me/526633905025" },
        { label: "Telegram", url: "https://t.me/r_alameda" }
      ], { asLinks: true });
    }

    function appendHelpfulButtons(actions) {
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
        appendBubble("assistant", "Perfecto. ¿Qué más necesitas?");
      };

      const no = document.createElement("button");
      no.className = "help-btn no";
      no.type = "button";
      no.textContent = "No 😕";
      no.onclick = () => {
        row.remove();
        // NO escalar automático: pedir contexto
        appendBubble("assistant", "Va. ¿Qué parte no te ayudó o qué quieres lograr exactamente? 🙂");
        input.focus();
      };

      row.appendChild(yes);
      row.appendChild(no);
      msgList.appendChild(row);
      msgList.scrollTop = msgList.scrollHeight;
    }

    function pickReply(data) {
      return (data?.reply ?? data?.message ?? data?.text ?? data?.answer ?? "").toString().trim();
    }

    function pickQuickActions(data) {
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
        .filter(x => x.send);
    }

    // ======= Flujo de inicio =======
    function showStart() {
      appendBubble("assistant", randomGreeting());
      appendActionsRow([
        { label: "Pregunta directa", send: "__direct__" },
        { label: "Ver temas", send: "__topics__" }
      ]);
    }

    function showTopics() {
      appendBubble("assistant", "Elige un tema:");
      appendActionsRow([
        { label: "Servicios", send: "__ctx__:servicios" },
        { label: "GEKOS", send: "__ctx__:gekos" },
        { label: "Soporte", send: "__ctx__:soporte" },
        { label: "Cotización", send: "__ctx__:cotizacion" },
        { label: "Links / contacto", send: "__ctx__:links_utiles" }
      ]);
    }

    function smartSend(text) {
      const s = (text || "").trim();
      if (!s) return;

      if (s === "__direct__") {
        directMode = true;
        appendBubble("assistant", "Va. Escribe tu pregunta 🙂");
        input.focus();
        return;
      }

      if (s === "__topics__") {
        directMode = false;
        showTopics();
        return;
      }

      // Cambiar contexto: actualiza y pide al worker botones de ese contexto
      if (/^__ctx__:/i.test(s)) {
        directMode = false;
        currentContext = s.split(":")[1]?.trim() || "inicio";
        localStorage.setItem(CONTEXT_KEY, currentContext);

        // mandamos el comando al worker para que responda “listo, estás en…”
        input.value = s;
        sendMessage();
        return;
      }

      // Pregunta normal: se manda al worker
      input.value = s;
      sendMessage();
    }

    function renderSuggestedButtons(buttons) {
      // Solo mostramos botones sugeridos si NO está en modo pregunta directa
      if (directMode) return;
      if (!buttons || !buttons.length) return;
      appendActionsRow(buttons);
    }

    // ======= Llamada al Worker (con contexto) =======
    async function sendMessage() {
      const text = (input.value || "").trim();
      if (!text) return;

      appendBubble("user", text);
      history.push({ role: "user", content: text });
      input.value = "";

      const typing = appendBubble("assistant", "Escribiendo…");

      try {
        const r = await fetch(WORKER_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            history,
            context: currentContext,   // 🔥 clave: mandar contexto actual
            session_id,                // 🔥 clave: sesión
            page_url: location.href    // opcional útil para logs
          })
        });

        const data = await r.json().catch(() => ({}));
        typing.remove();

        // Si el worker decide contexto, lo respetamos y lo guardamos
        if (typeof data?.context === "string" && data.context.trim()) {
          currentContext = data.context.trim();
          localStorage.setItem(CONTEXT_KEY, currentContext);
        }

        const reply = pickReply(data);
        const actions = pickQuickActions(data);
        const suggested = pickSuggestedButtons(data);

        if (!reply) {
          appendBubble("assistant", "No pude responder. ¿Quieres asistencia humana?");
          appendHumanEscalation(actions);
          return;
        }

        appendBubble("assistant", reply);
        history.push({ role: "assistant", content: reply });
        assistantCount++;

        if (data?.needs_human === true) {
          appendHumanEscalation(actions);
          return;
        }

        // Botones inteligentes (según contexto) que manda el worker
        renderSuggestedButtons(suggested);

        // “¿Te ayudó?” solo cada 4 respuestas (no spamear)
        if (assistantCount % 4 === 0) appendHelpfulButtons(actions);

      } catch (e) {
        typing.remove();
        appendBubble("assistant", "Error de conexión. ¿Quieres asistencia humana?");
        appendHumanEscalation([
          { label: "WhatsApp", url: "https://wa.me/526633905025" },
          { label: "Telegram", url: "https://t.me/@Lourdes_tec" }
        ]);
      }
    }

    // ======= Boot =======
    showStart();
  });
})();
