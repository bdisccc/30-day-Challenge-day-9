import { pool } from "../config/database.js";
import { generateRoomCode } from "../utils/roomCode.js";

const supportedBoardSizes = new Set([
  8,
  12,
  16,
  20,
  24,
]);

const supportedBoardTypes = new Set([
  "standard",
  "custom",
]);

const maximumRoomCodeAttempts = 12;
const roomCodePattern =
  /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeRoomCode(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function normalizePlayerName(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeItemId(value) {
  return String(value || "").trim();
}

function getPlayerToken(request) {
  const token = String(
    request.get("x-player-token") || "",
  ).trim();

  return uuidPattern.test(token) ? token : "";
}

function getClientOrigin() {
  return (
    process.env.CLIENT_ORIGIN ||
    "http://localhost:5173"
  );
}

function createJoinUrl(roomCode) {
  const joinUrl = new URL(getClientOrigin());

  joinUrl.searchParams.set("room", roomCode);

  return joinUrl.toString();
}

function validateBoardSnapshot(boardSnapshot) {
  if (
    !boardSnapshot ||
    typeof boardSnapshot !== "object" ||
    Array.isArray(boardSnapshot)
  ) {
    return "A valid board snapshot is required.";
  }

  if (!Array.isArray(boardSnapshot.items)) {
    return "The board snapshot must contain an items array.";
  }

  if (
    !supportedBoardSizes.has(
      boardSnapshot.items.length,
    )
  ) {
    return (
      "The board must contain exactly " +
      "8, 12, 16, 20, or 24 items."
    );
  }

  const invalidItem = boardSnapshot.items.find(
    (item) =>
      !item ||
      typeof item !== "object" ||
      !String(item.id || "").trim() ||
      !String(item.name || "").trim(),
  );

  if (invalidItem) {
    return "Every board item must have an ID and name.";
  }

  const itemIds = boardSnapshot.items.map((item) =>
    String(item.id).trim(),
  );

  if (new Set(itemIds).size !== itemIds.length) {
    return "Board item IDs must be unique.";
  }

  return null;
}

function validateCreateRoomRequest(requestBody) {
  const {
    hostName,
    boardType,
    boardId,
    boardSnapshot,
  } = requestBody;

  const normalizedHostName =
    normalizePlayerName(hostName);

  if (!normalizedHostName) {
    return {
      error: "Enter a host name.",
    };
  }

  if (normalizedHostName.length > 40) {
    return {
      error:
        "The host name cannot be longer than 40 characters.",
    };
  }

  if (!supportedBoardTypes.has(boardType)) {
    return {
      error:
        'Board type must be either "standard" or "custom".',
    };
  }

  if (
    boardId !== undefined &&
    boardId !== null &&
    typeof boardId !== "string"
  ) {
    return {
      error: "Board ID must be a string.",
    };
  }

  if (
    typeof boardId === "string" &&
    boardId.length > 120
  ) {
    return {
      error:
        "Board ID cannot be longer than 120 characters.",
    };
  }

  const boardError =
    validateBoardSnapshot(boardSnapshot);

  if (boardError) {
    return {
      error: boardError,
    };
  }

  return {
    value: {
      hostName: normalizedHostName,
      boardType,
      boardId:
        typeof boardId === "string" &&
        boardId.trim()
          ? boardId.trim()
          : null,
      boardSnapshot,
    },
  };
}

function emitRoomChanged(
  request,
  roomCode,
  reason,
) {
  const io = request.app.get("io");

  if (!io) {
    return;
  }

  io.to(roomCode).emit("room:changed", {
    roomCode,
    reason,
    timestamp: new Date().toISOString(),
  });
}

function mapPlayerRow(player, boardSize) {
  const eliminatedCount = Number(
    player.eliminated_count || 0,
  );

  return {
    id: player.id,
    name: player.player_name,
    number: player.player_number,
    isHost: player.is_host,
    isReady: player.is_ready,
    isConnected: player.is_connected,
    hasSecret: player.has_secret,
    standingCount: Math.max(
      boardSize - eliminatedCount,
      0,
    ),
    result: player.game_result || null,
    joinedAt: player.joined_at,
  };
}

async function closeExpiredRoom(
  databaseClient,
  room,
) {
  if (!room.is_expired) {
    return room;
  }

  await databaseClient.query(
    `
      UPDATE rooms
      SET
        status = 'closed',
        updated_at = NOW()
      WHERE id = $1
    `,
    [room.id],
  );

  return {
    ...room,
    status: "closed",
  };
}

async function getRoomAndPlayer(
  databaseClient,
  roomCode,
  playerToken,
  { forUpdate = false } = {},
) {
  if (!roomCodePattern.test(roomCode)) {
    return {
      error: {
        status: 400,
        message: "Invalid room code.",
      },
    };
  }

  if (!uuidPattern.test(playerToken)) {
    return {
      error: {
        status: 401,
        message: "Your player session is missing.",
      },
    };
  }

  const roomResult = await databaseClient.query(
    `
      SELECT
        id,
        room_code,
        board_type,
        board_id,
        board_snapshot,
        status,
        max_players,
        created_at,
        updated_at,
        expires_at,
        expires_at <= NOW() AS is_expired
      FROM rooms
      WHERE room_code = $1
      ${forUpdate ? "FOR UPDATE" : ""}
    `,
    [roomCode],
  );

  if (roomResult.rowCount === 0) {
    return {
      error: {
        status: 404,
        message: "Room not found.",
      },
    };
  }

  const room = await closeExpiredRoom(
    databaseClient,
    roomResult.rows[0],
  );

  if (room.status === "closed") {
    return {
      error: {
        status: 410,
        message: room.is_expired
          ? "This room has expired."
          : "This room is closed.",
      },
    };
  }

  const playerResult = await databaseClient.query(
    `
      SELECT
        id,
        player_token,
        player_name,
        player_number,
        is_host,
        is_ready,
        is_connected,
        joined_at
      FROM room_players
      WHERE
        room_id = $1 AND
        player_token = $2::UUID
    `,
    [room.id, playerToken],
  );

  if (playerResult.rowCount === 0) {
    return {
      error: {
        status: 401,
        message:
          "Your saved multiplayer session is no longer valid.",
      },
    };
  }

  return {
    room,
    player: playerResult.rows[0],
  };
}

async function buildRoomSession(
  databaseClient,
  roomCode,
  playerToken,
) {
  const authenticated = await getRoomAndPlayer(
    databaseClient,
    roomCode,
    playerToken,
  );

  if (authenticated.error) {
    return authenticated;
  }

  const { room, player } = authenticated;
  const boardSnapshot = room.board_snapshot;
  const boardSize = Array.isArray(
    boardSnapshot?.items,
  )
    ? boardSnapshot.items.length
    : 0;

  const playersResult = await databaseClient.query(
    `
      SELECT
        rp.id,
        rp.player_name,
        rp.player_number,
        rp.is_host,
        rp.is_ready,
        rp.is_connected,
        rp.joined_at,
        EXISTS (
          SELECT 1
          FROM online_player_secrets ops
          WHERE ops.player_id = rp.id
        ) AS has_secret,
        COALESCE(
          jsonb_array_length(opst.eliminated_item_ids),
          0
        ) AS eliminated_count,
        opst.result AS game_result
      FROM room_players rp
      LEFT JOIN online_player_states opst
        ON opst.player_id = rp.id
      WHERE rp.room_id = $1
      ORDER BY rp.player_number
    `,
    [room.id],
  );

  const players = playersResult.rows.map(
    (currentPlayer) =>
      mapPlayerRow(currentPlayer, boardSize),
  );

  const currentPlayer = players.find(
    (currentPlayerRow) =>
      currentPlayerRow.id === player.id,
  );

  const gameResult = await databaseClient.query(
    `
      SELECT
        ops.secret_item_id,
        opst.eliminated_item_ids,
        opst.final_guess_item_id,
        opst.result
      FROM room_players rp
      LEFT JOIN online_player_secrets ops
        ON ops.player_id = rp.id
      LEFT JOIN online_player_states opst
        ON opst.player_id = rp.id
      WHERE rp.id = $1
    `,
    [player.id],
  );

  const gameRow = gameResult.rows[0] || {};

  const messagesResult = await databaseClient.query(
    `
      SELECT
        id,
        player_id,
        player_name,
        message,
        created_at
      FROM (
        SELECT
          id,
          player_id,
          player_name,
          message,
          created_at
        FROM room_chat_messages
        WHERE room_id = $1
        ORDER BY created_at DESC
        LIMIT 100
      ) recent_messages
      ORDER BY created_at ASC
    `,
    [room.id],
  );

  let result = null;
  let revealedSecrets = [];

  if (room.status === "finished") {
    const resultQuery = await databaseClient.query(
      `
        SELECT
          guesser_player_id,
          winner_player_id,
          guessed_item_id,
          was_correct,
          created_at
        FROM online_room_results
        WHERE room_id = $1
      `,
      [room.id],
    );

    if (resultQuery.rowCount > 0) {
      const resultRow = resultQuery.rows[0];

      result = {
        guesserPlayerId:
          resultRow.guesser_player_id,
        winnerPlayerId:
          resultRow.winner_player_id,
        guessedItemId:
          resultRow.guessed_item_id,
        wasCorrect: resultRow.was_correct,
        createdAt: resultRow.created_at,
      };
    }

    const revealedSecretsResult =
      await databaseClient.query(
        `
          SELECT
            player_id,
            secret_item_id
          FROM online_player_secrets
          WHERE room_id = $1
        `,
        [room.id],
      );

    revealedSecrets =
      revealedSecretsResult.rows.map((secret) => ({
        playerId: secret.player_id,
        itemId: secret.secret_item_id,
      }));
  }

  return {
    room: {
      id: room.id,
      code: room.room_code,
      boardType: room.board_type,
      boardId: room.board_id,
      boardSnapshot,
      status: room.status,
      maxPlayers: room.max_players,
      createdAt: room.created_at,
      updatedAt: room.updated_at,
      expiresAt: room.expires_at,
      joinUrl: createJoinUrl(room.room_code),
    },
    player: {
      ...currentPlayer,
      token: player.player_token,
    },
    players,
    game: {
      secretItemId:
        gameRow.secret_item_id || null,
      eliminatedItemIds: Array.isArray(
        gameRow.eliminated_item_ids,
      )
        ? gameRow.eliminated_item_ids
        : [],
      finalGuessItemId:
        gameRow.final_guess_item_id || null,
      result: gameRow.result || null,
    },
    result,
    revealedSecrets,
    messages: messagesResult.rows.map((message) => ({
      id: message.id,
      playerId: message.player_id,
      playerName: message.player_name,
      message: message.message,
      createdAt: message.created_at,
    })),
  };
}

function sendSessionError(response, sessionResult) {
  return response
    .status(sessionResult.error.status)
    .json({
      success: false,
      message: sessionResult.error.message,
    });
}

export async function createRoom(
  request,
  response,
) {
  const validation = validateCreateRoomRequest(
    request.body || {},
  );

  if (validation.error) {
    return response.status(400).json({
      success: false,
      message: validation.error,
    });
  }

  const {
    hostName,
    boardType,
    boardId,
    boardSnapshot,
  } = validation.value;

  const databaseClient = await pool.connect();

  try {
    for (
      let attempt = 1;
      attempt <= maximumRoomCodeAttempts;
      attempt += 1
    ) {
      await databaseClient.query("BEGIN");

      try {
        const roomCode = generateRoomCode();

        const roomResult = await databaseClient.query(
          `
            INSERT INTO rooms (
              room_code,
              board_type,
              board_id,
              board_snapshot
            )
            VALUES ($1, $2, $3, $4::JSONB)
            RETURNING id, room_code
          `,
          [
            roomCode,
            boardType,
            boardId,
            JSON.stringify(boardSnapshot),
          ],
        );

        const room = roomResult.rows[0];

        const playerResult = await databaseClient.query(
          `
            INSERT INTO room_players (
              room_id,
              player_name,
              player_number,
              is_host,
              is_ready,
              is_connected
            )
            VALUES ($1, $2, 1, TRUE, FALSE, TRUE)
            RETURNING
              id,
              player_token
          `,
          [room.id, hostName],
        );

        const hostPlayer = playerResult.rows[0];

        await databaseClient.query(
          `
            INSERT INTO player_game_states (
              player_id,
              room_id
            )
            VALUES ($1, $2)
          `,
          [hostPlayer.id, room.id],
        );

        await databaseClient.query(
          `
            INSERT INTO online_player_states (
              player_id,
              room_id
            )
            VALUES ($1, $2)
            ON CONFLICT (player_id) DO NOTHING
          `,
          [hostPlayer.id, room.id],
        );

        await databaseClient.query("COMMIT");

        const session = await buildRoomSession(
          pool,
          room.room_code,
          hostPlayer.player_token,
        );

        return response.status(201).json({
          success: true,
          message: "Multiplayer room created.",
          ...session,
        });
      } catch (error) {
        await databaseClient.query("ROLLBACK");

        const isRoomCodeCollision =
          error?.code === "23505" &&
          error?.constraint ===
            "rooms_room_code_key";

        if (
          isRoomCodeCollision &&
          attempt < maximumRoomCodeAttempts
        ) {
          continue;
        }

        throw error;
      }
    }

    throw new Error(
      "Unable to generate an available room code.",
    );
  } catch (error) {
    console.error("Unable to create room:", error);

    return response.status(500).json({
      success: false,
      message:
        "Unable to create the multiplayer room.",
    });
  } finally {
    databaseClient.release();
  }
}

export async function joinRoom(
  request,
  response,
) {
  const roomCode = normalizeRoomCode(
    request.params.roomCode,
  );

  const playerName = normalizePlayerName(
    request.body?.playerName,
  );

  if (!roomCodePattern.test(roomCode)) {
    return response.status(400).json({
      success: false,
      message:
        "Enter a valid six-character room code.",
    });
  }

  if (!playerName) {
    return response.status(400).json({
      success: false,
      message: "Enter your player name.",
    });
  }

  if (playerName.length > 40) {
    return response.status(400).json({
      success: false,
      message:
        "The player name cannot be longer than 40 characters.",
    });
  }

  const databaseClient = await pool.connect();

  try {
    await databaseClient.query("BEGIN");

    const roomResult = await databaseClient.query(
      `
        SELECT
          id,
          room_code,
          status,
          max_players,
          expires_at,
          expires_at <= NOW() AS is_expired
        FROM rooms
        WHERE room_code = $1
        FOR UPDATE
      `,
      [roomCode],
    );

    if (roomResult.rowCount === 0) {
      await databaseClient.query("ROLLBACK");

      return response.status(404).json({
        success: false,
        message: "Room not found.",
      });
    }

    const room = roomResult.rows[0];

    if (room.is_expired) {
      await databaseClient.query(
        `
          UPDATE rooms
          SET status = 'closed', updated_at = NOW()
          WHERE id = $1
        `,
        [room.id],
      );

      await databaseClient.query("COMMIT");

      return response.status(410).json({
        success: false,
        message: "This room has expired.",
      });
    }

    if (room.status === "closed") {
      await databaseClient.query("ROLLBACK");

      return response.status(410).json({
        success: false,
        message: "This room is closed.",
      });
    }

    if (
      !["waiting", "selecting"].includes(
        room.status,
      )
    ) {
      await databaseClient.query("ROLLBACK");

      return response.status(409).json({
        success: false,
        message:
          "This game has already started and cannot accept new players.",
      });
    }

    const existingPlayersResult =
      await databaseClient.query(
        `
          SELECT
            id,
            player_name,
            player_number
          FROM room_players
          WHERE room_id = $1
          ORDER BY player_number
        `,
        [room.id],
      );

    const existingPlayers =
      existingPlayersResult.rows;

    if (
      existingPlayers.length >=
      room.max_players
    ) {
      await databaseClient.query("ROLLBACK");

      return response.status(409).json({
        success: false,
        message: "This room is already full.",
      });
    }

    const duplicatePlayerName =
      existingPlayers.some(
        (player) =>
          player.player_name
            .trim()
            .toLowerCase() ===
          playerName.toLowerCase(),
      );

    if (duplicatePlayerName) {
      await databaseClient.query("ROLLBACK");

      return response.status(409).json({
        success: false,
        message:
          "That player name is already being used in this room.",
      });
    }

    const usedPlayerNumbers = new Set(
      existingPlayers.map(
        (player) => player.player_number,
      ),
    );

    const playerNumber = [1, 2].find(
      (number) =>
        !usedPlayerNumbers.has(number),
    );

    if (!playerNumber) {
      await databaseClient.query("ROLLBACK");

      return response.status(409).json({
        success: false,
        message: "This room is already full.",
      });
    }

    const playerResult = await databaseClient.query(
      `
        INSERT INTO room_players (
          room_id,
          player_name,
          player_number,
          is_host,
          is_ready,
          is_connected
        )
        VALUES ($1, $2, $3, FALSE, FALSE, TRUE)
        RETURNING
          id,
          player_token
      `,
      [room.id, playerName, playerNumber],
    );

    const joinedPlayer = playerResult.rows[0];

    await databaseClient.query(
      `
        INSERT INTO player_game_states (
          player_id,
          room_id
        )
        VALUES ($1, $2)
      `,
      [joinedPlayer.id, room.id],
    );

    await databaseClient.query(
      `
        INSERT INTO online_player_states (
          player_id,
          room_id
        )
        VALUES ($1, $2)
        ON CONFLICT (player_id) DO NOTHING
      `,
      [joinedPlayer.id, room.id],
    );

    await databaseClient.query(
      `
        UPDATE rooms
        SET status = 'selecting', updated_at = NOW()
        WHERE id = $1
      `,
      [room.id],
    );

    await databaseClient.query("COMMIT");

    const session = await buildRoomSession(
      pool,
      roomCode,
      joinedPlayer.player_token,
    );

    emitRoomChanged(
      request,
      roomCode,
      "player-joined",
    );

    return response.status(201).json({
      success: true,
      message: "You joined the multiplayer room.",
      ...session,
    });
  } catch (error) {
    try {
      await databaseClient.query("ROLLBACK");
    } catch {
      // Ignore rollback errors.
    }

    console.error("Unable to join room:", error);

    return response.status(500).json({
      success: false,
      message:
        "Unable to join the multiplayer room.",
    });
  } finally {
    databaseClient.release();
  }
}

export async function restoreRoomSession(
  request,
  response,
) {
  const roomCode = normalizeRoomCode(
    request.params.roomCode,
  );
  const playerToken = getPlayerToken(request);

  if (!roomCodePattern.test(roomCode)) {
    return response.status(400).json({
      success: false,
      message:
        "Enter a valid six-character room code.",
    });
  }

  if (!playerToken) {
    return response.status(401).json({
      success: false,
      message:
        "Your multiplayer session token is missing.",
    });
  }

  try {
    const session = await buildRoomSession(
      pool,
      roomCode,
      playerToken,
    );

    if (session.error) {
      return sendSessionError(response, session);
    }

    await pool.query(
      `
        UPDATE room_players
        SET is_connected = TRUE
        WHERE player_token = $1::UUID
      `,
      [playerToken],
    );

    return response.json({
      success: true,
      message: "Multiplayer session restored.",
      ...session,
    });
  } catch (error) {
    console.error(
      "Unable to restore multiplayer session:",
      error,
    );

    return response.status(500).json({
      success: false,
      message:
        "Unable to restore the multiplayer session.",
    });
  }
}

export async function selectSecretItem(
  request,
  response,
) {
  const roomCode = normalizeRoomCode(
    request.params.roomCode,
  );
  const playerToken = getPlayerToken(request);
  const itemId = normalizeItemId(
    request.body?.itemId,
  );

  if (!roomCodePattern.test(roomCode)) {
    return response.status(400).json({
      success: false,
      message: "Invalid room code.",
    });
  }

  if (!playerToken) {
    return response.status(401).json({
      success: false,
      message: "Your player session is missing.",
    });
  }

  if (!itemId) {
    return response.status(400).json({
      success: false,
      message: "Choose a mystery item first.",
    });
  }

  const databaseClient = await pool.connect();

  try {
    await databaseClient.query("BEGIN");

    const authenticated = await getRoomAndPlayer(
      databaseClient,
      roomCode,
      playerToken,
      { forUpdate: true },
    );

    if (authenticated.error) {
      await databaseClient.query("ROLLBACK");
      return sendSessionError(
        response,
        authenticated,
      );
    }

    const { room, player } = authenticated;

    if (
      !["waiting", "selecting"].includes(
        room.status,
      )
    ) {
      await databaseClient.query("ROLLBACK");

      return response.status(409).json({
        success: false,
        message:
          "Mystery items cannot be changed after the game starts.",
      });
    }

    const boardItemIds = new Set(
      (room.board_snapshot?.items || []).map(
        (item) => String(item.id),
      ),
    );

    if (!boardItemIds.has(itemId)) {
      await databaseClient.query("ROLLBACK");

      return response.status(400).json({
        success: false,
        message:
          "That mystery item does not belong to this board.",
      });
    }

    await databaseClient.query(
      `
        INSERT INTO online_player_secrets (
          player_id,
          room_id,
          secret_item_id,
          updated_at
        )
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (player_id)
        DO UPDATE SET
          secret_item_id = EXCLUDED.secret_item_id,
          updated_at = NOW()
      `,
      [player.id, room.id, itemId],
    );

    await databaseClient.query(
      `
        UPDATE room_players
        SET is_ready = TRUE
        WHERE id = $1
      `,
      [player.id],
    );

    await databaseClient.query("COMMIT");

    const session = await buildRoomSession(
      pool,
      roomCode,
      playerToken,
    );

    emitRoomChanged(
      request,
      roomCode,
      "player-ready",
    );

    return response.json({
      success: true,
      message: "Mystery item locked in.",
      ...session,
    });
  } catch (error) {
    try {
      await databaseClient.query("ROLLBACK");
    } catch {
      // Ignore rollback errors.
    }

    console.error(
      "Unable to select mystery item:",
      error,
    );

    return response.status(500).json({
      success: false,
      message:
        "Unable to save the mystery item.",
    });
  } finally {
    databaseClient.release();
  }
}

export async function startRoomGame(
  request,
  response,
) {
  const roomCode = normalizeRoomCode(
    request.params.roomCode,
  );
  const playerToken = getPlayerToken(request);
  const databaseClient = await pool.connect();

  try {
    await databaseClient.query("BEGIN");

    const authenticated = await getRoomAndPlayer(
      databaseClient,
      roomCode,
      playerToken,
      { forUpdate: true },
    );

    if (authenticated.error) {
      await databaseClient.query("ROLLBACK");
      return sendSessionError(
        response,
        authenticated,
      );
    }

    const { room, player } = authenticated;

    if (!player.is_host) {
      await databaseClient.query("ROLLBACK");

      return response.status(403).json({
        success: false,
        message:
          "Only the host can start the game.",
      });
    }

    if (
      !["waiting", "selecting"].includes(
        room.status,
      )
    ) {
      await databaseClient.query("ROLLBACK");

      return response.status(409).json({
        success: false,
        message: "This game has already started.",
      });
    }

    const readinessResult =
      await databaseClient.query(
        `
          SELECT
            COUNT(*)::INT AS player_count,
            COUNT(*) FILTER (
              WHERE rp.is_ready = TRUE
            )::INT AS ready_count,
            COUNT(ops.player_id)::INT AS secret_count
          FROM room_players rp
          LEFT JOIN online_player_secrets ops
            ON ops.player_id = rp.id
          WHERE rp.room_id = $1
        `,
        [room.id],
      );

    const readiness = readinessResult.rows[0];

    if (readiness.player_count !== 2) {
      await databaseClient.query("ROLLBACK");

      return response.status(409).json({
        success: false,
        message:
          "Two players must be in the room before starting.",
      });
    }

    if (
      readiness.ready_count !== 2 ||
      readiness.secret_count !== 2
    ) {
      await databaseClient.query("ROLLBACK");

      return response.status(409).json({
        success: false,
        message:
          "Both players must choose a mystery item and be ready.",
      });
    }

    const playersResult = await databaseClient.query(
      `
        SELECT id
        FROM room_players
        WHERE room_id = $1
      `,
      [room.id],
    );

    for (const roomPlayer of playersResult.rows) {
      await databaseClient.query(
        `
          INSERT INTO online_player_states (
            player_id,
            room_id,
            eliminated_item_ids,
            final_guess_item_id,
            result,
            updated_at
          )
          VALUES ($1, $2, '[]'::JSONB, NULL, NULL, NOW())
          ON CONFLICT (player_id)
          DO UPDATE SET
            eliminated_item_ids = '[]'::JSONB,
            final_guess_item_id = NULL,
            result = NULL,
            updated_at = NOW()
        `,
        [roomPlayer.id, room.id],
      );
    }

    await databaseClient.query(
      `
        DELETE FROM online_room_results
        WHERE room_id = $1
      `,
      [room.id],
    );

    await databaseClient.query(
      `
        UPDATE rooms
        SET status = 'playing', updated_at = NOW()
        WHERE id = $1
      `,
      [room.id],
    );

    await databaseClient.query("COMMIT");

    const session = await buildRoomSession(
      pool,
      roomCode,
      playerToken,
    );

    emitRoomChanged(
      request,
      roomCode,
      "game-started",
    );

    return response.json({
      success: true,
      message: "The game has started.",
      ...session,
    });
  } catch (error) {
    try {
      await databaseClient.query("ROLLBACK");
    } catch {
      // Ignore rollback errors.
    }

    console.error("Unable to start game:", error);

    return response.status(500).json({
      success: false,
      message: "Unable to start the game.",
    });
  } finally {
    databaseClient.release();
  }
}

export async function updatePlayerGameState(
  request,
  response,
) {
  const roomCode = normalizeRoomCode(
    request.params.roomCode,
  );
  const playerToken = getPlayerToken(request);
  const eliminatedItemIds =
    request.body?.eliminatedItemIds;

  if (!Array.isArray(eliminatedItemIds)) {
    return response.status(400).json({
      success: false,
      message:
        "Eliminated item IDs must be an array.",
    });
  }

  const uniqueEliminatedIds = [
    ...new Set(
      eliminatedItemIds.map((itemId) =>
        normalizeItemId(itemId),
      ),
    ),
  ].filter(Boolean);

  const databaseClient = await pool.connect();

  try {
    const authenticated = await getRoomAndPlayer(
      databaseClient,
      roomCode,
      playerToken,
    );

    if (authenticated.error) {
      return sendSessionError(
        response,
        authenticated,
      );
    }

    const { room, player } = authenticated;

    if (room.status !== "playing") {
      return response.status(409).json({
        success: false,
        message:
          "Cards can only be updated during an active game.",
      });
    }

    const boardItemIds = new Set(
      (room.board_snapshot?.items || []).map(
        (item) => String(item.id),
      ),
    );

    const hasInvalidItem =
      uniqueEliminatedIds.some(
        (itemId) => !boardItemIds.has(itemId),
      );

    if (hasInvalidItem) {
      return response.status(400).json({
        success: false,
        message:
          "One or more eliminated cards do not belong to this board.",
      });
    }

    await databaseClient.query(
      `
        INSERT INTO online_player_states (
          player_id,
          room_id,
          eliminated_item_ids,
          updated_at
        )
        VALUES ($1, $2, $3::JSONB, NOW())
        ON CONFLICT (player_id)
        DO UPDATE SET
          eliminated_item_ids = EXCLUDED.eliminated_item_ids,
          updated_at = NOW()
      `,
      [
        player.id,
        room.id,
        JSON.stringify(uniqueEliminatedIds),
      ],
    );

    const session = await buildRoomSession(
      pool,
      roomCode,
      playerToken,
    );

    emitRoomChanged(
      request,
      roomCode,
      "board-progress",
    );

    return response.json({
      success: true,
      message: "Board progress saved.",
      ...session,
    });
  } catch (error) {
    console.error(
      "Unable to update board progress:",
      error,
    );

    return response.status(500).json({
      success: false,
      message:
        "Unable to save the board progress.",
    });
  } finally {
    databaseClient.release();
  }
}

export async function submitFinalGuess(
  request,
  response,
) {
  const roomCode = normalizeRoomCode(
    request.params.roomCode,
  );
  const playerToken = getPlayerToken(request);
  const guessedItemId = normalizeItemId(
    request.body?.itemId,
  );
  const databaseClient = await pool.connect();

  try {
    await databaseClient.query("BEGIN");

    const authenticated = await getRoomAndPlayer(
      databaseClient,
      roomCode,
      playerToken,
      { forUpdate: true },
    );

    if (authenticated.error) {
      await databaseClient.query("ROLLBACK");
      return sendSessionError(
        response,
        authenticated,
      );
    }

    const { room, player } = authenticated;

    if (room.status !== "playing") {
      await databaseClient.query("ROLLBACK");

      return response.status(409).json({
        success: false,
        message:
          "A final guess can only be made during an active game.",
      });
    }

    const boardItemIds = new Set(
      (room.board_snapshot?.items || []).map(
        (item) => String(item.id),
      ),
    );

    if (!boardItemIds.has(guessedItemId)) {
      await databaseClient.query("ROLLBACK");

      return response.status(400).json({
        success: false,
        message:
          "Choose a valid item from the board.",
      });
    }

    const opponentResult = await databaseClient.query(
      `
        SELECT
          rp.id,
          ops.secret_item_id
        FROM room_players rp
        JOIN online_player_secrets ops
          ON ops.player_id = rp.id
        WHERE
          rp.room_id = $1 AND
          rp.id <> $2
        LIMIT 1
      `,
      [room.id, player.id],
    );

    if (opponentResult.rowCount === 0) {
      await databaseClient.query("ROLLBACK");

      return response.status(409).json({
        success: false,
        message:
          "The opponent's mystery item is unavailable.",
      });
    }

    const opponent = opponentResult.rows[0];
    const wasCorrect =
      opponent.secret_item_id === guessedItemId;
    const winnerPlayerId = wasCorrect
      ? player.id
      : opponent.id;

    await databaseClient.query(
      `
        UPDATE online_player_states
        SET
          final_guess_item_id = $1,
          result = $2,
          updated_at = NOW()
        WHERE player_id = $3
      `,
      [
        guessedItemId,
        wasCorrect ? "won" : "lost",
        player.id,
      ],
    );

    await databaseClient.query(
      `
        UPDATE online_player_states
        SET
          result = $1,
          updated_at = NOW()
        WHERE player_id = $2
      `,
      [wasCorrect ? "lost" : "won", opponent.id],
    );

    await databaseClient.query(
      `
        INSERT INTO online_room_results (
          room_id,
          guesser_player_id,
          winner_player_id,
          guessed_item_id,
          was_correct,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (room_id)
        DO UPDATE SET
          guesser_player_id = EXCLUDED.guesser_player_id,
          winner_player_id = EXCLUDED.winner_player_id,
          guessed_item_id = EXCLUDED.guessed_item_id,
          was_correct = EXCLUDED.was_correct,
          created_at = NOW()
      `,
      [
        room.id,
        player.id,
        winnerPlayerId,
        guessedItemId,
        wasCorrect,
      ],
    );

    await databaseClient.query(
      `
        UPDATE rooms
        SET status = 'finished', updated_at = NOW()
        WHERE id = $1
      `,
      [room.id],
    );

    await databaseClient.query("COMMIT");

    const session = await buildRoomSession(
      pool,
      roomCode,
      playerToken,
    );

    emitRoomChanged(
      request,
      roomCode,
      "game-finished",
    );

    return response.json({
      success: true,
      message: wasCorrect
        ? "Correct final guess!"
        : "That final guess was incorrect.",
      ...session,
    });
  } catch (error) {
    try {
      await databaseClient.query("ROLLBACK");
    } catch {
      // Ignore rollback errors.
    }

    console.error(
      "Unable to submit final guess:",
      error,
    );

    return response.status(500).json({
      success: false,
      message:
        "Unable to submit the final guess.",
    });
  } finally {
    databaseClient.release();
  }
}

export async function resetRoomGame(
  request,
  response,
) {
  const roomCode = normalizeRoomCode(
    request.params.roomCode,
  );

  const playerToken =
    getPlayerToken(request);

  const databaseClient =
    await pool.connect();

  try {
    await databaseClient.query("BEGIN");

    const authenticated =
      await getRoomAndPlayer(
        databaseClient,
        roomCode,
        playerToken,
        {
          forUpdate: true,
        },
      );

    if (authenticated.error) {
      await databaseClient.query(
        "ROLLBACK",
      );

      return sendSessionError(
        response,
        authenticated,
      );
    }

    const {
      room,
      player,
    } = authenticated;

    if (!player.is_host) {
      await databaseClient.query(
        "ROLLBACK",
      );

      return response.status(403).json({
        success: false,
        message:
          "Only the host can reset the round.",
      });
    }

    if (room.status === "closed") {
      await databaseClient.query(
        "ROLLBACK",
      );

      return response.status(409).json({
        success: false,
        message:
          "A closed room cannot be reset.",
      });
    }

    await databaseClient.query(
      `
        UPDATE room_players
        SET is_ready = FALSE
        WHERE room_id = $1
      `,
      [room.id],
    );

    await databaseClient.query(
      `
        DELETE FROM online_player_secrets
        WHERE room_id = $1
      `,
      [room.id],
    );

    await databaseClient.query(
      `
        UPDATE online_player_states
        SET
          eliminated_item_ids = '[]'::JSONB,
          final_guess_item_id = NULL,
          result = NULL,
          updated_at = NOW()
        WHERE room_id = $1
      `,
      [room.id],
    );

    await databaseClient.query(
      `
        DELETE FROM online_room_results
        WHERE room_id = $1
      `,
      [room.id],
    );

    await databaseClient.query(
      `
        DELETE FROM room_chat_messages
        WHERE room_id = $1
      `,
      [room.id],
    );

    await databaseClient.query(
      `
        UPDATE rooms
        SET
          status = CASE
            WHEN (
              SELECT COUNT(*)
              FROM room_players
              WHERE room_id = $1
            ) >= max_players
              THEN 'selecting'
            ELSE 'waiting'
          END,
          updated_at = NOW()
        WHERE id = $1
      `,
      [room.id],
    );

    await databaseClient.query("COMMIT");

    const session =
      await buildRoomSession(
        pool,
        roomCode,
        playerToken,
      );

    emitRoomChanged(
      request,
      roomCode,
      "round-reset",
    );

    return response.json({
      success: true,
      message:
        "The round was reset. Choose new mystery items.",
      ...session,
    });
  } catch (error) {
    try {
      await databaseClient.query(
        "ROLLBACK",
      );
    } catch {
      // Ignore rollback errors.
    }

    console.error(
      "Unable to reset round:",
      error,
    );

    return response.status(500).json({
      success: false,
      message:
        "Unable to reset the round.",
    });
  } finally {
    databaseClient.release();
  }
}

export async function leaveRoom(
  request,
  response,
) {
  const roomCode = normalizeRoomCode(
    request.params.roomCode,
  );
  const playerToken = getPlayerToken(request);
  const databaseClient = await pool.connect();

  try {
    await databaseClient.query("BEGIN");

    const authenticated = await getRoomAndPlayer(
      databaseClient,
      roomCode,
      playerToken,
      { forUpdate: true },
    );

    if (authenticated.error) {
      await databaseClient.query("ROLLBACK");
      return sendSessionError(
        response,
        authenticated,
      );
    }

    const { room, player } = authenticated;

    if (player.is_host) {
      await databaseClient.query(
        `
          UPDATE rooms
          SET status = 'closed', updated_at = NOW()
          WHERE id = $1
        `,
        [room.id],
      );

      await databaseClient.query(
        `
          UPDATE room_players
          SET is_connected = FALSE
          WHERE room_id = $1
        `,
        [room.id],
      );
    } else {
      await databaseClient.query(
        `
          DELETE FROM room_players
          WHERE id = $1
        `,
        [player.id],
      );

      await databaseClient.query(
        `
          DELETE FROM online_player_secrets
          WHERE room_id = $1
        `,
        [room.id],
      );

      await databaseClient.query(
        `
          DELETE FROM online_player_states
          WHERE room_id = $1
        `,
        [room.id],
      );

      await databaseClient.query(
        `
          DELETE FROM online_room_results
          WHERE room_id = $1
        `,
        [room.id],
      );

      await databaseClient.query(
        `
          DELETE FROM room_chat_messages
          WHERE room_id = $1
        `,
        [room.id],
      );

      await databaseClient.query(
        `
          UPDATE room_players
          SET is_ready = FALSE
          WHERE room_id = $1
        `,
        [room.id],
      );

      await databaseClient.query(
        `
          UPDATE rooms
          SET status = 'waiting', updated_at = NOW()
          WHERE id = $1
        `,
        [room.id],
      );
    }

    await databaseClient.query("COMMIT");

    emitRoomChanged(
      request,
      roomCode,
      player.is_host
        ? "room-closed"
        : "player-left",
    );

    return response.json({
      success: true,
      message: player.is_host
        ? "The room was closed."
        : "You left the room.",
    });
  } catch (error) {
    try {
      await databaseClient.query("ROLLBACK");
    } catch {
      // Ignore rollback errors.
    }

    console.error("Unable to leave room:", error);

    return response.status(500).json({
      success: false,
      message: "Unable to leave the room.",
    });
  } finally {
    databaseClient.release();
  }
}
