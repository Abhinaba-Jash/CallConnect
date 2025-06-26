document.addEventListener("DOMContentLoaded", async () => {
  const socket = io();
  const status = document.getElementById("status");
  const remVidCont = document.getElementById("remote-video-container");
  // Extract targetUserId (callee) from URL query string
  const queryParams = new URLSearchParams(window.location.search);
  const targetUserId = queryParams.get("userId");

  // Get current userId (caller) from localStorage
  const myUserId = localStorage.getItem("userId");
  const myToken = localStorage.getItem("userAuthId");

  if (!myUserId || !targetUserId) {
    alert("Missing required user info.");
    return;
  }

  const localVideo = document.getElementById("localVideo");
  const remoteVideo = document.getElementById("remoteVideo");

  let localStream;
  let peerConnection;
  const config = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    iceTransportPolicy: "all", // not "relay"
  };

  // ✅ Wait for media access
  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });
  localVideo.srcObject = localStream;
  const userId = localStorage.getItem("userAuthId");
  const currentUserId = localStorage.getItem("userId");
  if (userId) {
    socket.emit("register", { userId, currentUserId });
  }

  socket.emit("initiate-call", { toUserId: targetUserId });

  socket.on("user-joined", ({ socketId }) => {
    peerConnection = createPeerConnection(socketId);

    addLocalTracks(peerConnection); // ✅ add tracks first

    // ✅ Only now create the offer
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
    if (!peerConnection) {
      peerConnection = createPeerConnection(data.from, false);
      addLocalTracks(peerConnection);
    }

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
      remoteVideo.srcObject = event.streams[0];
      remVidCont.classList.remove("hidden");
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
  // Button references
  const muteAudioBtn = document.getElementById("toggleAudioBtn");
  const muteVideoBtn = document.getElementById("toggleVideoBtn");
  const endCallBtn = document.getElementById("endCallBtn");

  let isAudioMuted = false;
  let isVideoMuted = false;

  muteAudioBtn.addEventListener("click", () => {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      isAudioMuted = !isAudioMuted;
      audioTrack.enabled = !isAudioMuted;
      muteAudioBtn.innerHTML = isAudioMuted
        ? `<i class="bi bi-mic-mute-fill text-xl"></i>`
        : `<i class="bi bi-mic-fill text-xl"></i>`;
    }
  });

  muteVideoBtn.addEventListener("click", () => {
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      isVideoMuted = !isVideoMuted;
      videoTrack.enabled = !isVideoMuted;
      muteVideoBtn.innerHTML = isVideoMuted
        ? `<i class="bi bi-camera-video-off-fill text-xl"></i>`
        : `<i class="bi bi-camera-video-fill text-xl"></i>`;
    }
  });

  endCallBtn.addEventListener("click", async () => {
    // Stop local stream
    localStream.getTracks().forEach((track) => track.stop());

    // Close connection
    if (peerConnection) peerConnection.close();

    // Emit call-ended to notify the other peer
    socket.emit("call-ended", {from:localStorage.getItem("userId"), to: targetUserId, callType: "video" });

    // Redirect to dashboard after a short delay
    status.innerText = "Call ended";
    status.classList.remove("text-green-600", "text-blue-400");
    status.classList.add("text-red-500");
    setTimeout(async () => {
      const res = await fetch(`/api/call/video?userId=${targetUserId}`);
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
