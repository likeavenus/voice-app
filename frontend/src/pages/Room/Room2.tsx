import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { LiveKitRoom, RoomAudioRenderer, VideoConference, VideoTrack, useParticipants, useTracks } from "@livekit/components-react";
// import { GameCanvas } from "../../components/GameCanvas";
// import { GameCanvas } from "../../components/GameCanvas2";
// import { GameCanvas } from "../../components/GameCanvas3";
import { GameCanvas } from "../../components/GameCanvas4";

import { getToken } from "../../api";
import "@livekit/components-styles";
import "./styles.css";
import { Track } from "livekit-client";

export const RoomPage = () => {
  const { roomId } = useParams();
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);

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
        <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter your name" disabled={isConnecting} />
        <button onClick={fetchToken} disabled={isConnecting}>
          {isConnecting ? "Joining..." : "Join Room"}
        </button>
      </div>
    );
  }

  return (
    <LiveKitRoom token={token} serverUrl={import.meta.env.VITE_LIVEKIT_URL} connect={true} onDisconnected={() => setToken(null)}>
      <RoomContent roomId={roomId!} username={username} />
    </LiveKitRoom>
  );
};

const A_COLORS = ["#6366f1", "6366f1", "#f44336", "#673ab7"];

const RoomContent = ({ roomId, username }: { roomId: string; username: string }) => {
  const participants = useParticipants();

  // Получаем все видео-треки
  const trackReferences = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);

  // Оптимизированное получение видео-треков
  const videoTracks = useMemo(
    () => trackReferences.filter(({ track }) => track?.kind === "video").map(({ participant, track }) => ({ participant, track })),
    [trackReferences]
  );

  return (
    <div className="room-container">
      <div className="voice-section">
        {/* Стандартный VideoConference с элементами управления */}
        <div className="video-conference-wrapper">
          <VideoConference />
        </div>

        {/* Дополнительный контейнер для видео в сетке */}
        <div className="video-grid-container">
          <h3>All Participants</h3>
          <div className="video-grid">
            {videoTracks.map(({ participant, track }) => (
              <div key={`${participant.identity}-${track.sid}`} className="video-item">
                <VideoTrack track={track} />
                <div className="participant-name-overlay">
                  {participant.identity}
                  {participant.isLocal && " (You)"}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Панель участников */}
        <div className="participants-panel">
          <h3>Участники ({participants.length})</h3>
          <div className="participants-list">
            {participants.map((participant) => (
              <div key={participant.identity} className="participant-item">
                <div className="participant-avatar" style={{ backgroundColor: A_COLORS[Math.floor(Math.random() * A_COLORS.length)] }}>
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
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="game-section">
        <GameCanvas roomId={roomId} username={username} />
      </div>
    </div>
  );
};
