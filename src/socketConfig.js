const actionEnum = {
  JOIN_ROOM: "join_room",
  USER_JOINED: "user_joined",
  USER_LEFT: "user_left",
  MESSAGE: "message",
  LEAVE_ROOM: "leave_room",
};

const mountJoinRoomEvent = (io, socket) => {
  socket.on(actionEnum.JOIN_ROOM, (payload) => {
    console.log(`User: ${socket.id} joined Room: ${payload.roomId}`);

    socket.join(payload.roomId);

    io.to(payload.roomId).emit(actionEnum.USER_JOINED, payload.userId);
  });
};

const mountPeerMessageEvent = (io, socket) => {
  socket.on(actionEnum.MESSAGE, (payload) => {
    socket.to(payload.roomId).emit(actionEnum.MESSAGE, payload);
  });
};

const initSocketIO = (io) => {
  io.on("connection", (socket) => {
    console.log("User Connected 🎉 -> user id: ", socket.id);

    mountJoinRoomEvent(io, socket);
    mountPeerMessageEvent(io, socket);

    socket.on(actionEnum.LEAVE_ROOM, (roomId) => {
      console.log(`User: ${socket.id} left Room: ${roomId}`);
      socket.leave(roomId);

      socket.to(roomId).emit(actionEnum.USER_LEFT, socket.id);
    });
    // On use disconnect:
    socket.on("disconnect", () => {
      console.log("User has disconnected 💥 -> user id: ", socket.id);
      socket.leave(socket.id);
    });
  });
};

const emitSocketEvent = (req, roomId, event, payload) => {
  req.app.get("io").to(roomId).emit(event, payload);
};

export { initSocketIO, emitSocketEvent };
