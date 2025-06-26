document.addEventListener("DOMContentLoaded", async () => {
  const socket = io();
  const notificationSound = new Audio("/assets/notification.wav");

  const userList = document.getElementById("userList");
  const callHistoryList = document.getElementById("callHistoryList");
  const userName = document.getElementById("username");
  userList.className = "flex flex-col gap-4";
  callHistoryList.className = "flex flex-col gap-4";
  const params = new URLSearchParams(window.location.search);
  const userId = localStorage.getItem("userAuthId");
  const currentUserId = localStorage.getItem("userId");
  if (!userId) {
    window.location.href = "/api/auth/login";
    return;
  }
  if (userId) {
    socket.emit("register", { userId, currentUserId });
  }
  try {
    const res = await fetch(`/api/dashboard/data?userId=${userId}`);
    const data = await res.json();
    if (!res.ok) throw new Error("Failed to load dashboard data");

    const { users, callHistory, currentUserName } = data;
    userName.innerText = currentUserName.name + " (You)";
    // 🟢 Render Online Users
    if (users.length === 0) {
      const text = document.createElement("span");
      text.innerText = "No user is online currently(try later).";
      userList.appendChild(text);
    } else {
      users.forEach((user) => {
        const li = document.createElement("li");
        li.className =
          "list-group-item flex justify-between align-items-center";

        const nameSpan = document.createElement("span");
        nameSpan.textContent = user.name;
        const chatBtn = document.createElement("a");
        chatBtn.innerHTML =
          '<i class="bi bi-chat-dots-fill text-primary fs-5"></i>';
        chatBtn.title = "Chat";
        chatBtn.className = "btn btn-link hover:cursor-pointer";
        chatBtn.addEventListener("click", () =>
          startCall("chat", user._id, user.name)
        );

        const videoBtn = document.createElement("a");
        videoBtn.innerHTML =
          '<i class="bi bi-camera-video-fill text-success fs-5"></i>';
        videoBtn.title = "Start Video Call";
        videoBtn.className = "btn btn-link hover:cursor-pointer";
        videoBtn.addEventListener("click", () =>
          startCall("video", user._id, user.name)
        );

        const audioBtn = document.createElement("a");
        audioBtn.innerHTML =
          '<i class="bi bi-telephone-fill text-primary fs-5"></i>';
        audioBtn.title = "Start Audio Call";
        audioBtn.className = "btn btn-link hover:cursor-pointer";
        audioBtn.onclick = () => startCall("audio", user._id, user.name);
        const btnGroup = document.createElement("div");
        btnGroup.className = "flex gap-4 items-center";
        btnGroup.appendChild(chatBtn);
        btnGroup.appendChild(videoBtn);
        btnGroup.appendChild(audioBtn);

        li.appendChild(nameSpan);
        li.appendChild(btnGroup);
        userList.appendChild(li);
      });
    }
    // 📞 Render Call History
    if (callHistory.length === 0) {
      const text = document.createElement("span");
      text.innerText = "Nothing to show.";
      callHistoryList.appendChild(text);
    } else {
      callHistory.forEach((call) => {
        const li = document.createElement("li");
        li.className = "list-group-item";
        const time = new Date(call.startedAt).toLocaleString();
        const type = call.callType === "audio" ? "Audio Call" : "Video Call";
        const caller = call.callerId ? call.callerId : "Unknown";
        const receiver = call.calleeId ? call.calleeId : "Unknown";
        li.innerHTML = `
        <div>
          <strong>${type}:</strong> Between 
          <span class="text-info">${caller.name}</span> and 
          <span class="text-info">${receiver.name}</span> 
          <div class="text-muted small">${time}</div>
        </div>
      `;
        callHistoryList.appendChild(li);
      });
    }
  } catch (err) {
    console.error("Dashboard Error:", err);
    alert("Could not load dashboard.");
  }
  function startCall(type, targetUserId, username) {
    if (type == "audio") {
      socket.emit("notify_user", {
        type: type,
        fromUserId: currentUserId,
        toUserId: targetUserId,
        fromUsername: username,
      });

      setTimeout(() => {
        window.location.href = `/api/call/audio?userId=${targetUserId}`;
      }, 500);
    } else if (type == "video") {
      socket.emit("notify_user", {
        type: type, // or "call"
        fromUserId: currentUserId,
        toUserId: targetUserId,
        fromUsername: username,
      });
      // Then redirect after short delay or immediately
      setTimeout(() => {
        window.location.href = `/api/call/video?userId=${targetUserId}`;
      }, 500);
    } else if (type == "chat") {
      socket.emit("notify_user", {
        type: type, // or "call"
        fromUserId: currentUserId,
        toUserId: targetUserId,
        fromUsername: username,
      });
      setTimeout(() => {
        window.location.href = `/api/chat?userId=${targetUserId}`;
      }, 500);
    }
  }
  const logout = document.getElementById("logoutBtn");

  logout.addEventListener("click", async () => {
    const userId = localStorage.getItem("userId");

    if (userId) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
      } catch (err) {
        console.error("Logout failed", err);
      }

      localStorage.removeItem("userId");
      localStorage.removeItem("userAuthId");
      window.location.href = "/api/auth/login";
    }
  });
  socket.on("incoming_notification", ({ type, fromUserId, fromUsername }) => {
    // Play sound
    notificationSound.play().catch((err) => {
      console.warn(
        "Autoplay prevented, playing on user interaction:",
        err.message
      );
    });
    showNotification(type, fromUserId, fromUsername);
  });

  function showNotification(type, fromUserId, fromUsername) {
    const popup = document.getElementById("notification-popup");
    const text = document.getElementById("notification-text");
    const acceptBtn = document.getElementById("accept-btn");
    const dismissBtn = document.getElementById("dismiss-btn");
    let textVal;
    let url;
    if (type == "video") {
      textVal = "start a video call";
      url = `/api/call/video?userId=${fromUserId}`;
    } else if (type == "audio") {
      textVal = "start a audio call";
      url = `/api/call/audio?userId=${fromUserId}`;
    } else {
      textVal = "chat";
      url = `/api/chat?userId=${fromUserId}`;
    }
    text.textContent = `${fromUsername} wants to ${textVal} with you`;

    popup.classList.remove("hidden");

    acceptBtn.onclick = () => {
      popup.classList.add("hidden");
      window.location.href = url;
    };

    dismissBtn.onclick = () => {
      popup.classList.add("hidden");
    };
  }
});
