const WebSocket = require("ws");
const http = require("http");

const PORT = 10000;
const server = http.createServer();
const wss = new WebSocket.Server({ server });

let rooms = {}; // Structure: { roomName: [socket1, socket2, ...] }

wss.on("connection", (socket) => {
  let userRoom = null;
  let username = null;

  socket.on("message", (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === "join") {
        userRoom = data.room;
        username = data.username;

        if (!rooms[userRoom]) rooms[userRoom] = [];
        rooms[userRoom].push(socket);
        console.log(`${username} joined room ${userRoom}`);
      }

      if (data.type === "audio" && userRoom && data.audio) {
        rooms[userRoom].forEach((client) => {
          if (client !== socket && client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify({
                type: "audio",
                username,
                audio: data.audio,
              })
            );
          }
        });
      }
    } catch (err) {
      console.error("Error processing message:", err);
    }
  });

  socket.on("close", () => {
    if (userRoom && rooms[userRoom]) {
      rooms[userRoom] = rooms[userRoom].filter((s) => s !== socket);
      if (rooms[userRoom].length === 0) delete rooms[userRoom];
      console.log(`${username} left room ${userRoom}`);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Voice server running on ws://localhost:${PORT}`);
});
