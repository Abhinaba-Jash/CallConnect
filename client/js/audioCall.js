document.addEventListener("DOMContentLoaded", async () => {
  const socket = io();
  const status = document.getElementById("status");
  const queryParams = new URLSearchParams(window.location.search);
  const targetUserId = queryParams.get("userId");
  const myUserId = localStorage.getItem("userId");
  const remoteAudioWrapper = document.getElementById("remoteAudioWrapper");
  const myToken = localStorage.getItem("userAuthId");
  if (!myUserId || !targetUserId) {
    alert("Missing user information.");
    return;
  }

  const localAudio = document.getElementById("localAudio");
  const remoteAudio = document.getElementById("remoteAudio");

  let localStream;
  let peerConnection;
  const config = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    iceTransportPolicy: "all",
  };

  // Get microphone only
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  localAudio.srcObject = localStream;

  const userId = localStorage.getItem("userAuthId");
  const currentUserId = localStorage.getItem("userId");
  if (userId) {
    socket.emit("register", { userId, currentUserId });
  }
  socket.emit("initiate-call", { toUserId: targetUserId });

  socket.on("user-joined", ({ socketId }) => {
    peerConnection = createPeerConnection(socketId);
    addLocalTracks(peerConnection);

    peerConnection
      .createOffer()
      .then((offer) => {
        return peerConnection.setLocalDescription(offer);
      })
      .then(() => {
        socket.emit("offer", {
          to: socketId,
          offer: peerConnection.localDescription,
          from: socket.id,
        });
      })
      .catch((err) => console.error("Error creating offer", err));
  });

  socket.on("offer", async (data) => {

    peerConnection = createPeerConnection(data.from);
    addLocalTracks(peerConnection);

    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(data.offer)
    );

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit("answer", { to: data.from, answer });
  });

  socket.on("answer", async (data) => {
    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(data.answer)
    );
  });

  socket.on("ice-candidate", async (data) => {
    if (data.candidate && peerConnection) {
      try {
        await peerConnection.addIceCandidate(
          new RTCIceCandidate(data.candidate)
        );
      } catch (err) {
        console.error("Failed to add ICE candidate", err);
      }
    }
  });
  socket.on("call-ended", () => {
    // Stop stream
    if (localStream) localStream.getTracks().forEach((track) => track.stop());
    if (peerConnection) peerConnection.close();

    status.innerText = "Call ended from another side";
    status.classList.remove("text-green-600", "text-blue-400");
    status.classList.add("text-red-500");

    setTimeout(() => {
      window.location.href = `/api/dashboard?userId=${myToken}`;
    }, 1000);
  });
  function addLocalTracks(pc) {
    if (localStream && pc) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
    }
  }

  function createPeerConnection(to) {
    const pc = new RTCPeerConnection(config);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", { to, candidate: event.candidate });
      } else {
        console.log("All ICE candidates sent");
      }
    };

    pc.ontrack = (event) => {
      remoteAudio.srcObject = event.streams[0];
      remoteAudioWrapper.classList.remove("hidden");
      status.innerText = "Connected";
      status.classList.add("text-green-600");
    };

    pc.onicegatheringstatechange = () => {
      console.log("ICE gathering state:", pc.iceGatheringState);
    };

    pc.onconnectionstatechange = () => {
      console.log("Connection state:", pc.connectionState);
    };

    return pc;
  }
  const muteAudioBtn = document.getElementById("toggleAudioBtn");
  const endCallBtn = document.getElementById("endCallBtn");
  // 🔇 Mute toggle logic
  let isAudioMuted = false;
  muteAudioBtn.addEventListener("click", () => {
    const track = localStream.getAudioTracks()[0];
    if (track) {
      isAudioMuted = !isAudioMuted;
      track.enabled = !isAudioMuted;
      muteAudioBtn.innerHTML = isAudioMuted
        ? `<i class="bi bi-mic-mute-fill text-xl"></i>`
        : `<i class="bi bi-mic-fill text-xl"></i>`;
    }
  });

  // ❌ End call logic
  endCallBtn.addEventListener("click", () => {
    // Stop local stream
    localStream.getTracks().forEach((track) => track.stop());

    // Close connection
    if (peerConnection) peerConnection.close();

    // Emit call-ended to notify the other peer
    socket.emit("call-ended", { from: localStorage.getItem("userId"), to: targetUserId, callType: "audio" });

    // Redirect to dashboard after a short delay
    status.innerText = "Call ended";
    status.classList.remove("text-green-600", "text-blue-400");
    status.classList.add("text-red-500");
    setTimeout(async () => {
      const res = await fetch(`/api/call/audio?userId=${targetUserId}`);
      if (res.ok) {
        window.location.href = `/api/dashboard?userId=${localStorage.getItem(
          "userAuthId"
        )}`;
      } else {
        alert(result.message || "Redirection failed!");
      }
    }, 1000);
  });
});
