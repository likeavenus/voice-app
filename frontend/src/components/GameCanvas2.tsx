import * as fabric from "fabric";
import { useEffect, useRef, useState } from "react";
import io, { Socket } from "socket.io-client";

type GameEvent = {
  type: string;
  data: any;
  roomId: string;
  userId: string; // Добавляем идентификатор пользователя
};

type CursorPosition = {
  userId: string;
  username: string;
  x: number;
  y: number;
  color: string;
};

export const GameCanvas = ({ roomId, username }: { roomId: string; username: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const [brushColor, setBrushColor] = useState("#ff0000");
  const [brushSize, setBrushSize] = useState(5);
  const userCursorsRef = useRef<{ [userId: string]: fabric.Text }>({});
  const cursorColors: { [userId: string]: string } = {};

  console.log("INITIAL: ", username);

  // Генерация уникального цвета для каждого пользователя
  const getCursorColor = (userId: string) => {
    if (!cursorColors[userId]) {
      const colors = ["#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF"];
      cursorColors[userId] = colors[Object.keys(cursorColors).length % colors.length];
    }
    return cursorColors[userId];
  };

  useEffect(() => {
    const newSocket = io(import.meta.env.VITE_SERVER_URL);

    newSocket.on("connect", () => {
      console.log("Socket connected:", newSocket.id);
      newSocket.emit("joinRoom", roomId, username); // Отправляем имя пользователя
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [roomId, username]);

  useEffect(() => {
    if (!canvasRef.current || !socket) return;

    try {
      // Инициализация холста
      const canvas = new fabric.Canvas(canvasRef.current, {
        isDrawingMode: true,
        width: 800,
        height: 500,
        backgroundColor: "#FFFFFF",
        selection: false,
      });

      fabricRef.current = canvas;

      // Настройка кисти
      const brush = new fabric.PencilBrush(canvas);
      brush.width = brushSize;
      brush.color = brushColor;
      canvas.freeDrawingBrush = brush;

      // Обработка рисования
      const handlePathCreated = (e: fabric.IEvent) => {
        if (!e.path) return;

        const path = e.path;
        const pathData = path.toObject();

        // Отправляем событие с идентификатором пользователя
        socket.emit("gameEvent", {
          type: "DRAW",
          data: pathData,
          roomId,
          userId: username, // Добавляем имя пользователя
        });
      };

      canvas.on("path:created", handlePathCreated);

      let lastMove = 0;
      const handleMouseMove = (e: fabric.IEvent) => {
        if (e.pointer && Date.now() - lastMove > 50) {
          lastMove = Date.now();
          socket.emit("cursorMove", {
            roomId,
            userId: username,
            x: e.pointer.x,
            y: e.pointer.y,
            username: username, // Добавляем имя пользователя
          });
        }
      };

      // Обработка движения мыши
      canvas.on("mouse:move", handleMouseMove);

      // Обработка входящих событий
      const handleGameUpdate = (data: GameEvent) => {
        if (data.type === "DRAW" && fabricRef.current) {
          // Восстанавливаем путь с учетом кисти
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
        if (!fabricRef.current) return;
        console.log("position: ", position);
        // Используем socket.id в качестве userId, если нет в position
        const userId = position.userId || socket?.id || "unknown";
        const username = position.username || "Anonymous";

        // console.log("username: ", username);
        console.log("userCursorsRef.current: ", userCursorsRef.current);

        const cursorColor = getCursorColor(userId);

        if (userCursorsRef.current[userId]) {
          const cursor = userCursorsRef.current[userId];
          cursor.set({
            left: position.x + 15,
            top: position.y - 15,
          });
          userCursorsRef.current[userId] = cursor;
          fabricRef.current.add(cursor);
          console.log("cursor 1: ", cursor);
        } else {
          // Исправлено: используем fabric.Text вместо FabricText
          const cursor = new fabric.FabricText(username, {
            left: position.x + 15,
            top: position.y - 15,
            fontSize: 16,
            fill: cursorColor,
            fontWeight: "normal",
            fontFamily: "Comic Sans",
            selectable: false,
            evented: false,
          });

          userCursorsRef.current[userId] = cursor;
          fabricRef.current.add(cursor);

          console.log("cursor 2: ", cursor);
          fabricRef.current.requestRenderAll();
        }
      };

      socket.on("gameUpdate", handleGameUpdate);
      socket.on("cursorMove", (position) => {
        handleCursorMove(position);
      });

      // Обработка отключения пользователей
      const handleUserDisconnected = (userId: string) => {
        if (fabricRef.current && userCursorsRef.current[userId]) {
          fabricRef.current.remove(userCursorsRef.current[userId]);
          delete userCursorsRef.current[userId];
          fabricRef.current.renderAll();
        }
      };

      socket.on("userDisconnected", handleUserDisconnected);

      // Запрос текущего состояния холста при подключении
      socket.emit("requestCanvasState", roomId);

      // Обработка запроса состояния холста
      socket.on("canvasState", (state: fabric.Object[]) => {
        if (!fabricRef.current) return;

        state.forEach((objData) => {
          if (objData.type === "path") {
            const path = new fabric.Path(objData.path, {
              stroke: objData.stroke || brushColor,
              strokeWidth: objData.strokeWidth || brushSize,
              strokeLineCap: "round",
              strokeLineJoin: "round",
              fill: "",
              selectable: false,
              evented: false,
            });

            fabricRef.current?.add(path);
          }
        });

        fabricRef.current.renderAll();
      });

      return () => {
        canvas.off("path:created", handlePathCreated);
        canvas.off("mouse:move", handleMouseMove);
        socket.off("gameUpdate", handleGameUpdate);
        socket.off("cursorMove", handleCursorMove);
        socket.off("userDisconnected", handleUserDisconnected);
        canvas.dispose();
      };
    } catch (error) {
      console.error("Canvas initialization error:", error);
    }
  }, [roomId, socket, username, Object.keys(userCursorsRef?.current)?.length]);

  // Обновление кисти при изменении параметров
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
            if (fabricRef.current) {
              fabricRef.current.clear();
              fabricRef.current.backgroundColor = "#FFFFFF";
              // Очищаем курсоры
              Object.values(userCursorsRef.current).forEach((cursor) => {
                fabricRef.current?.remove(cursor);
              });
              userCursorsRef.current = {};
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
