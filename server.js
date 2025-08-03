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
let users = new Map(); // {socket.id: {name, joinTime, isMuted, isDeafened}}
let speaker = null;
let queue = [];

function getTime() {
  return new Date().toLocaleTimeString('fa-IR');
}

function broadcastRoomUpdate() {
  const roomData = {
    users: Array.from(users.entries()).map(([id, data]) => [id, data.name, data.isMuted, data.isDeafened]),
    speaker,
    queue,
    timestamp: new Date().toISOString()
  };
  io.emit("room-update", roomData);
}

function removeFromQueue(userId) {
  queue = queue.filter(id => id !== userId);
}

io.on("connection", (socket) => {
  console.log(`[${getTime()}] کاربر جدید متصل شد:`, socket.id);

  if (users.size >= MAX_USERS) {
    socket.emit("room-full");
    socket.disconnect(true);
    return;
  }

  socket.on("join", (name) => {
    // حذف کاربر از صف اگر قبلاً وجود داشت
    removeFromQueue(socket.id);
    
    users.set(socket.id, {
      name: name || `کاربر ${socket.id.slice(0, 5)}`,
      joinTime: new Date(),
      isMuted: false,
      isDeafened: false
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
    const userData = users.get(socket.id);
    if (!userData) return;
    if ((!speaker && queue[0] === socket.id && !userData.isMuted) || 
      (userData.name.toUpperCase() === 'ALFA' && !userData.isMuted) ||
      (userData.name === '1' && !userData.isMuted)) {
    speaker = socket.id;
    if (queue[0] === socket.id) {
      queue.shift();
    }
    broadcastRoomUpdate();
    console.log(`[${getTime()}] کاربر ${userData.name} شروع به صحبت کرد`);
  }
    if ((!speaker && queue[0] === socket.id && !userData.isMuted) || 
      (userData.name.toUpperCase() === 'ALFA' && !userData.isMuted) ||
      (userData.name === '1' && !userData.isMuted)) {
    speaker = socket.id;
    if (queue[0] === socket.id) {
      queue.shift();
    }
    broadcastRoomUpdate();
    console.log(`[${getTime()}] کاربر ${userData.name} شروع به صحبت کرد`);
  }

    if ((!speaker && queue[0] === socket.id && !userData.isMuted) || 
        (userData.name.toUpperCase() === 'ALFA' && !userData.isMuted)) {
      speaker = socket.id;
      if (queue[0] === socket.id) {
        queue.shift();
      }
      broadcastRoomUpdate();
      console.log(`[${getTime()}] کاربر ${userData.name} شروع به صحبت کرد`);
    }
  });

  socket.on("stop-speaking", () => {
    if (speaker === socket.id) {
      speaker = null;
      broadcastRoomUpdate();
      console.log(`[${getTime()}] کاربر ${users.get(socket.id).name} صحبت را پایان داد`);
    }
  });

  socket.on("admin-mute-user", (targetUserId) => {
    const adminData = users.get(socket.id);
    const targetUserData = users.get(targetUserId);
    
    if (adminData?.name.toUpperCase() === 'ALFA' && targetUserData) {
      targetUserData.isMuted = !targetUserData.isMuted;
      
      if (targetUserData.isMuted && speaker === targetUserId) {
        speaker = null;
        io.to(targetUserId).emit("force-stop-speaking");
      }
      
      broadcastRoomUpdate();
      console.log(`[${getTime()}] ادمین ${adminData.name} میکروفون کاربر ${targetUserData.name} را ${targetUserData.isMuted ? 'قطع' : 'وصل'} کرد`);
    }
  });

  socket.on("admin-deafen-user", (targetUserId) => {
    const adminData = users.get(socket.id);
    const targetUserData = users.get(targetUserId);
    
    if (adminData?.name.toUpperCase() === 'ALFA' && targetUserData) {
      targetUserData.isDeafened = !targetUserData.isDeafened;
      broadcastRoomUpdate();
      console.log(`[${getTime()}] ادمین ${adminData.name} صداهای کاربر ${targetUserData.name} را ${targetUserData.isDeafened ? 'قطع' : 'وصل'} کرد`);
    }
  });

  socket.on("admin-end-speaking", () => {
    const adminData = users.get(socket.id);
    if (adminData?.name.toUpperCase() === 'ALFA' && speaker) {
      const speakerId = speaker;
      speaker = null;
      io.to(speakerId).emit("force-stop-speaking");
      broadcastRoomUpdate();
      console.log(`[${getTime()}] ادمین ${adminData.name} صحبت کاربر ${users.get(speakerId).name} را پایان داد`);
    }
  });

  socket.on("admin-unmute-all", () => {
    const adminData = users.get(socket.id);
    if (adminData?.name.toUpperCase() === 'ALFA') {
      users.forEach(user => {
        user.isMuted = false;
      });
      broadcastRoomUpdate();
      console.log(`[${getTime()}] ادمین ${adminData.name} صدای همه کاربران را وصل کرد`);
    }
  });

  socket.on("signal", ({ to, from, data }) => {
    if (users.has(to) && users.has(from)) {
      socket.to(to).emit("signal", { from, data });
    }
  });

  socket.on("send-reaction", ({ userId, reaction }) => {
    if (users.has(userId)) {
      io.emit("user-reaction", { userId, reaction });
      console.log(`[${getTime()}] کاربر ${users.get(userId).name} واکنش ${reaction} دریافت کرد`);
    }
  });

  socket.on("disconnect", () => {
    const userData = users.get(socket.id);
    if (!userData) return;

    const userName = userData.name;
    users.delete(socket.id);
    removeFromQueue(socket.id);
    
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
