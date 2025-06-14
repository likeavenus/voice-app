import * as fabric from "fabric";
import { useState, useEffect, useRef } from "react";
import io, { Socket } from "socket.io-client";

type GameEvent = {
  type: string;
  data: any;
  roomId: string;
};

export const GameCanvas = ({ roomId }: { roomId: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const [brushColor, setBrushColor] = useState("#ff0000");
  const [brushSize, setBrushSize] = useState(5);

  useEffect(() => {
    const newSocket = io(import.meta.env.VITE_SERVER_URL);

    // Логирование сокет-событий для отладки
    newSocket.on("connect", () => {
      console.log("Socket connected:", newSocket.id);
      newSocket.emit("joinRoom", roomId);
      console.log(`Joined room: ${roomId}`);
    });

    newSocket.on("disconnect", () => {
      console.log("Socket disconnected");
    });

    newSocket.on("connect_error", (err) => {
      console.error("Socket connection error:", err);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [roomId]);

  useEffect(() => {
    if (!canvasRef.current || !socket) return;

    console.log("Initializing Fabric canvas...");

    try {
      const canvas = new fabric.Canvas(canvasRef.current, {
        isDrawingMode: true,
        width: 800,
        height: 500,
        backgroundColor: "#FFFFFF",
        selection: false,
      });
      console.log("canvas:", canvas);
      const brush = new fabric.PencilBrush(canvas);
      brush.width = brushSize;
      brush.color = brushColor;

      // Настройка кисти
      canvas.freeDrawingBrush = brush;
      fabricRef.current = canvas;

      // Обработка рисования
      const handlePathCreated = (e: fabric.IEvent) => {
        console.log("handlePathCreated", e);

        if (!e.path) return;

        const path = e.path;
        const pathData = path.toObject();

        console.log("Sending draw event:", pathData);

        socket.emit("gameEvent", {
          type: "DRAW",
          data: pathData,
          roomId,
        } as GameEvent);
      };

      canvas.on("path:created", handlePathCreated);

      // Слушаем события от других игроков

      const handleGameUpdate = (data: GameEvent) => {
        if (data.type === "DRAW" && fabricRef.current) {
          console.log("Adding path to canvas", data);
          console.log("fabricRef.current", fabricRef.current);
          const origRenderOnAddRemove = fabricRef.current.renderOnAddRemove;
          fabricRef.current.renderOnAddRemove = false;

          // Ключевое исправление: используем fabric.util.enlivenObjects
          fabric.util.enlivenObjects(
            [data.data],
            (objects) => {
              console.log("objects: ", objects);
              objects.forEach((obj) => {
                // Устанавливаем свойства объекта
                obj.selectable = false;
                obj.evented = false;

                // Добавляем объект на холст
                fabricRef.current?.add(obj);
              });
              fabricRef.current.renderOnAddRemove = origRenderOnAddRemove;
              // Рендерим все изменения
              fabricRef.current?.renderAll();
            },
            "fabric" // Пространство имен для корректной десериализации
          );
        }
      };

      socket.on("gameUpdate", handleGameUpdate);

      return () => {
        console.log("Cleaning up canvas");
        canvas.off("path:created", handlePathCreated);
        socket.off("gameUpdate", handleGameUpdate);
        canvas.dispose();
      };
    } catch (error) {
      console.error("Canvas initialization error:", error);
    }
  }, [socket]);

  return (
    <div className="game-area">
      <div className="canvas-container">
        <canvas ref={canvasRef} width={800} height={500} className="drawing-canvas" />
      </div>

      <div className="drawing-controls">
        <div className="control-group">
          <label>Цвет кисти:</label>
          <input
            type="color"
            value={brushColor}
            onChange={(e) => {
              setBrushColor(e.target.value);
              if (fabricRef.current) {
                fabricRef.current.freeDrawingBrush.color = e.target.value;
              }
            }}
          />
        </div>

        <div className="control-group">
          <label>Размер кисти:</label>
          <input
            type="range"
            min="1"
            max="20"
            value={brushSize}
            onChange={(e) => {
              const size = parseInt(e.target.value);
              setBrushSize(size);
              if (fabricRef.current) {
                fabricRef.current.freeDrawingBrush.width = size;
              }
            }}
          />
          <span>{brushSize}px</span>
        </div>

        <button
          onClick={() => {
            if (fabricRef.current) {
              fabricRef.current.clear();
              fabricRef.current.backgroundColor = "#f8f9fa";
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
