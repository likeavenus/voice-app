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
  userId: string;
  username: string;
  x: number;
  y: number;
};

// Приятная пастельная палитра
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
  const [brushColor, setBrushColor] = useState("#4A90E2"); // Приятный синий
  const [brushSize, setBrushSize] = useState(5);
  const userCursorsRef = useRef<{ [userId: string]: fabric.Text }>({});
  const cursorColorsRef = useRef<{ [userId: string]: string }>({});

  // Генерация уникального цвета для каждого пользователя
  const getCursorColor = (userId: string) => {
    if (!cursorColorsRef.current[userId]) {
      const colorIndex = Object.keys(cursorColorsRef.current).length % CURSOR_COLORS.length;
      cursorColorsRef.current[userId] = CURSOR_COLORS[colorIndex];
    }

    console.log("cursorColorsRef: ", cursorColorsRef);
    return cursorColorsRef.current[userId];
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

    // Удаляем только объекты, не являющиеся курсорами
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

        socket.emit("gameEvent", {
          type: "DRAW",
          data: pathData,
          roomId,
          userId: username,
        });
      };

      canvas.on("path:created", handlePathCreated);

      const updateMyCursor = (userId: string, name: string, x: number, y: number) => {
        if (!fabricRef.current) return;

        const cursorColor = getCursorColor(userId);
        const isLocalUser = name === username;
        console.log(Object.keys(userCursorsRef.current)?.length);
        // Если курсор существует - обновляем позицию
        if (userCursorsRef.current[userId]) {
          const cursor = userCursorsRef.current[userId];
          cursor.set({
            left: x + 15,
            top: y - 15,
            visible: true, // Убедимся, что курсор видим
          });
        }
        // Создаем новый курсор
        else {
          const displayName = isLocalUser ? `${name} (You)` : name;
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

          userCursorsRef.current[userId] = cursor;
          fabricRef.current.add(cursor);
        }

        fabricRef.current.requestRenderAll();
      };

      // Обработка движения мыши (с дебаунсом)
      let lastMove = 0;
      const handleMouseMove = (e: fabric.IEvent) => {
        if (!e.pointer) return;

        // Всегда обновляем свой курсор
        updateMyCursor(username, username, e.pointer.x, e.pointer.y);

        // Отправляем событие на сервер с троттлингом
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
      updateMyCursor(username, username, canvas.width! / 2, canvas.height! / 2);

      // Функция для обновления своего курсора

      //   const updateMyCursor = (x: number, y: number) => {
      //     if (!fabricRef.current) return;

      //     const myUserId = "me"; // Идентификатор для своего курсора
      //     const cursorColor = getCursorColor(myUserId);

      //     const createCursor = (text: string, x: number, y: number, color: string) => {
      //       return new fabric.FabricText(text, {
      //         left: x + 15,
      //         top: y - 15,
      //         fontSize: 14,
      //         fill: color,
      //         fontWeight: "bold",
      //         shadow: "rgba(0,0,0,0.3) 1px 1px 2px",
      //         selectable: false,
      //         evented: false,
      //         isCursor: true, // 🔴 Помечаем как курсор
      //       });
      //     };

      //     if (!userCursorsRef.current[myUserId]) {
      //       const cursor = createCursor(username, x, y, cursorColor);
      //       userCursorsRef.current[myUserId] = cursor;
      //       fabricRef.current.add(cursor);
      //     }

      //     fabricRef.current.requestRenderAll();

      //     // if (userCursorsRef.current[myUserId]) {
      //     //   const cursor = userCursorsRef.current[myUserId];
      //     //   cursor.set({
      //     //     left: x + 15,
      //     //     top: y - 15,
      //     //   });
      //     // } else {
      //     //   const cursor = new fabric.FabricText(username, {
      //     //     left: x + 15,
      //     //     top: y - 15,
      //     //     fontSize: 14,
      //     //     fill: cursorColor,
      //     //     fontWeight: "bold",
      //     //     shadow: "rgba(0,0,0,0.3) 1px 1px 2px",
      //     //     selectable: false,
      //     //     evented: false,
      //     //   });

      //     //   userCursorsRef.current[myUserId] = cursor;
      //     //   fabricRef.current.add(cursor);
      //     // }
      //     // fabricRef.current.requestRenderAll();
      //   };

      // Обработка входящих событий рисования

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
      // Обработка движения курсоров других пользователей
      //   const handleCursorMove = (position: CursorPosition) => {
      //     if (!fabricRef.current) return;

      //     // Пропускаем свои события
      //     if (position.username === username) return;

      //     const userId = position.username; // Используем имя как ID
      //     const cursorColor = getCursorColor(userId);

      //     if (userCursorsRef.current[userId]) {
      //       const cursor = userCursorsRef.current[userId];
      //       cursor.set({
      //         left: position.x + 15,
      //         top: position.y - 15,
      //       });
      //     } else {
      //       const cursor = new fabric.Text(position.username, {
      //         left: position.x + 15,
      //         top: position.y - 15,
      //         fontSize: 14,
      //         fill: cursorColor,
      //         fontWeight: "bold",
      //         shadow: "rgba(0,0,0,0.3) 1px 1px 2px",
      //         selectable: false,
      //         evented: false,
      //       });

      //       userCursorsRef.current[userId] = cursor;
      //       fabricRef.current.add(cursor);
      //     }

      //     fabricRef.current.requestRenderAll();
      //   };
      const handleCursorMove = (position: CursorPosition) => {
        // Для чужих курсоров используем username как ID
        updateMyCursor(position.username, position.username, position.x, position.y);
      };

      const handleClearCanvas = () => {
        clearCanvas();
      };

      socket.on("gameUpdate", handleGameUpdate);
      socket.on("cursorMove", handleCursorMove);
      socket.on("clearCanvas", handleClearCanvas);

      const handleUserConnected = (newUsername: string) => {
        // Запрашиваем позицию у нового пользователя
        socket.emit("requestCursorPosition", roomId, newUsername);
      };

      const handleRequestCursorPosition = (requestedUsername: string) => {
        if (requestedUsername !== username) return;

        // Отправляем текущую позицию
        const canvas = fabricRef.current;
        if (canvas && canvas.upperCanvasEl) {
          const rect = canvas.upperCanvasEl.getBoundingClientRect();
          socket.emit("cursorMove", {
            roomId,
            x: rect.width / 2,
            y: rect.height / 2,
            username,
          });
        }
      };

      // Обработка отключения пользователей
      const handleUserDisconnected = (disconnectedUsername: string) => {
        if (fabricRef.current && userCursorsRef.current[disconnectedUsername]) {
          fabricRef.current.remove(userCursorsRef.current[disconnectedUsername]);
          delete userCursorsRef.current[disconnectedUsername];
          fabricRef.current.requestRenderAll();
        }
      };

      socket.on("userConnected", handleUserConnected);
      socket.on("requestCursorPosition", handleRequestCursorPosition);
      socket.on("userDisconnected", handleUserDisconnected);

      return () => {
        if (fabricRef.current) {
          fabricRef.current.off("path:created", handlePathCreated);
          fabricRef.current.off("mouse:move", handleMouseMove);
          fabricRef.current.dispose();
        }
        socket.off("gameUpdate", handleGameUpdate);
        socket.off("cursorMove", handleCursorMove);
        socket.off("userDisconnected", handleUserDisconnected);
        socket.off("clearCanvas", handleClearCanvas); // 🔴 Очищаем обработчик
        socket.off("userConnected", handleUserConnected);
        socket.off("requestCursorPosition", handleRequestCursorPosition);
      };
    } catch (error) {
      console.error("Canvas initialization error:", error);
    }
  }, [socket, username, userCursorsRef?.current]); // Убраны лишние зависимости

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
              socket?.emit("clearCanvas", roomId);
              // Очищаем только чужие курсоры
              Object.entries(userCursorsRef.current).forEach(([userId, cursor]) => {
                if (userId !== "me") {
                  fabricRef.current?.remove(cursor);
                  delete userCursorsRef.current[userId];
                }
              });
              fabricRef.current.requestRenderAll();
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
