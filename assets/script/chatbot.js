// (() => {
//   if (window.__IDAPPSH_CHATBOT_INIT__) return;
//   window.__IDAPPSH_CHATBOT_INIT__ = true;

//   const WORKER_URL = "https://idappsh-ia.idappsh.workers.dev/chat";

//   document.addEventListener("DOMContentLoaded", () => {
//     const launcher = document.getElementById("idappsh-chat-launcher");
//     const panel = document.getElementById("idappsh-chat-panel");
//     const closeBtn = document.getElementById("idappsh-chat-close");

//     const msgList = document.getElementById("idappsh-chat-messages");
//     const input = document.getElementById("idappsh-chat-input");
//     const sendBtn = document.getElementById("idappsh-chat-send");

//     // Si falta algo: imprime EXACTAMENTE qué falta
//     const missing = [];
//     if (!launcher) missing.push("idappsh-chat-launcher");
//     if (!panel) missing.push("idappsh-chat-panel");
//     if (!closeBtn) missing.push("idappsh-chat-close");
//     if (!msgList) missing.push("idappsh-chat-messages");
//     if (!input) missing.push("idappsh-chat-input");
//     if (!sendBtn) missing.push("idappsh-chat-send");

//     if (missing.length) {
//       console.warn("Faltan elementos del chatbot:", missing.join(", "));
//       return;
//     }

//     let history = [];

//     // ======= OPEN/CLOSE =======
//     function openPanel() {
//       panel.classList.add("open");
//       panel.setAttribute("aria-hidden", "false");
//       setTimeout(() => input.focus(), 50);
//     }
//     function closePanel() {
//       panel.classList.remove("open");
//       panel.setAttribute("aria-hidden", "true");
//     }

//     launcher.addEventListener("click", (e) => {
//       e.stopPropagation();
//       if (panel.classList.contains("open")) closePanel();
//       else openPanel();
//     });

//     closeBtn.addEventListener("click", (e) => {
//       e.stopPropagation();
//       closePanel();
//     });

//     panel.addEventListener("click", (e) => e.stopPropagation());

//     document.addEventListener("click", (e) => {
//       if (!panel.classList.contains("open")) return;
//       const clickedInside = panel.contains(e.target) || launcher.contains(e.target);
//       if (!clickedInside) closePanel();
//     });

//     input.addEventListener("keydown", (e) => {
//       if (e.key === "Enter" && !e.shiftKey) {
//         e.preventDefault();
//         sendMessage();
//       }
//     });

//     sendBtn.addEventListener("click", (e) => {
//       e.preventDefault();
//       e.stopPropagation();
//       sendMessage();
//     });

//     // ======= “PRESENCIA” (tu nudge cada 3s) =======
//     (function setupPresence() {
//       let raf = null;

//       const minTop = 140;
//       const maxTop = () => Math.max(180, window.innerHeight - 170);

//       function setTop(px) {
//         document.documentElement.style.setProperty("--cb-launcher-top", px + "px");
//       }

//       function syncTop() {
//         const doc = document.documentElement;
//         const maxScroll = Math.max(1, doc.scrollHeight - window.innerHeight);
//         const p = Math.min(1, Math.max(0, window.scrollY / maxScroll));
//         const top = minTop + (maxTop() - minTop) * p;
//         setTop(top);
//       }

//       function onScroll() {
//         if (raf) return;
//         raf = requestAnimationFrame(() => {
//           raf = null;
//           syncTop();
//         });
//       }

//       window.addEventListener("scroll", onScroll, { passive: true });
//       window.addEventListener("resize", onScroll, { passive: true });
//       syncTop();

//       // NUDGE
//       let lock = false;
//       function nudge() {
//         if (lock) return;
//         if (panel.classList.contains("open")) return;

//         lock = true;
//         launcher.classList.remove("is-nudging");
//         launcher.offsetHeight; // reflow
//         launcher.classList.add("is-nudging");

//         setTimeout(() => launcher.classList.remove("is-nudging"), 560);
//         setTimeout(() => (lock = false), 900);
//       }

//       document.addEventListener("click", nudge, true);
//       document.addEventListener("keydown", nudge, true);

//       setInterval(() => {
//         if (document.visibilityState !== "visible") return;
//         nudge();
//       }, 3000);
//     })();

//     // ======= UI helpers =======
//     function appendBubble(role, text) {
//       const div = document.createElement("div");
//       div.className = "msg " + role;
//       div.textContent = text;
//       msgList.appendChild(div);
//       msgList.scrollTop = msgList.scrollHeight;
//       return div;
//     }

//     function appendHumanEscalation(actions = []) {
//       appendBubble("assistant", "Va. ¿Quieres asistencia humana? Elige un canal:");

//       const wrap = document.createElement("div");
//       wrap.className = "action-row";

//       (actions || []).forEach(a => {
//         if (!a?.url) return;
//         const btn = document.createElement("a");
//         btn.className = "action-btn";
//         btn.href = a.url;
//         btn.target = "_blank";
//         btn.rel = "noopener noreferrer";
//         btn.textContent = a.label || "Abrir";
//         wrap.appendChild(btn);
//       });

//       // si vino vacío, mete defaults
//       if (!wrap.childNodes.length) {
//         const wa = document.createElement("a");
//         wa.className = "action-btn";
//         wa.href = "https://wa.me/526633905025";
//         wa.target = "_blank";
//         wa.rel = "noopener noreferrer";
//         wa.textContent = "WhatsApp";
//         wrap.appendChild(wa);

//         const tg = document.createElement("a");
//         tg.className = "action-btn";
//         tg.href = "https://t.me/r_alameda";
//         tg.target = "_blank";
//         tg.rel = "noopener noreferrer";
//         tg.textContent = "Telegram";
//         wrap.appendChild(tg);
//       }

//       msgList.appendChild(wrap);
//       msgList.scrollTop = msgList.scrollHeight;
//     }

//     function appendHelpfulButtons(actions) {
//       const row = document.createElement("div");
//       row.className = "help-row";

//       const q = document.createElement("div");
//       q.className = "help-q";
//       q.textContent = "¿Te ayudó esta respuesta?";
//       row.appendChild(q);

//       const yes = document.createElement("button");
//       yes.className = "help-btn yes";
//       yes.type = "button";
//       yes.textContent = "Sí ✅";
//       yes.onclick = () => {
//         row.remove();
//         appendBubble("assistant", "Perfecto. ¿Qué más necesitas?");
//       };

//       const no = document.createElement("button");
//       no.className = "help-btn no";
//       no.type = "button";
//       no.textContent = "No 😕";
//       no.onclick = () => {
//         row.remove();
//         appendHumanEscalation(actions);
//       };

//       row.appendChild(yes);
//       row.appendChild(no);
//       msgList.appendChild(row);
//       msgList.scrollTop = msgList.scrollHeight;
//     }

//     function pickReply(data) {
//       return (data?.reply ?? data?.message ?? data?.text ?? data?.answer ?? "").toString().trim();
//     }

//     function pickActions(data) {
//       const qa = data?.quick_actions;
//       return Array.isArray(qa) ? qa : [];
//     }

//     // ======= Worker call =======
//     async function sendMessage() {
//       const text = (input.value || "").trim();
//       if (!text) return;

//       appendBubble("user", text);
//       history.push({ role: "user", content: text });
//       input.value = "";

//       const typing = appendBubble("assistant", "Escribiendo…");

//       try {
//         const r = await fetch(WORKER_URL, {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({ message: text, history })
//         });

//         const data = await r.json();
//         typing.remove();

//         const reply = pickReply(data);
//         const actions = pickActions(data);

//         if (!reply) {
//           appendBubble("assistant", "No pude responder. ¿Quieres asistencia humana?");
//           appendHumanEscalation(actions);
//           return;
//         }

//         appendBubble("assistant", reply);
//         history.push({ role: "assistant", content: reply });

//         if (data?.needs_human === true) appendHumanEscalation(actions);
//         else appendHelpfulButtons(actions);

//       } catch (e) {
//         typing.remove();
//         appendBubble("assistant", "Error de conexión. ¿Quieres asistencia humana?");
//         appendHumanEscalation([
//           { label: "WhatsApp", url: "https://wa.me/526633905025" },
//           { label: "Telegram", url: "https://t.me/r_alameda" }
//         ]);
//       }
//     }

//     // Mensaje inicial
//     appendBubble("assistant", "Qué onda 👋 Soy IDAPPSH IA. ¿Qué necesitas?");
//     appendHelpfulButtons([
//       { label: "WhatsApp", url: "https://wa.me/526633905025" },
//       { label: "Telegram", url: "https://t.me/r_alameda" }
//     ]);
//   });
// })();
(() => {
  // ====== VERSION / DEBUG ======
  console.log("IDAPPSH CHATBOT LOADED >>> v2025-12-18-B");
  window.__CHATBOT_VER__ = "v2025-12-18-B";

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
  const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

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
    const form = document.getElementById("idappsh-chat-form");

    // Si falta algo: imprime EXACTAMENTE qué falta
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

    // ======= STATE =======
    let history = [];
    let buttonsKB = null;

    let session_id = localStorage.getItem(SESSION_KEY) || makeId();
    localStorage.setItem(SESSION_KEY, session_id);

    let currentContext = localStorage.getItem(CONTEXT_KEY) || "inicio";
    let mode = "start"; // start | topics | direct | context

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

    // MUY IMPORTANTE: evitar submit del form (si no, se rompe el flujo)
    form.addEventListener("submit", (e) => {
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

    function appendButtonsRow(buttons) {
      if (!Array.isArray(buttons) || !buttons.length) return null;

      const wrap = document.createElement("div");
      wrap.className = "action-row";

      buttons.forEach((b) => {
        if (!b) return;

        const label = String(b.label ?? "Opción").trim();
        const send = String(b.send ?? b.value ?? "").trim();
        if (!send) return;

        const btn = document.createElement("button");
        btn.className = "action-btn";
        btn.type = "button";
        btn.textContent = label;
        btn.onclick = () => {
          wrap.remove();
          handleCommand(send);
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

      const list = (actions || []).filter(a => a?.url).map(a => ({
        label: a.label || "Abrir",
        send: "__open__:" + a.url
      }));

      // fallback
      const fallback = [
        { label: "WhatsApp", send: "__open__:https://wa.me/526633905025" },
        { label: "Telegram", send: "__open__:https://t.me/r_alameda" }
      ];

      appendButtonsRow(list.length ? list : fallback);
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
        .filter(x => x.send);
    }

    // ======= KB buttons (local) =======
    async function loadButtonsKB() {
      try {
        const r = await fetch(BUTTONS_URL + "?v=" + Date.now(), { cache: "no-store" });
        if (!r.ok) throw new Error("HTTP " + r.status);
        buttonsKB = await r.json();
      } catch (e) {
        console.warn("No pude cargar buttons_kb.json:", e);
        buttonsKB = null;
      }
    }

    function kbButtonsForContext(ctx) {
      if (!buttonsKB) return [];

      // Soporta:
      // A) { contexts: { gekos: { chips: [...] } } }
      const chips = buttonsKB?.contexts?.[ctx]?.chips;
      if (Array.isArray(chips) && chips.length) return chips.slice(0, 8);

      // B) { gekos: { preguntas: [...] } }
      const preguntas = buttonsKB?.[ctx]?.preguntas;
      if (Array.isArray(preguntas) && preguntas.length) {
        return preguntas.slice(0, 8).map(q => ({ label: String(q).slice(0, 40), send: String(q) }));
      }

      return [];
    }

    function mergeButtons(a, b, limit = 8) {
      const seen = new Set();
      const out = [];

      [...(a || []), ...(b || [])].forEach(x => {
        const key = (x?.send || x?.label || "").toString().trim();
        if (!key || seen.has(key)) return;
        seen.add(key);
        out.push(x);
      });

      // Siempre agrega "Volver" al final si no está
      if (!out.some(x => (x.send || "").toLowerCase() === "__back__")) {
        out.push({ label: "Volver", send: "__back__" });
      }

      return out.slice(0, limit);
    }

    // ======= Menús =======
    function showStart() {
      mode = "start";
      appendBubble("assistant", rand(GREETINGS));
      appendButtonsRow([
        { label: "Ver temas", send: "__topics__" },
        { label: "Pregunta directa", send: "__direct__" }
      ]);
    }

    function showTopicsMenu() {
      mode = "topics";
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

    function showContextGuide(ctx) {
      mode = "context";
      const local = kbButtonsForContext(ctx);

      appendBubble("assistant", "Elige una opción o pregunta directo:");
      const row = mergeButtons([], local, 8);
      appendButtonsRow(row);
    }

    // ======= Commands (NO se imprimen como usuario) =======
    function handleCommand(send) {
      const s = (send || "").trim();
      if (!s) return;

      if (s === "__topics__") {
        showTopicsMenu();
        return;
      }

      if (s === "__direct__") {
        mode = "direct";
        appendBubble("assistant", "Va. Escribe tu pregunta 🙂");
        input.focus();
        return;
      }

      if (s === "__back__") {
        // vuelve al inicio siempre
        showStart();
        return;
      }

      if (s.startsWith("__open__:")) {
        const url = s.replace("__open__:", "").trim();
        if (url) window.open(url, "_blank", "noopener,noreferrer");
        return;
      }

      if (/^__ctx__:/i.test(s)) {
        const next = s.split(":")[1]?.trim() || "inicio";
        currentContext = next;
        localStorage.setItem(CONTEXT_KEY, currentContext);

        appendBubble("assistant", `Tema: ${currentContext.toUpperCase()}.`);
        showContextGuide(currentContext);
        input.focus();
        return;
      }

      // Si no fue comando, es pregunta “prellenada”: la mandamos como si el usuario la escribió
      internalSend(s, { showUser: true });
    }

    // ======= Worker call =======
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
            context: currentContext,
            session_id,
            page_url: location.href
          })
        });

        const data = await r.json().catch(() => ({}));
        typing.remove();

        // respeta contexto del worker si llega
        if (typeof data?.context === "string" && data.context.trim()) {
          currentContext = data.context.trim();
          localStorage.setItem(CONTEXT_KEY, currentContext);
        }

        const reply = pickReply(data);
        const actions = pickActions(data);
        const suggestedFromWorker = pickSuggestedButtons(data);

        if (!reply) {
          appendBubble("assistant", "No pude responder. Intenta con otra pregunta.");
          showContextGuide(currentContext);
          return;
        }

        appendBubble("assistant", reply);
        history.push({ role: "assistant", content: reply });

        if (data?.needs_human === true) {
          appendHumanEscalation(actions);
          return;
        }

        // SIEMPRE guía: mezcla sugerencias del worker + KB local
        const localButtons = kbButtonsForContext(currentContext);
        const merged = mergeButtons(suggestedFromWorker, localButtons, 8);
        appendButtonsRow(merged);

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
      showStart();

      // Si había un contexto guardado y NO es inicio, guía
      if (currentContext && currentContext !== "inicio") {
        appendBubble("assistant", `Continuamos en: ${currentContext.toUpperCase()}.`);
        showContextGuide(currentContext);
      }
    })();
  });
})();
