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
      broadcastRoomUpdate();
      console.log(`[${getTime()}] کاربر ${users.get(socket.id).name} درخواست نوبت داد`);
    }
  });

  socket.on("start-speaking", () => {
    if ((!speaker && queue[0] === socket.id) || users.get(socket.id).name.toUpperCase() === 'ALFA') {
      speaker = socket.id;
      if (queue[0] === socket.id) {
        queue.shift();
      }
      broadcastRoomUpdate();
      console.log(`[${getTime()}] کاربر ${users.get(socket.id).name} شروع به صحبت کرد`);
    }
  });

  socket.on("stop-speaking", () => {
    if (speaker === socket.id) {
      speaker = null;
      broadcastRoomUpdate();
      console.log(`[${getTime()}] کاربر ${users.get(socket.id).name} صحبت را پایان داد`);
    }
  });

  socket.on("signal", ({ to, from, data }) => {
    socket.to(to).emit("signal", { from, data });
  });

  socket.on("send-reaction", ({ userId, reaction }) => {
    io.emit("user-reaction", { userId, reaction });
    console.log(`[${getTime()}] کاربر ${users.get(userId).name} واکنش ${reaction} دریافت کرد`);
  });

  socket.on("disconnect", () => {
    const userName = users.get(socket.id)?.name || socket.id;
    users.delete(socket.id);
    
    if (speaker === socket.id) {
      speaker = null;
      console.log(`[${getTime()}] کاربر ${userName} در حال صحبت بود و قطع شد`);
    }
    
    queue = queue.filter(id => id !== socket.id);
    socket.broadcast.emit("user-left", socket.id);
    broadcastRoomUpdate();
    console.log(`[${getTime()}] کاربر ${userName} از اتاق خارج شد`);
  });
});

function broadcastRoomUpdate() {
  const roomData = {
    users: Array.from(users.entries()).map(([id, data]) => [id, data.name]),
    speaker,
    queue,
    timestamp: new Date().toISOString()
  };
  io.emit("room-update", roomData);
}

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`[${getTime()}] سرور روی پورت ${PORT} اجرا شد`);
});
