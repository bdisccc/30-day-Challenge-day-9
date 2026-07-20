import "dotenv/config";
import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";

import {
  checkDatabaseConnection,
  pool,
} from "./config/database.js";
import roomsRouter from "./routes/rooms.routes.js";

const app = express();
const httpServer = createServer(app);

const port = Number(process.env.PORT) || 5000;
const clientOrigin =
  process.env.CLIENT_ORIGIN ||
  "http://localhost:5173";

const roomCodePattern =
  /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeRoomCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

app.use(
  cors({
    origin: clientOrigin,
    credentials: true,
  }),
);

app.use(
  express.json({
    limit: "2mb",
  }),
);

app.get("/", (request, response) => {
  response.json({
    success: true,
    message:
      "Guess the What multiplayer server",
  });
});

app.get(
  "/api/health",
  async (request, response) => {
    try {
      const databaseStatus =
        await checkDatabaseConnection();

      response.json({
        success: true,
        status: "healthy",
        service: "Guess the What API",
        database: {
          connected: true,
          name: databaseStatus.database_name,
          time: databaseStatus.database_time,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        "Health check failed:",
        error,
      );

      response.status(500).json({
        success: false,
        status: "unhealthy",
        service: "Guess the What API",
        database: {
          connected: false,
        },
        message:
          error instanceof Error
            ? error.message
            : "Unable to connect to PostgreSQL.",
        timestamp: new Date().toISOString(),
      });
    }
  },
);

const io = new Server(httpServer, {
  cors: {
    origin: clientOrigin,
    methods: ["GET", "POST", "PATCH", "DELETE"],
    credentials: true,
  },
});

app.set("io", io);
app.use("/api/rooms", roomsRouter);

io.use(async (socket, next) => {
  const roomCode = normalizeRoomCode(
    socket.handshake.auth?.roomCode,
  );
  const playerToken = String(
    socket.handshake.auth?.playerToken || "",
  ).trim();

  if (!roomCodePattern.test(roomCode)) {
    next(new Error("Invalid room code."));
    return;
  }

  if (!uuidPattern.test(playerToken)) {
    next(new Error("Invalid player session."));
    return;
  }

  try {
    const playerResult = await pool.query(
      `
        SELECT
          rp.id,
          rp.room_id,
          rp.player_name,
          rp.player_number,
          rp.is_host,
          r.status,
          r.expires_at
        FROM room_players rp
        JOIN rooms r
          ON r.id = rp.room_id
        WHERE
          r.room_code = $1 AND
          rp.player_token = $2::UUID
        LIMIT 1
      `,
      [roomCode, playerToken],
    );

    if (playerResult.rowCount === 0) {
      next(
        new Error(
          "The multiplayer session is no longer valid.",
        ),
      );
      return;
    }

    const player = playerResult.rows[0];

    if (
      player.status === "closed" ||
      new Date(player.expires_at).getTime() <=
        Date.now()
    ) {
      next(new Error("This room is closed."));
      return;
    }

    socket.data.roomCode = roomCode;
    socket.data.roomId = player.room_id;
    socket.data.playerId = player.id;
    socket.data.playerName =
      player.player_name;
    socket.data.playerNumber =
      player.player_number;
    socket.data.isHost = player.is_host;

    next();
  } catch (error) {
    console.error(
      "Socket authentication failed:",
      error,
    );

    next(
      new Error(
        "Unable to verify the multiplayer session.",
      ),
    );
  }
});

io.on("connection", async (socket) => {
  const {
    roomCode,
    roomId,
    playerId,
    playerName,
  } = socket.data;

  socket.join(roomCode);

  try {
    await pool.query(
      `
        UPDATE room_players
        SET is_connected = TRUE
        WHERE id = $1
      `,
      [playerId],
    );
  } catch (error) {
    console.error(
      "Unable to mark socket player connected:",
      error,
    );
  }

  console.log(
    `Socket connected: ${socket.id} — ${roomCode} — ${playerName}`,
  );

  socket.emit("server:ready", {
    connected: true,
    socketId: socket.id,
    roomCode,
    timestamp: new Date().toISOString(),
  });

  io.to(roomCode).emit("room:changed", {
    roomCode,
    reason: "player-connected",
    timestamp: new Date().toISOString(),
  });

  socket.on(
    "chat:send",
    async (payload = {}, acknowledge) => {
      const message = String(
        payload.message || "",
      )
        .trim()
        .replace(/\s+/g, " ");

      const respond =
        typeof acknowledge === "function"
          ? acknowledge
          : () => {};

      if (!message) {
        respond({
          success: false,
          message: "Enter a message first.",
        });
        return;
      }

      if (message.length > 400) {
        respond({
          success: false,
          message:
            "Chat messages cannot be longer than 400 characters.",
        });
        return;
      }

      const now = Date.now();
      const previousChatAt = Number(
        socket.data.lastChatAt || 0,
      );

      if (now - previousChatAt < 500) {
        respond({
          success: false,
          message:
            "Please wait a moment before sending another message.",
        });
        return;
      }

      socket.data.lastChatAt = now;

      try {
        const messageResult = await pool.query(
          `
            INSERT INTO room_chat_messages (
              room_id,
              player_id,
              player_name,
              message
            )
            VALUES ($1, $2, $3, $4)
            RETURNING
              id,
              player_id,
              player_name,
              message,
              created_at
          `,
          [
            roomId,
            playerId,
            playerName,
            message,
          ],
        );

        const savedMessage =
          messageResult.rows[0];

        const responseMessage = {
          id: savedMessage.id,
          playerId: savedMessage.player_id,
          playerName:
            savedMessage.player_name,
          message: savedMessage.message,
          createdAt: savedMessage.created_at,
        };

        io.to(roomCode).emit(
          "chat:message",
          responseMessage,
        );

        respond({
          success: true,
          message: responseMessage,
        });
      } catch (error) {
        console.error(
          "Unable to send chat message:",
          error,
        );

        respond({
          success: false,
          message:
            "Unable to send the chat message.",
        });
      }
    },
  );

  socket.on("disconnect", (reason) => {
    console.log(
      `Socket disconnected: ${socket.id} — ${reason}`,
    );

    setTimeout(async () => {
      try {
        const activeSockets =
          await io.in(roomCode).fetchSockets();

        const playerStillConnected =
          activeSockets.some(
            (activeSocket) =>
              activeSocket.data.playerId ===
              playerId,
          );

        if (!playerStillConnected) {
          await pool.query(
            `
              UPDATE room_players
              SET is_connected = FALSE
              WHERE id = $1
            `,
            [playerId],
          );

          io.to(roomCode).emit(
            "room:changed",
            {
              roomCode,
              reason: "player-disconnected",
              timestamp:
                new Date().toISOString(),
            },
          );
        }
      } catch (error) {
        console.error(
          "Unable to mark socket player disconnected:",
          error,
        );
      }
    }, 0);
  });
});

httpServer.listen(port, () => {
  console.log(
    `Guess the What API running at http://localhost:${port}`,
  );
  console.log(
    `Frontend origin: ${clientOrigin}`,
  );
});

async function shutdownServer(signal) {
  console.log(
    `\n${signal} received. Closing server...`,
  );

  io.close();

  httpServer.close(async () => {
    try {
      await pool.end();
      console.log("PostgreSQL pool closed.");
      process.exit(0);
    } catch (error) {
      console.error(
        "Error during server shutdown:",
        error,
      );

      process.exit(1);
    }
  });
}

process.on("SIGINT", () => {
  shutdownServer("SIGINT");
});

process.on("SIGTERM", () => {
  shutdownServer("SIGTERM");
});
