import * as fabric from "fabric";
import { useEffect, useRef, useState } from "react";
import io, { Socket } from "socket.io-client";

type GameEvent = {
  type: string;
  data: any;
  roomId: string;
  userId: string;
};

type CursorPosition = {
  username: string;
  x: number;
  y: number;
};

const CURSOR_COLORS = [
  "#FF9AA2",
  "#FFB7B2",
  "#FFDAC1",
  "#E2F0CB",
  "#B5EAD7",
  "#C7CEEA",
  "#F8B195",
  "#F67280",
  "#C06C84",
  "#6C5B7B",
  "#355C7D",
  "#99B898",
];

export const GameCanvas = ({ roomId, username }: { roomId: string; username: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const [brushColor, setBrushColor] = useState("#4A90E2");
  const [brushSize, setBrushSize] = useState(5);
  const userCursorsRef = useRef<{ [username: string]: fabric.Text }>({});
  const cursorColorsRef = useRef<{ [username: string]: string }>({});
  const lastPositionRef = useRef<{ [username: string]: { x: number; y: number } }>({});
  const lastUpdateTimeRef = useRef<{ [username: string]: number }>({});

  const getCursorColor = (username: string) => {
    if (!cursorColorsRef.current[username]) {
      const colorIndex = Object.keys(cursorColorsRef.current).length % CURSOR_COLORS.length;
      cursorColorsRef.current[username] = CURSOR_COLORS[colorIndex];
    }
    return cursorColorsRef.current[username];
  };

  useEffect(() => {
    const newSocket = io(import.meta.env.VITE_SERVER_URL);

    newSocket.on("connect", () => {
      console.log("Socket connected:", newSocket.id);
      newSocket.emit("joinRoom", roomId, username);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [roomId, username]);

  const clearCanvas = () => {
    if (!fabricRef.current) return;

    const objects = fabricRef.current.getObjects();
    objects.forEach((obj) => {
      if (!(obj as any).isCursor) {
        fabricRef.current?.remove(obj);
      }
    });

    fabricRef.current.backgroundColor = "#FFFFFF";
    fabricRef.current.requestRenderAll();
  };

  useEffect(() => {
    if (!canvasRef.current || !socket) return;

    try {
      const canvas = new fabric.Canvas(canvasRef.current, {
        isDrawingMode: true,
        width: 800,
        height: 500,
        backgroundColor: "#FFFFFF",
        selection: false,
      });

      fabricRef.current = canvas;

      const brush = new fabric.PencilBrush(canvas);
      brush.width = brushSize;
      brush.color = brushColor;
      canvas.freeDrawingBrush = brush;

      // Обработка рисования
      const handlePathCreated = (e: fabric.IEvent) => {
        if (!e.path) return;
        const path = e.path;
        const pathData = path.toObject();

        socket.emit("gameEvent", {
          type: "DRAW",
          data: pathData,
          roomId,
          userId: username,
        });
      };

      canvas.on("path:created", handlePathCreated);

      // Обновление курсора
      const updateCursor = (username: string, x: number, y: number) => {
        if (!fabricRef.current) return;

        const cursorColor = getCursorColor(username);
        const isLocalUser = username === username;
        const displayName = isLocalUser ? `${username} (You)` : username;

        // Обновляем последнюю позицию
        lastPositionRef.current[username] = { x, y };
        lastUpdateTimeRef.current[username] = Date.now();

        if (userCursorsRef.current[username]) {
          const cursor = userCursorsRef.current[username];
          cursor.set({
            left: x + 15,
            top: y - 15,
            visible: true,
            text: displayName,
          });
        } else {
          const cursor = new fabric.Text(displayName, {
            left: x + 15,
            top: y - 15,
            fontSize: 14,
            fill: cursorColor,
            fontWeight: "bold",
            shadow: "rgba(0,0,0,0.3) 1px 1px 2px",
            selectable: false,
            evented: false,
            isCursor: true,
          });

          userCursorsRef.current[username] = cursor;
          fabricRef.current.add(cursor);
        }

        fabricRef.current.requestRenderAll();
      };

      // Обработка движения мыши
      let lastMove = 0;
      const handleMouseMove = (e: fabric.IEvent) => {
        if (!e.pointer) return;

        // Обновляем свой курсор
        updateCursor(username, e.pointer.x, e.pointer.y);

        // Отправляем событие с троттлингом
        if (Date.now() - lastMove > 50) {
          lastMove = Date.now();
          socket.emit("cursorMove", {
            roomId,
            x: e.pointer.x,
            y: e.pointer.y,
            username,
          });
        }
      };

      canvas.on("mouse:move", handleMouseMove);

      // Инициализация своего курсора
      updateCursor(username, canvas.width! / 2, canvas.height! / 2);

      // Обработка входящих событий рисования
      const handleGameUpdate = (data: GameEvent) => {
        if (data.type === "DRAW" && fabricRef.current) {
          const path = new fabric.Path(data.data.path, {
            stroke: data.data.stroke || brushColor,
            strokeWidth: data.data.strokeWidth || brushSize,
            strokeLineCap: "round",
            strokeLineJoin: "round",
            fill: "",
            selectable: false,
            evented: false,
          });

          fabricRef.current.add(path);
          fabricRef.current.renderAll();
        }
      };

      // Обработка движения курсоров
      const handleCursorMove = (position: CursorPosition) => {
        updateCursor(position.username, position.x, position.y);
      };

      // Обработка очистки холста
      const handleClearCanvas = () => {
        clearCanvas();
      };

      // Обработка подключения новых пользователей
      const handleUserConnected = (newUsername: string) => {
        // Запрашиваем позицию у нового пользователя
        socket.emit("requestCursorPosition", roomId, newUsername);
      };

      // Обработка запроса позиции
      const handleRequestCursorPosition = (requestedUsername: string) => {
        if (requestedUsername !== username) return;

        // Отправляем последнюю известную позицию
        const myPos = lastPositionRef.current[username] || {
          x: fabricRef.current?.width! / 2,
          y: fabricRef.current?.height! / 2,
        };

        socket.emit("cursorMove", {
          roomId,
          x: myPos.x,
          y: myPos.y,
          username,
        });
      };

      // Обработка отключения пользователей
      const handleUserDisconnected = (disconnectedUsername: string) => {
        if (fabricRef.current && userCursorsRef.current[disconnectedUsername]) {
          fabricRef.current.remove(userCursorsRef.current[disconnectedUsername]);
          delete userCursorsRef.current[disconnectedUsername];
          delete lastPositionRef.current[disconnectedUsername];
          delete lastUpdateTimeRef.current[disconnectedUsername];
          fabricRef.current.requestRenderAll();
        }
      };

      // Таймер для скрытия неактивных курсоров
      const cursorCheckInterval = setInterval(() => {
        const now = Date.now();
        Object.entries(lastUpdateTimeRef.current).forEach(([user, lastUpdate]) => {
          if (user !== username && now - lastUpdate > 5000) {
            if (fabricRef.current && userCursorsRef.current[user]) {
              userCursorsRef.current[user].set({ visible: false });
              fabricRef.current.requestRenderAll();
            }
          }
        });
      }, 1000);

      // Подписка на события
      socket.on("gameUpdate", handleGameUpdate);
      socket.on("cursorMove", handleCursorMove);
      socket.on("clearCanvas", handleClearCanvas);
      socket.on("userConnected", handleUserConnected);
      socket.on("requestCursorPosition", handleRequestCursorPosition);
      socket.on("userDisconnected", handleUserDisconnected);

      return () => {
        clearInterval(cursorCheckInterval);

        if (fabricRef.current) {
          fabricRef.current.off("path:created", handlePathCreated);
          fabricRef.current.off("mouse:move", handleMouseMove);
          fabricRef.current.dispose();
        }

        socket.off("gameUpdate", handleGameUpdate);
        socket.off("cursorMove", handleCursorMove);
        socket.off("clearCanvas", handleClearCanvas);
        socket.off("userConnected", handleUserConnected);
        socket.off("requestCursorPosition", handleRequestCursorPosition);
        socket.off("userDisconnected", handleUserDisconnected);
      };
    } catch (error) {
      console.error("Canvas initialization error:", error);
    }
  }, [socket, username, roomId]);

  useEffect(() => {
    if (fabricRef.current) {
      fabricRef.current.freeDrawingBrush.color = brushColor;
      fabricRef.current.freeDrawingBrush.width = brushSize;
    }
  }, [brushColor, brushSize]);

  return (
    <div className="game-area">
      <div className="canvas-container">
        <canvas ref={canvasRef} width={800} height={500} className="drawing-canvas" />
      </div>

      <div className="drawing-controls">
        <div className="control-group">
          <label>Цвет кисти:</label>
          <input type="color" value={brushColor} onChange={(e) => setBrushColor(e.target.value)} />
        </div>

        <div className="control-group">
          <label>Размер кисти:</label>
          <input type="range" min="1" max="20" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} />
          <span>{brushSize}px</span>
        </div>

        <button
          onClick={() => {
            if (socket) {
              socket.emit("clearCanvas", roomId);
            }
          }}
          className="clear-button"
        >
          Очистить холст
        </button>
      </div>
    </div>
  );
};
