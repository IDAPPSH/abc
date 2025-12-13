(() => {
  if (window.__IDAPPSH_CHATBOT_INIT__) return;
  window.__IDAPPSH_CHATBOT_INIT__ = true;

  const WORKER_URL = "https://idappsh-ia.idappsh.workers.dev/chat";

  document.addEventListener("DOMContentLoaded", () => {
    const launcher = document.getElementById("idappsh-chat-launcher");
    const panel = document.getElementById("idappsh-chat-panel");
    const closeBtn = document.getElementById("idappsh-chat-close");

    const msgList = document.getElementById("idappsh-chat-messages");
    const input = document.getElementById("idappsh-chat-input");
    const sendBtn = document.getElementById("idappsh-chat-send");

    // Si falta algo: imprime EXACTAMENTE qué falta
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

    // ======= “PRESENCIA” (tu nudge cada 3s) =======
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

      // NUDGE
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

    function appendHumanEscalation(actions = []) {
      appendBubble("assistant", "Va. ¿Quieres asistencia humana? Elige un canal:");

      const wrap = document.createElement("div");
      wrap.className = "action-row";

      (actions || []).forEach(a => {
        if (!a?.url) return;
        const btn = document.createElement("a");
        btn.className = "action-btn";
        btn.href = a.url;
        btn.target = "_blank";
        btn.rel = "noopener noreferrer";
        btn.textContent = a.label || "Abrir";
        wrap.appendChild(btn);
      });

      // si vino vacío, mete defaults
      if (!wrap.childNodes.length) {
        const wa = document.createElement("a");
        wa.className = "action-btn";
        wa.href = "https://wa.me/526633905025";
        wa.target = "_blank";
        wa.rel = "noopener noreferrer";
        wa.textContent = "WhatsApp";
        wrap.appendChild(wa);

        const tg = document.createElement("a");
        tg.className = "action-btn";
        tg.href = "https://t.me/r_alameda";
        tg.target = "_blank";
        tg.rel = "noopener noreferrer";
        tg.textContent = "Telegram";
        wrap.appendChild(tg);
      }

      msgList.appendChild(wrap);
      msgList.scrollTop = msgList.scrollHeight;
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
        appendHumanEscalation(actions);
      };

      row.appendChild(yes);
      row.appendChild(no);
      msgList.appendChild(row);
      msgList.scrollTop = msgList.scrollHeight;
    }

    function pickReply(data) {
      return (data?.reply ?? data?.message ?? data?.text ?? data?.answer ?? "").toString().trim();
    }

    function pickActions(data) {
      const qa = data?.quick_actions;
      return Array.isArray(qa) ? qa : [];
    }

    // ======= Worker call =======
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
          body: JSON.stringify({ message: text, history })
        });

        const data = await r.json();
        typing.remove();

        const reply = pickReply(data);
        const actions = pickActions(data);

        if (!reply) {
          appendBubble("assistant", "No pude responder. ¿Quieres asistencia humana?");
          appendHumanEscalation(actions);
          return;
        }

        appendBubble("assistant", reply);
        history.push({ role: "assistant", content: reply });

        if (data?.needs_human === true) appendHumanEscalation(actions);
        else appendHelpfulButtons(actions);

      } catch (e) {
        typing.remove();
        appendBubble("assistant", "Error de conexión. ¿Quieres asistencia humana?");
        appendHumanEscalation([
          { label: "WhatsApp", url: "https://wa.me/526633905025" },
          { label: "Telegram", url: "https://t.me/r_alameda" }
        ]);
      }
    }

    // Mensaje inicial
    appendBubble("assistant", "Qué onda 👋 Soy IDAPPSH IA. ¿Qué necesitas?");
    appendHelpfulButtons([
      { label: "WhatsApp", url: "https://wa.me/526633905025" },
      { label: "Telegram", url: "https://t.me/r_alameda" }
    ]);
  });
})();
