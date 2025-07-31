const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*" }
});

let users = new Set();
let speaker = null;
let queue = [];

io.on("connection", (socket) => {
  console.log("New user:", socket.id);

  if (users.size >= 10) {
    socket.emit("room-full");
    return;
  }

  users.add(socket.id);
  io.emit("room-update", {
    users: Array.from(users),
    speaker,
    queue,
  });

  // ✅ انتقال به بیرون
  socket.on("signal", ({ to, from, data }) => {
    io.to(to).emit("signal", { from, data });
  });

  socket.on("take-turn", () => {
    if (!queue.includes(socket.id) && socket.id !== speaker) {
      queue.push(socket.id);
      io.emit("queue-update", queue);
    }
  });

  socket.on("start-speaking", () => {
    if (!speaker && queue[0] === socket.id) {
      speaker = socket.id;
      queue.shift();
      io.emit("speaker-update", speaker);
      io.emit("queue-update", queue);
    }
  });

  socket.on("stop-speaking", () => {
    if (speaker === socket.id) {
      speaker = null;
      io.emit("speaker-update", null);
    }
  });

  socket.on("disconnect", () => {
    users.delete(socket.id);
    if (speaker === socket.id) speaker = null;
    queue = queue.filter(id => id !== socket.id);

    io.emit("room-update", {
      users: Array.from(users),
      speaker,
      queue
    });

    io.emit("speaker-update", speaker);
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
