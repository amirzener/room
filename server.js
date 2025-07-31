const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

let users = new Map(); // socket.id -> name
let speaker = null;
let queue = [];

io.on("connection", (socket) => {
  console.log("New user connected:", socket.id);

  if (users.size >= 10) {
    socket.emit("room-full");
    return;
  }

  socket.on("join", (name) => {
    users.set(socket.id, name);
    io.emit("room-update", {
      users: Array.from(users.entries()), // [[id, name], ...]
      speaker,
      queue,
    });
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
      io.emit("room-update", {
        users: Array.from(users.entries()),
        speaker,
        queue,
      });
    }
  });

  socket.on("stop-speaking", () => {
    if (speaker === socket.id) {
      speaker = null;
      io.emit("speaker-update", null);
      io.emit("room-update", {
        users: Array.from(users.entries()),
        speaker,
        queue,
      });
    }
  });

  socket.on("signal", ({ to, from, data }) => {
    io.to(to).emit("signal", { from, data });
  });

  socket.on("room-update-request", () => {
    socket.emit("room-update", {
      users: Array.from(users.entries()),
      speaker,
      queue,
    });
  });

  socket.on("disconnect", () => {
    users.delete(socket.id);
    if (speaker === socket.id) speaker = null;
    queue = queue.filter(id => id !== socket.id);

    io.emit("room-update", {
      users: Array.from(users.entries()),
      speaker,
      queue,
    });

    io.emit("speaker-update", speaker);
    io.emit("queue-update", queue);
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
