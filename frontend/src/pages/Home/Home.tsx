// src/pages/Home.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createRoom } from "../../api"; // Теперь путь правильный
import "./styles.css";

export const HomePage = () => {
  const [roomName, setRoomName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const navigate = useNavigate();

  const handleCreateRoom = async () => {
    if (!roomName.trim()) return;

    setIsCreating(true);
    try {
      const roomId = await createRoom(roomName);
      navigate(`/room/${roomId}`);
    } catch (error) {
      console.error("Error creating room:", error);
      alert("Failed to create room. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="home-container">
      <h1>🎤 Voice Party 🎨</h1>
      <div className="create-form">
        <input value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="Enter room name" disabled={isCreating} />
        <button onClick={handleCreateRoom} disabled={isCreating || !roomName.trim()}>
          {isCreating ? "Creating..." : "Create Room"}
        </button>
      </div>

      <div className="features">
        <h2>How it works:</h2>
        <ol>
          <li>Create a room and share the link with friends</li>
          <li>Join voice chat and see each other</li>
          <li>Play drawing games together in real-time</li>
        </ol>
      </div>
    </div>
  );
};
