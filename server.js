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
let users = new Map(); // socket.id -> { name, image, readyToSpeak }
let currentSpeaker = null;

function getTime() {
  return new Date().toLocaleTimeString('fa-IR');
}

function broadcastRoomUpdate() {
  const roomData = {
    users: Array.from(users.entries()).map(([id, data]) => [
      id, data.name, data.image, id === currentSpeaker
    ]),
    currentSpeaker,
    timestamp: new Date().toISOString()
  };
  io.emit("room-update", roomData);
}

io.on("connection", (socket) => {
  console.log(`[${getTime()}] اتصال جدید: ${socket.id}`);

  if (users.size >= MAX_USERS) {
    socket.emit("room-full");
    socket.disconnect(true);
    return;
  }

  socket.on("authenticate", (code) => {
    if (authorizedUsers[code]) {
      const { name, image } = authorizedUsers[code];

      users.set(socket.id, {
        name,
        image,
        readyToSpeak: true // به‌صورت فوری فعال شود
      });

      const otherUsers = Array.from(users.keys()).filter(id => id !== socket.id);
      socket.emit("authenticated", {
        name,
        image,
        otherUsers
      });

      socket.emit("ready-to-speak");
      socket.broadcast.emit("user-joined", socket.id);
      broadcastRoomUpdate();

      console.log(`[${getTime()}] کاربر "${name}" وارد شد (${socket.id})`);
    } else {
      socket.emit("authentication-failed");
      socket.disconnect(true);
      console.log(`[${getTime()}] تلاش ناموفق با کد: ${code}`);
    }
  });

  socket.on("start-speaking", () => {
    const user = users.get(socket.id);
    if (!user) return;

    if (!user.readyToSpeak) {
      console.log(`[${getTime()}] ${socket.id} هنوز آماده صحبت نیست`);
      return;
    }

    if (currentSpeaker !== socket.id) {
      currentSpeaker = socket.id;
      console.log(`[${getTime()}] ${user.name} شروع به صحبت کرد`);
      broadcastRoomUpdate();
    }
  });

  socket.on("stop-speaking", () => {
    const user = users.get(socket.id);
    if (currentSpeaker === socket.id) {
      currentSpeaker = null;
      console.log(`[${getTime()}] ${user?.name || "?"} صحبت را پایان داد`);
      broadcastRoomUpdate();
    }
  });

  socket.on("signal", ({ to, from, data }) => {
    if (users.has(to) && users.has(from)) {
      if (io.sockets.sockets.get(to)?.connected) {
        socket.to(to).emit("signal", { from, data });
      }
    }
  });

  socket.on("disconnect", () => {
    const user = users.get(socket.id);
    if (!user) return;

    users.delete(socket.id);

    if (currentSpeaker === socket.id) {
      currentSpeaker = null;
      console.log(`[${getTime()}] ${user.name} در حال صحبت بود و قطع شد`);
    }

    socket.broadcast.emit("user-left", socket.id);
    broadcastRoomUpdate();

    console.log(`[${getTime()}] ${user.name} خارج شد (${socket.id})`);
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`[${getTime()}] سرور در حال اجرا روی پورت ${PORT}`);
});
