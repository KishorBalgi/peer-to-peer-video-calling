let localStream;
let remoteStream;
let peerConnection;

// Holistics:
// Load the Holistic model from MediaPipe
const holistic = new Holistic({
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`;
  },
});
holistic.setOptions({ smoothLandmarks: true });

// Load the pre-trained TensorFlow.js model
async function loadModel() {
  return await tf.loadGraphModel(
    "https://tensorflow-model-1.onrender.com/model.json"
  );
}

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
  // Load the TensorFlow.js model
  const model = await loadModel();
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
  } catch (err) {
    console.log(err);
  }

  document.getElementById("user-1").srcObject = localStream;
  document.getElementById("user-1").setAttribute("muted", true);
  console.log("My Id: ", socket.id);
  // Join a room:
  socket.emit("join_room", { roomId, userId: socket.id });

  // Process each video frame and render the results
  const videoElement = document.getElementById("user-1");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  videoElement.addEventListener("loadedmetadata", async () => {
    setInterval(async () => {
      if (!videoElement.paused && !videoElement.ended) {
        // Process a single video frame
        await processFrame(videoElement, model, ctx);
      }
    }, 5000);
  });

  // on New User joined:
  socket.on(actionEnum.USER_JOINED, handleUserJoined);

  // On peer message:
  socket.on(actionEnum.MESSAGE, handlePeerMessage);

  // On user left:
  socket.on(actionEnum.USER_LEFT, handleUserLeft);
};

// Process a single video frame
async function processFrame(video, model, ctx) {
  // Capture a frame from the video
  ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
  const imageData = ctx.getImageData(0, 0, video.videoWidth, video.videoHeight);

  // Prepare input data for the model
  const inputData = preprocess(imageData);

  // Perform inference using the loaded TensorFlow.js model
  const output = model.predict(inputData);

  // Render the results on the canvas or in any desired way
  renderResults(output, ctx);
}

// Preprocess the input data (e.g., normalize the pixel values)
function preprocess(imageData) {
  // Convert the image data to a TensorFlow.js tensor
  const inputTensor = tf.browser.fromPixels(imageData);

  // Resize the input tensor to match the input shape expected by the model
  const resizedInputTensor = tf.image.resizeBilinear(inputTensor, [1, -1]);

  // Normalize the pixel values to be in the range [0, 1]
  const normalizedInputTensor = resizedInputTensor.div(tf.scalar(255));

  return normalizedInputTensor;
}

// Render the results on the canvas or in any desired way
function renderResults(output, ctx) {
  // Convert the output tensor to a JavaScript array
  const outputData = output.arraySync();

  // Render the output of the model on the canvas
  // For example, you can draw bounding boxes, keypoints, or any other visualizations based on the output
  // Here's a simple example of drawing a bounding box:
  const [x, y, width, height] = outputData;
  ctx.strokeStyle = "red";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, height);

  // Free up the memory used by the tensors

  output.dispose();
}

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
