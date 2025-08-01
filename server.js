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
  },
  transports: ["websocket", "polling"]
});

// تنظیمات سرور
const MAX_USERS = 20;
let users = new Map(); // {socket.id: {name, joinTime}}
let speaker = null;
let queue = [];

// تابع کمکی برای گرفتن زمان
function getTime() {
  return new Date().toLocaleTimeString('fa-IR');
}

// مدیریت اتصال کاربران
io.on("connection", (socket) => {
  console.log(`[${getTime()}] کاربر جدید متصل شد:`, socket.id);

  // بررسی پر بودن اتاق
  if (users.size >= MAX_USERS) {
    socket.emit("room-full");
    socket.disconnect(true);
    console.log(`[${getTime()}] اتاق پر است - کاربر ${socket.id} قطع شد`);
    return;
  }

 // دریافت اطلاعات کاربر
socket.on("join", (name) => {
  users.set(socket.id, {
    name: name || `کاربر ${socket.id.slice(0, 5)}`,
    joinTime: new Date()
  });

  console.log(`[${getTime()}] کاربر "${name}" به اتاق پیوست`);

  // ارسال اطلاعات به همه کاربران
  broadcastRoomUpdate();

  // ✅ ارسال لیست کاربران موجود به کاربر جدید
  const otherUsers = Array.from(users.keys()).filter(id => id !== socket.id);
  socket.emit("all-users", otherUsers);

  // ✅ اعلام ورود کاربر جدید به دیگران
  socket.broadcast.emit("user-joined", socket.id);
});


  // درخواست نوبت
  socket.on("take-turn", () => {
    if (!queue.includes(socket.id) && socket.id !== speaker) {
      queue.push(socket.id);
      console.log(`[${getTime()}] کاربر ${users.get(socket.id)?.name} در صف قرار گرفت`);
      io.emit("queue-update");
      broadcastRoomUpdate();
    }
  });

  // شروع صحبت
  socket.on("start-speaking", () => {
    if (!speaker && queue[0] === socket.id) {
      speaker = socket.id;
      queue.shift();
      console.log(`[${getTime()}] کاربر ${users.get(socket.id)?.name} شروع به صحبت کرد`);
      io.emit("speaker-update", speaker);
      io.emit("queue-update");
      broadcastRoomUpdate();
    }
  });

  // پایان صحبت
  socket.on("stop-speaking", () => {
    if (speaker === socket.id) {
      console.log(`[${getTime()}] کاربر ${users.get(socket.id)?.name} صحبت را تمام کرد`);
      speaker = null;
      io.emit("speaker-update", null);
      broadcastRoomUpdate();
    }
  });

  // ارتباط WebRTC
  socket.on("signal", ({ to, from, data }) => {
    socket.to(to).emit("signal", { from, data });
  });

  // درخواست اطلاعات اتاق
  socket.on("room-update-request", () => {
    broadcastRoomUpdate(socket);
  });

  // قطع ارتباط کاربر
  socket.on("disconnect", () => {
    const user = users.get(socket.id);
    if (user) {
      console.log(`[${getTime()}] کاربر "${user.name}" از اتاق خارج شد`);
    }

    users.delete(socket.id);
    
    if (speaker === socket.id) {
      speaker = null;
      io.emit("speaker-update", null);
    }
    
    queue = queue.filter(id => id !== socket.id);
    
    broadcastRoomUpdate();
    io.emit("queue-update");
  });
});

// تابع برای ارسال اطلاعات به همه کاربران
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

// شروع سرور
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`[${getTime()}] سرور در حال اجرا روی پورت ${PORT}`);
});

// مدیریت خطاها
process.on('uncaughtException', (err) => {
  console.error('خطای غیرمنتظره:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('خطای رد نشده:', err);
});
