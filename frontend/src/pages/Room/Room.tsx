import { useState } from "react";
import { useParams } from "react-router-dom";
import { LiveKitRoom, VideoConference, useParticipants, RoomContext, ControlBar } from "@livekit/components-react";
// import { GameCanvas } from "../../components/GameCanvas";
// import { GameCanvas } from "../../components/GameCanvas2";
// import { GameCanvas } from "../../components/GameCanvas3";
import { GameCanvas } from "../../components/GameCanvas4";

import { getToken } from "../../api";
import "@livekit/components-styles";
import "./styles.css";
import { Room } from "livekit-client";
import { VideoConferenceCustom } from "../../components/VideoConferenceCustom/VideoConferenceCustom";

export const RoomPage = () => {
  const { roomId } = useParams();
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [room] = useState(() => new Room({}));

  const fetchToken = async () => {
    if (!roomId || !username) return;

    setIsConnecting(true);
    try {
      const token = await getToken(roomId, username);
      setToken(token);
    } catch (error) {
      console.error("Failed to get token:", error);
      alert("Failed to join room. Please try again.");
    } finally {
      setIsConnecting(false);
    }
  };

  if (!token) {
    return (
      <div className="username-prompt">
        <input
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              fetchToken();
            }
          }}
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter your name"
          disabled={isConnecting}
        />
        <button onClick={fetchToken} disabled={isConnecting}>
          {isConnecting ? "Joining..." : "Join Room"}
        </button>
      </div>
    );
  }

  return (
    <RoomContext.Provider value={room}>
      <LiveKitRoom token={token} serverUrl={import.meta.env.VITE_LIVEKIT_URL} connect={true} onDisconnected={() => setToken(null)}>
        <RoomContent roomId={roomId!} username={username} />
      </LiveKitRoom>
    </RoomContext.Provider>
  );
};

const A_COLORS = ["#6366f1", "6366f1", "#f44336", "#673ab7"];

const RoomContent = ({ roomId, username }: { roomId: string; username: string }) => {
  // Получаем список всех участников
  const participants = useParticipants();
  console.log("participants: ", participants);

  return (
    <div className="room-container">
      <div className="voice-section">
        {/* <VideoConference SettingsComponent={Settings} /> */}
        <VideoConferenceCustom />

        {/* Панель участников */}
        <div className="participants-panel">
          <h3>Участники ({participants.length})</h3>
          <div className="participants-list">
            {participants.map((participant, i) => (
              <div
                key={participant.identity}
                className="participant-item"
                style={{ border: participant.isSpeaking ? "1px solid #4CAF50" : "1px solid white" }}
              >
                <div className="participant-avatar" style={{ backgroundColor: A_COLORS[0] }}>
                  {participant.identity.charAt(0).toUpperCase()}
                </div>
                <div className="participant-info">
                  <span className="participant-name">
                    {participant.identity}
                    {participant.isLocal && " (You)"}
                  </span>
                  <div className="status-box">
                    {participant.isMicrophoneEnabled ? (
                      <span className="voice-status">🎤</span>
                    ) : (
                      <span className="voice-status" style={{ textDecoration: "line-through" }}>
                        🎤
                      </span>
                    )}
                  </div>
                  <div className="participant-status">
                    {participant.isSpeaking && (
                      <div className="speaking-indicator">
                        <div className="circle-indicator"></div> Speaking
                      </div>
                    )}
                    {/* {participant.connectionQuality && <span className="connection-quality">Connection: {participant.connectionQuality}</span>} */}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="game-section">
          <GameCanvas roomId={roomId} username={username} />
        </div>
      </div>
    </div>
  );
};
