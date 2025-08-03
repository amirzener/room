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

const users = new Map(); // socketId: { name, avatar, isSpeaking }
let currentSpeaker = null;

const codeMap = {
  "1": { name: "امیر الفا", avatar: "https://jzlabel.com/wp-content/uploads/2021/04/love-emoji-01.jpg" },
  "2": { name: "امیر تربت", avatar: "https://jzlabel.com/wp-content/uploads/2021/04/father-emoji-01.jpg" },
  "3": { name: "نسترن", avatar: "https://static0.khabarfoori.com/servev2/N2VlNjEjvrMH/5Uwvb7W7Zm0,/file.jpg" },
  "4": { name: "میلاد", avatar: "https://jzlabel.com/wp-content/uploads/2021/04/vampire-emoji-01.jpg" },
  "5": { name: "علی", avatar: "https://jzlabel.com/wp-content/uploads/2021/04/vamp-emoji-01.jpg" },
  "6": { name: "حامد", avatar: "https://jzlabel.com/wp-content/uploads/2021/04/boy-emoji-01.jpg" },
  "7": { name: "امید", avatar: "https://jzlabel.com/wp-content/uploads/2021/04/dance-emoji-01.jpg" },
  "8": { name: "شیوا", avatar: "https://jzlabel.com/wp-content/uploads/2021/04/happy-emoji-01.jpg" },
};

io.on("connection", (socket) => {
  socket.on("join", (code) => {
    if (!codeMap[code]) {
      socket.emit("invalid-code");
      return;
    }

    const userInfo = codeMap[code];
    users.set(socket.id, {
      name: userInfo.name,
      avatar: userInfo.avatar,
    });

    socket.emit("joined", { id: socket.id, ...userInfo, currentSpeaker });

    io.emit("update-users", Array.from(users.entries()).map(([id, data]) => ({
      id,
      name: data.name,
      avatar: data.avatar,
      isSpeaking: id === currentSpeaker
    })));
  });

  socket.on("start-speaking", () => {
    if (!users.has(socket.id)) return;

    if (currentSpeaker && currentSpeaker !== socket.id) {
      io.to(currentSpeaker).emit("force-stop");
    }

    currentSpeaker = socket.id;
    io.emit("speaker-changed", currentSpeaker);
  });

  socket.on("stop-speaking", () => {
    if (currentSpeaker === socket.id) {
      currentSpeaker = null;
      io.emit("speaker-changed", null);
    }
  });

  socket.on("disconnect", () => {
    users.delete(socket.id);
    if (currentSpeaker === socket.id) {
      currentSpeaker = null;
    }

    io.emit("update-users", Array.from(users.entries()).map(([id, data]) => ({
      id,
      name: data.name,
      avatar: data.avatar,
      isSpeaking: id === currentSpeaker
    })));

    io.emit("speaker-changed", currentSpeaker);
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
