document.addEventListener("DOMContentLoaded", async () => {
  const socket = io();

  const queryParams = new URLSearchParams(window.location.search);
  const targetUserId = queryParams.get("userId");
  const userId = localStorage.getItem("userAuthId");
  const currentUserId = localStorage.getItem("userId");
  const chatBox = document.getElementById("chat-box");
  const chatForm = document.getElementById("chat-form");
  const messageInput = document.getElementById("message-input");
  
  function formatTimestamp(timestamp = new Date()) {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (userId) {
    socket.emit("register", { userId, currentUserId });
  }

  // ✅ Load chat history
  const loadChatHistory = async () => {
    try {
      const res = await fetch(`/api/chat/${targetUserId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("userAuthId")}`,
        },
      });
      const messages = await res.json();
      chatBox.innerHTML = ""; // clear box before loading
      messages.forEach((msg) => {
        const messageDiv = document.createElement("div");
        const isSentByMe = msg.senderId === currentUserId;

        messageDiv.className = `flex ${
          isSentByMe ? "justify-end" : "justify-start"
        }`;
        messageDiv.innerHTML = `
          <div class="${
            isSentByMe ? "bg-blue-600 text-white" : "bg-gray-700 text-white"
          } rounded-xl px-4 py-2 max-w-xs ${isSentByMe ? "text-right" : ""}">
            <div class="text-sm">${msg.message}</div>
            <div class="text-xs text-gray-300 mt-1">${formatTimestamp(
              msg.timestamp
            )}</div>
          </div>
        `;
        chatBox.appendChild(messageDiv);
      });

      chatBox.scrollTop = chatBox.scrollHeight;
    } catch (err) {
      console.error("Error loading chat history:", err);
    }
  };

  await loadChatHistory();

  // 📩 Handle incoming real-time messages
  socket.on("private_message", ({ from, to, message }) => {
    const timestamp = formatTimestamp();
    const msg = document.createElement("div");
    msg.className = "flex justify-start";
    msg.innerHTML = `
      <div class="bg-gray-700 text-white rounded-xl px-4 py-2 max-w-xs">
        <div class="text-sm">${message}</div>
        <div class="text-xs text-gray-400 text-right mt-1">${timestamp}</div>
      </div>
    `;
    chatBox.appendChild(msg);
    chatBox.scrollTop = chatBox.scrollHeight;
  });

  // 📨 Send message
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = messageInput.value.trim();
    if (!message) return;

    const timestamp = formatTimestamp();

    // Emit via socket
    socket.emit("private_message", {
      from: currentUserId,
      to: targetUserId,
      message,
    });

    // Save message to DB
    await fetch(`/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("userAuthId")}`, // optional
      },
      body: JSON.stringify({
        senderId: currentUserId,
        receiverId: targetUserId,
        message,
      }),
    });

    // Append to chat box
    const msg = document.createElement("div");
    msg.className = "flex justify-end";
    msg.innerHTML = `
      <div class="bg-blue-600 text-white rounded-xl px-4 py-2 max-w-xs text-right">
        <div class="text-sm">${message}</div>
        <div class="text-xs text-blue-200 mt-1">${timestamp}</div>
      </div>
    `;
    chatBox.appendChild(msg);
    chatBox.scrollTop = chatBox.scrollHeight;
    messageInput.value = "";
  });

  const backBtn = document.getElementById("backBtn");
  backBtn.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = `/api/dashboard?userId=${localStorage.getItem(
      "userAuthId"
    )}`;
  });
  const chatDelBtn = document.getElementById("delete-chathistory-btn");
  chatDelBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    const confirmDelete = confirm(
      "Are you sure you want to delete all call history?"
    );
    if (!confirmDelete) return;

    try {
      const response = await fetch("/api/chat/clear", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("userAuthId")}`,
        },
      });

      const result = await response.json();

      if (response.ok) {
        alert("Chat history cleared successfully.");
        window.location.reload();
      } else {
        alert(result.message || "Failed to delete chat history.");
      }
    } catch (err) {
      console.error("Error deleting chat history:", err);
      alert("An error occurred while deleting.");
    }
  });
});
