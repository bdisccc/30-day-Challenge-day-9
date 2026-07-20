import { io } from "socket.io-client";

import { getMultiplayerApiUrl } from "./multiplayerApi";

export function connectMultiplayerSocket(session) {
  const roomCode = String(
    session?.room?.code || "",
  )
    .trim()
    .toUpperCase();

  const playerToken = String(
    session?.player?.token || "",
  ).trim();

  if (!roomCode || !playerToken) {
    throw new Error(
      "The multiplayer session is incomplete.",
    );
  }

  return io(getMultiplayerApiUrl(), {
    autoConnect: true,
    transports: ["websocket", "polling"],
    auth: {
      roomCode,
      playerToken,
    },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 700,
    reconnectionDelayMax: 4000,
    timeout: 10000,
  });
}
