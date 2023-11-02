let localStream;
let remoteStream;
let peerConnection;

// Socket:
const socket = io();

const queryParmas = new URLSearchParams(window.location.search);
let roomId =
  queryParmas.get("roomId") ||
  Math.floor(Math.random() * 899999 + 100000).toString();

// Add the query paramater to the url:
window.history.pushState({}, "", `?roomId=${roomId}`);

const actionEnum = {
  JOIN_ROOM: "join_room",
  USER_JOINED: "user_joined",
  USER_LEFT: "user_left",
  MESSAGE: "message",
  LEAVE_ROOM: "leave_room",
};

// STUN servers:
const servers = {
  iceServers: [
    {
      urls: [
        // "stun:stun1.l.google.com:19302",
        // "stun:stun2.l.google.com:19302",
        "stun:stun3.l.google.com:19302",
        "stun:stun4.l.google.com:19302",
      ],
    },
  ],
};

// Init the app:
const init = async () => {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
  } catch (err) {
    console.log(err);
  }

  document.getElementById("user-1").srcObject = localStream;
  console.log("My Id: ", socket.id);
  // Join a room:
  socket.emit("join_room", { roomId, userId: socket.id });

  // on New User joined:
  socket.on(actionEnum.USER_JOINED, handleUserJoined);

  // On peer message:
  socket.on(actionEnum.MESSAGE, handlePeerMessage);

  // On user left:
  socket.on(actionEnum.USER_LEFT, handleUserLeft);
};
// Handel Peer Message:
const handlePeerMessage = (message) => {
  if (message.type == "offer") {
    console.log(message);
    // Create Answer:
    createAnswer(message.userId, message.offer);
  }

  if (message.type == "answer") {
    console.log(message);
    // Add Answer:
    addAnswer(message.answer);
  }

  if (message.type == "candidate") {
    if (peerConnection) {
      // console.log("Received ICE: ", message.candidate);
      peerConnection.addIceCandidate(message.candidate);
    }
  }
};
// Handle User Joined:
const handleUserJoined = (userId) => {
  if (socket.id === userId) return;
  console.log("User Joined: ", userId);
  createOffer(userId);
};

// Handle User Left:
const handleUserLeft = (userId) => {
  console.log("User Left: ", userId);
  document.getElementById("user-2").style.display = "none";
  document.getElementById("user-1").classList.remove("smallFrame");
};

// Create Peer Connection:
const createPeerConnection = async (userId) => {
  peerConnection = new RTCPeerConnection(servers);

  if (!localStream) {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
    } catch (err) {
      console.log(err);
    }
  }

  // Add local tracks to peer connection:
  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  // Add remote peer stream to the user 2:
  remoteStream = new MediaStream();
  document.getElementById("user-2").srcObject = remoteStream;
  document.getElementById("user-2").style.display = "block";

  document.getElementById("user-1").classList.add("smallFrame");

  //   Event listner for remote peers when they add tracks:
  peerConnection.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      // console.log(track);
      remoteStream.addTrack(track);
    });
  };

  //   Event listener for local ICE candiates
  peerConnection.onicecandidate = async (event) => {
    if (event.candidate) {
      // console.log("Sent ICE: ", event.candidate);
      socket.emit(actionEnum.MESSAGE, {
        type: "candidate",
        candidate: event.candidate,
        userId,
        roomId,
      });
    }
  };
};

// Create a offer:
const createOffer = async (userId) => {
  await createPeerConnection(userId);
  //   Create connection offer:
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  // console.log("Offer: ", offer);
  socket.emit(actionEnum.MESSAGE, {
    type: "offer",
    offer,
    userId,
    roomId,
  });
};

// Create Answer:
const createAnswer = async (userId, offer) => {
  await createPeerConnection(userId);

  await peerConnection.setRemoteDescription(offer);

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  // console.log("Answer: ", answer);
  socket.emit(actionEnum.MESSAGE, {
    type: "answer",
    answer,
    userId,
    roomId,
  });
};

// Add answer to remote desc:
const addAnswer = async (answer) => {
  if (!peerConnection.currentRemoteDescription) {
    // console.log("Received Answer: ", answer);
    await peerConnection.setRemoteDescription(answer);
  }
};

// Leave socket:
const leaveCall = async () => {
  socket.emit(actionEnum.LEAVE_ROOM, roomId);
  peerConnection.close();
  window.location.href = "/";
};

let toggleCamera = async () => {
  let videoTrack = localStream
    .getTracks()
    .find((track) => track.kind === "video");

  if (videoTrack.enabled) {
    videoTrack.enabled = false;
    document.getElementById("camera-btn").style.backgroundColor =
      "rgb(255, 80, 80)";
  } else {
    videoTrack.enabled = true;
    document.getElementById("camera-btn").style.backgroundColor =
      "rgb(179, 102, 249, .9)";
  }
};

let toggleMic = async () => {
  let audioTrack = localStream
    .getTracks()
    .find((track) => track.kind === "audio");

  if (audioTrack.enabled) {
    audioTrack.enabled = false;
    document.getElementById("mic-btn").style.backgroundColor =
      "rgb(255, 80, 80)";
  } else {
    audioTrack.enabled = true;
    document.getElementById("mic-btn").style.backgroundColor =
      "rgb(179, 102, 249, .9)";
  }
};

window.addEventListener("beforeunload", leaveCall);

document.getElementById("camera-btn").addEventListener("click", toggleCamera);
document.getElementById("mic-btn").addEventListener("click", toggleMic);
document.getElementById("leave-btn").addEventListener("click", leaveCall);

init();
