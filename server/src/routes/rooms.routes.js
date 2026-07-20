import { Router } from "express";

import {
  createRoom,
  joinRoom,
  leaveRoom,
  restoreRoomSession,
  resetRoomGame,
  selectSecretItem,
  startRoomGame,
  submitFinalGuess,
  updatePlayerGameState,
} from "../controllers/rooms.controller.js";

const roomsRouter = Router();

roomsRouter.post(
  "/",
  createRoom,
);

roomsRouter.post(
  "/:roomCode/join",
  joinRoom,
);

roomsRouter.get(
  "/:roomCode/session",
  restoreRoomSession,
);

roomsRouter.post(
  "/:roomCode/secret",
  selectSecretItem,
);

roomsRouter.post(
  "/:roomCode/start",
  startRoomGame,
);

roomsRouter.post(
  "/:roomCode/reset",
  resetRoomGame,
);

roomsRouter.patch(
  "/:roomCode/state",
  updatePlayerGameState,
);

roomsRouter.post(
  "/:roomCode/final-guess",
  submitFinalGuess,
);

roomsRouter.delete(
  "/:roomCode/leave",
  leaveRoom,
);

export default roomsRouter;