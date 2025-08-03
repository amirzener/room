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

// اطلاعات کاربران مجاز
const authorizedUsers = {
  "1": { name: "امیر الفا", image: "https://jzlabel.com/wp-content/uploads/2021/04/love-emoji-01.jpg" },
  "2": { name: "امیر تربت", image: "https://jzlabel.com/wp-content/uploads/2021/04/father-emoji-01.jpg" },
  "3": { name: "نسترن", image: "https://static0.khabarfoori.com/servev2/N2VlNjEjvrMH/5Uwvb7W7Zm0,/file.jpg" },
  "4": { name: "میلاد", image: "https://jzlabel.com/wp-content/uploads/2021/04/vampire-emoji-01.jpg" },
  "5": { name: "علی", image: "https://jzlabel.com/wp-content/uploads/2021/04/vamp-emoji-01.jpg" },
  "6": { name: "حامد", image: "https://jzlabel.com/wp-content/uploads/2021/04/boy-emoji-01.jpg" },
  "7": { name: "امید", image: "https://jzlabel.com/wp-content/uploads/2021/04/dance-emoji-01.jpg" },
  "8": { name: "شیوا", image: "https://jzlabel.com/wp-content/uploads/2021/04/happy-emoji-01.jpg" }
};

const MAX_USERS = 20;
let users = new Map(); // {socket.id: {name, image, joinTime}}
let currentSpeaker = null;

function getTime() {
  return new Date().toLocaleTimeString('fa-IR');
}

function broadcastRoomUpdate() {
  const roomData = {
    users: Array.from(users.entries()).map(([id, data]) => [id, data.name, data.image, id === currentSpeaker]),
    currentSpeaker,
    timestamp: new Date().toISOString()
  };
  io.emit("room-update", roomData);
}

io.on("connection", (socket) => {
  console.log(`[${getTime()}] اتصال جدید:`, socket.id);

  if (users.size >= MAX_USERS) {
    socket.emit("room-full");
    socket.disconnect(true);
    return;
  }

  socket.on("authenticate", (code) => {
    if (authorizedUsers[code]) {
      const userData = authorizedUsers[code];
      users.set(socket.id, {
        name: userData.name,
        image: userData.image,
        joinTime: new Date(),
        readyToSpeak: false
      });

      // بعد از 7 ثانیه کاربر آماده صحبت می‌شود
      setTimeout(() => {
        const user = users.get(socket.id);
        if (user) {
          user.readyToSpeak = true;
          socket.emit("ready-to-speak");
          broadcastRoomUpdate();
        }
      }, 7000);

      const otherUsers = Array.from(users.entries())
  .filter(([id]) => id !== socket.id)
  .map(([id, u]) => ({ id, name: u.name, image: u.image }));

socket.emit("authenticated", { 
  name: userData.name, 
  image: userData.image,
  otherUsers
});

// به همه کاربران اطلاع بده که یک کاربر جدید آمده و مشخصات او را هم بفرست
socket.broadcast.emit("user-joined", {
  id: socket.id,
  name: userData.name,
  image: userData.image
});

      
      
      broadcastRoomUpdate();
      
      console.log(`[${getTime()}] کاربر "${userData.name}" با کد ${code} وارد شد`);
    } else {
      socket.emit("authentication-failed");
      socket.disconnect(true);
      console.log(`[${getTime()}] کد نامعتبر: ${code}`);
    }
  });

  socket.on("start-speaking", () => {
    const user = users.get(socket.id);
    if (!user || !user.readyToSpeak) return;

    // اگر کسی در حال صحبت است، صحبت او را قطع می‌کنیم
    if (currentSpeaker) {
      io.to(currentSpeaker).emit("stop-speaking");
    }

    currentSpeaker = socket.id;
    broadcastRoomUpdate();
    console.log(`[${getTime()}] کاربر ${user.name} شروع به صحبت کرد`);
  });

  socket.on("stop-speaking", () => {
    if (currentSpeaker === socket.id) {
      currentSpeaker = null;
      broadcastRoomUpdate();
      console.log(`[${getTime()}] کاربر ${users.get(socket.id).name} صحبت را پایان داد`);
    }
  });

  socket.on("signal", ({ to, from, data }) => {
    if (users.has(to) && users.has(from)) {
      socket.to(to).emit("signal", { from, data });
    }
  });

  socket.on("disconnect", () => {
    const user = users.get(socket.id);
    if (!user) return;

    users.delete(socket.id);
    
    if (currentSpeaker === socket.id) {
      currentSpeaker = null;
      console.log(`[${getTime()}] کاربر ${user.name} در حال صحبت بود و قطع شد`);
    }
    
    socket.broadcast.emit("user-left", socket.id);
    broadcastRoomUpdate();
    console.log(`[${getTime()}] کاربر ${user.name} از اتاق خارج شد`);
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`[${getTime()}] سرور روی پورت ${PORT} اجرا شد`);
});
