const API_BASE_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

export const createRoom = async (roomName: string): Promise<string> => {
  try {
    const response = await fetch(`${API_BASE_URL}/create-room`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ roomName }),
    });

    if (!response.ok) {
      throw new Error("Failed to create room");
    }

    const data = await response.json();
    return data.roomId;
  } catch (error) {
    console.error("Error creating room:", error);
    throw error;
  }
};

export const getToken = async (roomId: string, username: string): Promise<string> => {
  try {
    const response = await fetch(`${API_BASE_URL}/get-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomName: roomId, username }),
    });

    console.log("Token response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server error: ${errorText}`);
    }

    const data = await response.json();
    console.log("Token response data:", data);

    return data.token;
  } catch (error) {
    console.error("Error getting token:", error);
    throw error;
  }
};
