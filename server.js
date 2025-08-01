const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const MAX_USERS = 20;
let users = new Map(); // socket.id → {name, joinTime}
let speaker = null;
let queue = [];

function getTime() {
  return new Date().toLocaleTimeString('fa-IR');
}

io.on("connection", (socket) => {
  console.log(`[${getTime()}] کاربر جدید متصل شد:`, socket.id);

  if (users.size >= MAX_USERS) {
    socket.emit("room-full");
    socket.disconnect(true);
    return;
  }

  socket.on("join", (name) => {
    users.set(socket.id, {
      name: name || `کاربر ${socket.id.slice(0, 5)}`,
      joinTime: new Date()
    });

    console.log(`[${getTime()}] کاربر "${name}" به اتاق پیوست`);

    const otherUsers = Array.from(users.keys()).filter(id => id !== socket.id);
    socket.emit("all-users", otherUsers);
    socket.broadcast.emit("user-joined", socket.id);

    broadcastRoomUpdate();
  });

  socket.on("take-turn", () => {
    if (!queue.includes(socket.id) && socket.id !== speaker) {
      queue.push(socket.id);
      io.emit("queue-update");
      broadcastRoomUpdate();
    }
  });

  socket.on("start-speaking", () => {
    if (!speaker && queue[0] === socket.id) {
      speaker = socket.id;
      queue.shift();
      io.emit("speaker-update", speaker);
      io.emit("queue-update");
      broadcastRoomUpdate();
    }
  });

  socket.on("stop-speaking", () => {
    if (speaker === socket.id) {
      speaker = null;
      io.emit("speaker-update", null);
      broadcastRoomUpdate();
    }
  });

  socket.on("signal", ({ to, from, data }) => {
    socket.to(to).emit("signal", { from, data });
  });

  socket.on("room-update-request", () => {
    broadcastRoomUpdate(socket);
  });

  socket.on("disconnect", () => {
    users.delete(socket.id);
    if (speaker === socket.id) {
      speaker = null;
      io.emit("speaker-update", null);
    }
    queue = queue.filter(id => id !== socket.id);
    socket.broadcast.emit("user-left", socket.id);
    broadcastRoomUpdate();
    io.emit("queue-update");
  });
});

function broadcastRoomUpdate(socket = null) {
  const roomData = {
    users: Array.from(users.entries()).map(([id, data]) => [id, data.name]),
    speaker,
    queue,
    timestamp: new Date().toISOString()
  };

  if (socket) {
    socket.emit("room-update", roomData);
  } else {
    io.emit("room-update", roomData);
  }
}

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`[${getTime()}] سرور روی پورت ${PORT} اجرا شد`);
});
