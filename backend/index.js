require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");
const http = require("http");
const { RoomServiceClient, AccessToken } = require("livekit-server-sdk");

const app = express();

// Настройка CORS
const allowedOrigins = [
  "https://voice-app-xi.vercel.app/",
  "http://localhost:5173", // для локальной разработки
];

const corsOptions = {
  // origin: function (origin, callback) {
  //   if (!origin || allowedOrigins.includes(origin)) {
  //     callback(null, true);
  //   } else {
  //     callback(new Error("Not allowed by CORS"));
  //   }
  // },
  origin: ["https://voice-app-xi.vercel.app/", "http://localhost:5173"],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));

app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const PORT = process.env.PORT || 3001;
const roomService = new RoomServiceClient(process.env.SERVER_URL, process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);

// Создание комнаты
app.post("/create-room", async (req, res) => {
  const { roomName } = req.body;
  try {
    const room = await roomService.createRoom({ name: roomName });
    res.json({ roomId: room.name });
  } catch (e) {
    res.status(500).json({ error: "Room creation failed" });
  }
});

// Генерация токена

app.post("/get-token", async (req, res) => {
  const { roomName, username } = req.body;

  // Проверка обязательных полей
  if (!roomName || !username) {
    return res.status(400).json({ error: "Missing roomName or username" });
  }

  try {
    const token = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, { identity: username });

    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    });

    // Генерация JWT строки
    const jwtToken = await token.toJwt(); // ✅ Это критически важно!

    res.json({ token: jwtToken }); // Отправляем строку токена
  } catch (error) {
    console.error("Token generation error:", error);
    res.status(500).json({ error: "Failed to generate token" });
  }
});

// io
const canvasStates = {};
const A_COLORS = ["#6366f1", "6366f1", "#f44336", "#673ab7"];

io.on("connection", (socket) => {
  let currentRoom = null;
  let currentUsername = null;

  console.log("New client connected:", socket.id);

  socket.on("joinRoom", (roomId, username) => {
    socket.join(roomId);
    console.log(`Client ${socket.id} joined room ${roomId}`);
    currentRoom = roomId;
    currentUsername = username;

    socket.to(roomId).emit("userConnected", username);
    socket.to(roomId).emit("requestCursorPosition", username);

    // Инициализируем состояние холста для комнаты
    if (!canvasStates[roomId]) {
      canvasStates[roomId] = [];
    }
  });

  // Обработка событий рисования - КРИТИЧНО ВАЖНЫЙ БЛОК
  socket.on("gameEvent", (data) => {
    console.log(`Received game event from ${socket.id} in room ${data.roomId}`);

    // Сохраняем состояние
    canvasStates[data.roomId] = [...canvasStates[data.roomId], data.data];
    console.log("canvasStates: ", canvasStates);
    // Отправляем событие ВСЕМ участникам комнаты, КРОМЕ отправителя
    socket.to(data.roomId).emit("gameUpdate", data);
  });

  // Обработка движения курсора
  // socket.on("cursorMove", (data) => {
  //   // if (currentRoom) {
  //   //   // Рассылаем всем, кроме отправителя
  //   //   socket.to(currentRoom).emit("cursorMove", position);
  //   // }

  //   const enhancedData = {
  //     ...data,
  //     userId: socket.id, // Добавляем ID пользователя
  //     username: data.username || "Anonymous", // Добавляем имя пользователя
  //   };

  //   socket.to(data.roomId).emit("cursorMove", enhancedData);
  // });
  socket.on("cursorMove", (position) => {
    if (currentRoom) {
      // Рассылаем всем, кроме отправителя
      socket.to(currentRoom).emit("cursorMove", position);
    }
  });

  socket.on("requestCursorPosition", (requestedUsername) => {
    if (requestedUsername === currentUsername && currentRoom) {
      // Отправляем запрос конкретному пользователю
      socket.to(currentRoom).emit("requestCursorPosition", requestedUsername);
    }
  });

  // Обработка запроса состояния холста
  socket.on("requestCanvasState", (roomId) => {
    if (canvasStates[roomId]) {
      socket.emit("canvasState", canvasStates[roomId]);
    }
  });

  socket.on("clearCanvas", (roomId) => {
    // 🔴 Рассылаем событие всем участникам комнаты
    io.to(roomId).emit("clearCanvas");
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
