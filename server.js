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
let users = new Map(); // socket.id → {name, joinTime, isAdmin}
let pendingApprovals = new Map(); // socket.id → {name, timestamp}
let speaker = null;
let queue = [];
let adminSocketId = null;
let isRoomActive = false;

function getTime() {
  return new Date().toLocaleTimeString('fa-IR');
}

io.on("connection", (socket) => {
  console.log(`[${getTime()}] کاربر جدید متصل شد:`, socket.id);

  // ارسال وضعیت اتاق به کاربر جدید
  socket.emit("room-status", { 
    isActive: isRoomActive,
    isAdminRequest: false // به صورت پیش فرض false است
  });

  if (users.size >= MAX_USERS) {
    socket.emit("room-full");
    socket.disconnect(true);
    return;
  }

  // رویداد برای درخواست تایید ورود
  socket.on("request-approval", (name) => {
    if (!name || name.trim() === "") {
      socket.emit("approval-response", {
        isApproved: false,
        message: "نام نمی‌تواند خالی باشد"
      });
      return;
    }

    if (name.toUpperCase() === 'ALFA') {
      // کاربر ALFA است
      adminSocketId = socket.id;
      isRoomActive = true; // اتاق با ورود ALFA فعال می‌شود
      users.set(socket.id, {
        name: name,
        joinTime: new Date(),
        isAdmin: true
      });
      
      // اطلاع به ALFA که مدیر است و اتاق فعال شده
      socket.emit("room-status", { 
        isActive: true,
        isAdminRequest: true
      });
      
      // ارسال تمام درخواست‌های pending به ALFA
      if (pendingApprovals.size > 0) {
        const requests = Array.from(pendingApprovals.entries()).map(([id, data]) => ({
          id,
          name: data.name
        }));
        socket.emit("pending-requests", requests);
      }
      
      // ارسال لیست کاربران فعلی به ALFA
      updateAdminUserLists();
      
      socket.emit("approval-response", { 
        isApproved: true, 
        message: "شما به عنوان مدیر وارد شدید و اتاق فعال شد" 
      });
      console.log(`[${getTime()}] مدیر ALFA وارد شد و اتاق فعال شد`);
    } else {
      // کاربر عادی است
      if (!isRoomActive) {
        socket.emit("room-inactive");
        socket.disconnect(true);
        return;
      }
      
      // درخواست به حالت انتظار می‌رود
      pendingApprovals.set(socket.id, {
        name: name,
        timestamp: new Date()
      });
      
      // اطلاع به ALFA در صورت وجود
      if (adminSocketId) {
        updateAdminPendingRequests();
      }
      
      socket.emit("approval-response", { 
        isApproved: false, 
        message: "درخواست شما برای ورود ارسال شد. منتظر تایید مدیر باشید." 
      });
    }
  });

  // رویدادهای مدیریتی فقط برای ALFA
  socket.on("approve-user", (userId) => {
    if (socket.id === adminSocketId && pendingApprovals.has(userId)) {
      const userData = pendingApprovals.get(userId);
      pendingApprovals.delete(userId);
      
      users.set(userId, {
        name: userData.name,
        joinTime: new Date(),
        isAdmin: false
      });
      
      io.to(userId).emit("approval-response", { isApproved: true });
      
      // به روزرسانی لیست‌ها برای ALFA
      updateAdminUserLists();
      updateAdminPendingRequests();
      
      // کاربر تایید شده می‌تواند به اتاق بپیوندد
      const otherUsers = Array.from(users.keys()).filter(id => id !== userId);
      io.to(userId).emit("all-users", otherUsers);
      socket.broadcast.emit("user-joined", userId);
      broadcastRoomUpdate();
    }
  });

  socket.on("reject-user", (userId) => {
    if (socket.id === adminSocketId && pendingApprovals.has(userId)) {
      pendingApprovals.delete(userId);
      io.to(userId).emit("approval-response", { 
        isApproved: false, 
        message: "درخواست شما توسط مدیر رد شد" 
      });
      io.to(userId).emit("kicked");
      io.sockets.sockets.get(userId)?.disconnect();
      
      updateAdminPendingRequests();
    }
  });

  socket.on("kick-user", (userId) => {
    if (socket.id === adminSocketId && users.has(userId) && !users.get(userId).isAdmin) {
      io.to(userId).emit("kicked");
      users.delete(userId);
      
      if (speaker === userId) {
        speaker = null;
        io.emit("speaker-update", null);
      }
      queue = queue.filter(id => id !== userId);
      
      updateAdminUserLists();
      io.sockets.sockets.get(userId)?.disconnect();
      broadcastRoomUpdate();
    }
  });

  // بقیه رویدادها فقط برای کاربران تایید شده
  socket.on("join", (name) => {
    if (!users.has(socket.id)) return;
    
    const otherUsers = Array.from(users.keys()).filter(id => id !== socket.id);
    socket.emit("all-users", otherUsers);
    socket.broadcast.emit("user-joined", socket.id);
    broadcastRoomUpdate();
  });

  socket.on("take-turn", () => {
    if (!users.has(socket.id)) return;
    
    if (!queue.includes(socket.id) && socket.id !== speaker) {
      queue.push(socket.id);
      io.emit("queue-update");
      broadcastRoomUpdate();
    }
  });

  socket.on("start-speaking", () => {
    if (!users.has(socket.id)) return;
    
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
    if (socket.id === adminSocketId) {
      adminSocketId = null;
      isRoomActive = false;
      io.emit("room-inactive");
      
      // قطع ارتباط تمام کاربران
      users.forEach((_, id) => {
        if (id !== socket.id) {
          io.to(id).emit("kicked");
          io.sockets.sockets.get(id)?.disconnect();
        }
      });
      users.clear();
      pendingApprovals.clear();
      return;
    }
    
    if (pendingApprovals.has(socket.id)) {
      pendingApprovals.delete(socket.id);
      updateAdminPendingRequests();
    }
    
    if (users.has(socket.id)) {
      users.delete(socket.id);
      if (speaker === socket.id) {
        speaker = null;
        io.emit("speaker-update", null);
      }
      queue = queue.filter(id => id !== socket.id);
      socket.broadcast.emit("user-left", socket.id);
      broadcastRoomUpdate();
      io.emit("queue-update");
      
      updateAdminUserLists();
    }
  });
});

// توابع کمکی
function updateAdminUserLists() {
  if (adminSocketId) {
    const currentUsers = Array.from(users.entries())
      .filter(([_, user]) => !user.isAdmin)
      .map(([id, data]) => ({
        id,
        name: data.name
      }));
    io.to(adminSocketId).emit("current-users", currentUsers);
  }
}

function updateAdminPendingRequests() {
  if (adminSocketId) {
    const requests = Array.from(pendingApprovals.entries()).map(([id, data]) => ({
      id,
      name: data.name
    }));
    io.to(adminSocketId).emit("pending-requests", requests);
  }
}

function broadcastRoomUpdate(socket = null) {
  const roomData = {
    users: Array.from(users.entries())
      .filter(([_, user]) => !user.isAdmin)
      .map(([id, data]) => [id, data.name]),
    speaker,
    queue: queue.filter(id => users.has(id) && !users.get(id).isAdmin),
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
