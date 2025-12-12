// chatbot.js
const WORKER_URL = "https://TU-WORKER.tu-subdominio.workers.dev/chat";

const launcher = document.getElementById("idappsh-chat-launcher");
const panel = document.getElementById("idappsh-chat-panel");
const closeBtn = document.getElementById("idappsh-chat-close");

const msgList = document.getElementById("idappsh-chat-messages");
const input = document.getElementById("idappsh-chat-input");
const sendBtn = document.getElementById("idappsh-chat-send");

let history = []; // [{role, content}...]

// Abrir/cerrar
launcher?.addEventListener("click", (e) => {
  e.stopPropagation();
  panel.classList.toggle("open");
  setTimeout(() => input?.focus(), 50);
});

closeBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  panel.classList.remove("open");
});

// IMPORTANTÍSIMO: clicks dentro NO deben burbujear al document
panel?.addEventListener("click", (e) => e.stopPropagation());

// Click fuera cierra
document.addEventListener("click", () => {
  if (panel.classList.contains("open")) panel.classList.remove("open");
});

// Enviar con Enter
input?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

sendBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  sendMessage();
});

function appendBubble(role, text) {
  const div = document.createElement("div");
  div.className = "msg " + role; // (tus estilos)
  div.textContent = text;
  msgList.appendChild(div);
  msgList.scrollTop = msgList.scrollHeight;
  return div;
}

function appendHelpfulButtons(botBubble, actions) {
  const row = document.createElement("div");
  row.className = "help-row";

  const q = document.createElement("div");
  q.className = "help-q";
  q.textContent = "¿Te ayudó esta respuesta?";
  row.appendChild(q);

  const yes = document.createElement("button");
  yes.className = "help-btn yes";
  yes.textContent = "Sí ✅";
  yes.onclick = () => {
    row.remove();
    appendBubble("assistant", "Perfecto. ¿Qué más necesitas?");
  };

  const no = document.createElement("button");
  no.className = "help-btn no";
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

function appendHumanEscalation(actions = []) {
  appendBubble("assistant", "Va. ¿Quieres asistencia humana? Elige un canal:");

  const wrap = document.createElement("div");
  wrap.className = "action-row";

  (actions || []).forEach(a => {
    const btn = document.createElement("a");
    btn.className = "action-btn";
    btn.href = a.url;
    btn.target = "_blank";
    btn.rel = "noopener noreferrer";
    btn.textContent = a.label || a.type;
    wrap.appendChild(btn);
  });

  msgList.appendChild(wrap);
  msgList.scrollTop = msgList.scrollHeight;
}

async function sendMessage() {
  const text = (input.value || "").trim();
  if (!text) return;

  appendBubble("user", text);
  history.push({ role: "user", content: text });
  input.value = "";

  // indicador
  const typing = appendBubble("assistant", "Escribiendo…");

  try {
    const r = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, history })
    });

    const data = await r.json();
    typing.remove();

    if (!data.ok) {
      appendBubble("assistant", "No pude responder. ¿Quieres asistencia humana?");
      appendHumanEscalation([
        { label: "WhatsApp", url: "https://wa.me/526633905025" },
        { label: "Telegram", url: "https://t.me/r_alameda" }
      ]);
      return;
    }

    appendBubble("assistant", data.reply || "Listo.");
    history.push({ role: "assistant", content: data.reply || "" });

    // Botones inteligentes
    if (data.needs_human) {
      appendHumanEscalation(data.quick_actions);
    } else {
      // “¿Te ayudó?”
      appendHelpfulButtons(null, data.quick_actions);
    }

  } catch (e) {
    typing.remove();
    appendBubble("assistant", "Error de conexión. ¿Quieres asistencia humana?");
    appendHumanEscalation([
      { label: "WhatsApp", url: "https://wa.me/526633905025" },
      { label: "Telegram", url: "https://t.me/r_alameda" }
    ]);
  }
}
