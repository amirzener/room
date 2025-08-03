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
let users = new Map(); // {socket.id: {name, avatar, joinTime}}
let speaker = null;

function getTime() {
  return new Date().toLocaleTimeString('fa-IR');
}

function broadcastRoomUpdate() {
  const roomData = {
    users: Array.from(users.entries()).map(([id, data]) => [id, data.name, data.avatar]),
    speaker,
    timestamp: new Date().toISOString()
  };
  io.emit("room-update", roomData);
}

io.on("connection", (socket) => {
  console.log(`[${getTime()}] کاربر جدید متصل شد:`, socket.id);

  if (users.size >= MAX_USERS) {
    socket.emit("room-full");
    socket.disconnect(true);
    return;
  }

  socket.on("join", ({ name, avatar }) => {
    users.set(socket.id, {
      name: name || `کاربر ${socket.id.slice(0, 5)}`,
      avatar: avatar || 'https://jzlabel.com/wp-content/uploads/2021/04/happy-emoji-01.jpg',
      joinTime: new Date()
    });

    console.log(`[${getTime()}] کاربر "${name}" به اتاق پیوست`);

    const otherUsers = Array.from(users.keys()).filter(id => id !== socket.id);
    socket.emit("all-users", otherUsers);
    socket.broadcast.emit("user-joined", socket.id);

    broadcastRoomUpdate();
  });

  socket.on("get-users", (callback) => {
    callback(Array.from(users.entries()).map(([id, data]) => [id, data.name, data.avatar]));
  });

  socket.on("start-speaking", () => {
    // اگر کسی در حال صحبت است، ابتدا صحبت او را قطع کنید
    if (speaker) {
      io.to(speaker).emit("force-stop-speaking");
    }
    
    speaker = socket.id;
    broadcastRoomUpdate();
    console.log(`[${getTime()}] کاربر ${users.get(socket.id).name} شروع به صحبت کرد`);
    
    // به کاربر جدید اطلاع دهید که می‌تواند صحبت کند
    io.to(socket.id).emit("you-can-speak");
  });

  socket.on("stop-speaking", () => {
    if (speaker === socket.id) {
      speaker = null;
      broadcastRoomUpdate();
      console.log(`[${getTime()}] کاربر ${users.get(socket.id).name} صحبت را پایان داد`);
    }
  });

  socket.on("force-stop-speaking", () => {
    if (speaker) {
      io.to(speaker).emit("force-stop-speaking");
      speaker = null;
      broadcastRoomUpdate();
    }
  });

  socket.on("signal", ({ to, from, data }) => {
    if (users.has(to) && users.has(from)) {
      socket.to(to).emit("signal", { from, data });
    }
  });

  socket.on("disconnect", () => {
    const userData = users.get(socket.id);
    if (!userData) return;

    const userName = userData.name;
    users.delete(socket.id);
    
    if (speaker === socket.id) {
      speaker = null;
      console.log(`[${getTime()}] کاربر ${userName} در حال صحبت بود و قطع شد`);
    }
    
    socket.broadcast.emit("user-left", socket.id);
    broadcastRoomUpdate();
    console.log(`[${getTime()}] کاربر ${userName} از اتاق خارج شد`);
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`[${getTime()}] سرور روی پورت ${PORT} اجرا شد`);
});
