// =====================================================================
// Widget live chat yang bisa dipasang di halaman manapun.
// Cukup panggil initChatWidget() setelah DOM siap.
// =====================================================================
import { getCurrentUser } from "./auth.js";
import { kirimChatCustomer, ambilRiwayatChat, dengarkanChatCustomer } from "./liveChat.js";

export async function initChatWidget() {
  const wrapper = document.createElement("div");
  wrapper.id = "live-chat-widget";
  wrapper.innerHTML = `
    <button id="chat-toggle">💬 Chat Admin</button>
    <div id="chat-box" hidden>
      <div id="chat-messages"></div>
      <form id="chat-form">
        <input id="chat-input" type="text" placeholder="Tulis pesan..." required />
        <button type="submit">Kirim</button>
      </form>
    </div>
  `;
  document.body.appendChild(wrapper);

  const user = await getCurrentUser();
  const toggleBtn = document.getElementById("chat-toggle");
  const chatBox = document.getElementById("chat-box");
  const messagesEl = document.getElementById("chat-messages");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");

  if (!user) {
    toggleBtn.addEventListener("click", () => {
      if (confirm("Silakan login dulu untuk chat dengan admin. Buka halaman login sekarang?")) {
        const prefix = location.pathname.includes("/admin/") ? "../login.html" : "login.html";
        location.href = prefix;
      }
    });
    return;
  }

  const sessionId = localStorage.getItem("chat_session_id") || crypto.randomUUID();
  localStorage.setItem("chat_session_id", sessionId);

  function renderPesan(msg) {
    const bubble = document.createElement("div");
    bubble.className = `bubble ${msg.pengirim}`;
    bubble.textContent = msg.pesan;
    messagesEl.appendChild(bubble);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  toggleBtn.addEventListener("click", async () => {
    chatBox.hidden = !chatBox.hidden;
    if (!chatBox.hidden && messagesEl.childElementCount === 0) {
      const riwayat = await ambilRiwayatChat({ userId: user.id, sessionId });
      riwayat.forEach(renderPesan);
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const pesan = input.value.trim();
    if (!pesan) return;
    input.value = "";
    await kirimChatCustomer({ userId: user.id, sessionId, pesan });
  });

  dengarkanChatCustomer(user.id, renderPesan);
}