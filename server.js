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
const ACCESS_CODES = {
  '1': { name: 'امیر الفا', image: 'https://jzlabel.com/wp-content/uploads/2021/04/love-emoji-01.jpg' },
  '2': { name: 'امیر تربت', image: 'https://jzlabel.com/wp-content/uploads/2021/04/father-emoji-01.jpg' },
  '3': { name: 'نسترن', image: 'https://static0.khabarfoori.com/servev2/N2VlNjEjvrMH/5Uwvb7W7Zm0,/file.jpg' },
  '4': { name: 'میلاد', image: 'https://jzlabel.com/wp-content/uploads/2021/04/vampire-emoji-01.jpg' },
  '5': { name: 'علی', image: 'https://jzlabel.com/wp-content/uploads/2021/04/vamp-emoji-01.jpg' },
  '6': { name: 'حامد', image: 'https://jzlabel.com/wp-content/uploads/2021/04/boy-emoji-01.jpg' },
  '7': { name: 'امید', image: 'https://jzlabel.com/wp-content/uploads/2021/04/dance-emoji-01.jpg' },
  '8': { name: 'شیوا', image: 'https://jzlabel.com/wp-content/uploads/2021/04/happy-emoji-01.jpg' }
};

let users = new Map(); // {socket.id: {name, image, joinTime, isSpeaking}}
let currentSpeaker = null;

function getTime() {
  return new Date().toLocaleTimeString('fa-IR');
}

function broadcastRoomUpdate() {
  const roomData = {
    users: Array.from(users.entries()).map(([id, data]) => [id, data.name, data.image, data.isSpeaking]),
    currentSpeaker,
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

  socket.on("join-with-code", (code) => {
    if (!ACCESS_CODES[code]) {
      socket.emit("invalid-code");
      socket.disconnect(true);
      return;
    }

    const userData = {
      name: ACCESS_CODES[code].name,
      image: ACCESS_CODES[code].image,
      joinTime: new Date(),
      isSpeaking: false
    };

    users.set(socket.id, userData);

    console.log(`[${getTime()}] کاربر "${userData.name}" با کد ${code} به اتاق پیوست`);

    const otherUsers = Array.from(users.keys()).filter(id => id !== socket.id);
    socket.emit("all-users", otherUsers);
    socket.broadcast.emit("user-joined", socket.id);

    broadcastRoomUpdate();
  });

  socket.on("toggle-speak", () => {
    const userData = users.get(socket.id);
    if (!userData) return;

    if (currentSpeaker === socket.id) {
      // کاربر در حال صحبت است و می‌خواهد قطع کند
      currentSpeaker = null;
      userData.isSpeaking = false;
      socket.emit("speak-status", false);
    } else {
      // کاربر می‌خواهد صحبت کند
      if (currentSpeaker) {
        // اگر کسی در حال صحبت است، او را قطع می‌کنیم
        const prevSpeakerData = users.get(currentSpeaker);
        if (prevSpeakerData) {
          prevSpeakerData.isSpeaking = false;
          io.to(currentSpeaker).emit("speak-status", false);
        }
      }
      currentSpeaker = socket.id;
      userData.isSpeaking = true;
      socket.emit("speak-status", true);
    }

    broadcastRoomUpdate();
    console.log(`[${getTime()}] کاربر ${userData.name} وضعیت صحبت را تغییر داد به: ${userData.isSpeaking}`);
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
    
    if (currentSpeaker === socket.id) {
      currentSpeaker = null;
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
