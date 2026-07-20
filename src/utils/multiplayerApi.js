const apiBaseUrl = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000"
).replace(/\/+$/, "");

const multiplayerSessionKey =
  "guessTheWhatMultiplayerSession";

async function apiRequest(
  path,
  options = {},
) {
  const {
    headers: customHeaders,
    ...requestOptions
  } = options;

  let response;

  try {
    response = await fetch(
      `${apiBaseUrl}${path}`,
      {
        ...requestOptions,

        headers: {
          "Content-Type": "application/json",
          ...customHeaders,
        },
      },
    );
  } catch {
    throw new Error(
      "Unable to reach the multiplayer server. Make sure the backend is running on port 5000.",
    );
  }

  let responseData;

  try {
    responseData = await response.json();
  } catch {
    throw new Error(
      "The multiplayer server returned an invalid response.",
    );
  }

  if (
    !response.ok ||
    responseData.success === false
  ) {
    throw new Error(
      responseData.message ||
        "The multiplayer request failed.",
    );
  }

  return responseData;
}

function createBoardSnapshot(category) {
  if (
    !category ||
    !Array.isArray(category.items)
  ) {
    throw new Error(
      "Select a valid board before creating a multiplayer room.",
    );
  }

  if (category.isCustom) {
    throw new Error(
      "Online custom boards will be enabled after multiplayer image storage is added.",
    );
  }

  return {
    id: category.id,
    name: category.name,
    icon: category.icon || "❓",
    description:
      category.description || "",
    boardSize: category.items.length,

    items: category.items.map(
      (item) => ({
        id: item.id,
        name: item.name,
        emoji: item.emoji || "❓",
      }),
    ),
  };
}

function getSessionCredentials(session) {
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
      "The saved multiplayer session is incomplete.",
    );
  }

  return {
    roomCode,
    playerToken,
  };
}

function createAuthenticatedHeaders(
  session,
) {
  const { playerToken } =
    getSessionCredentials(session);

  return {
    "x-player-token": playerToken,
  };
}

export async function createMultiplayerRoom({
  hostName,
  category,
}) {
  const normalizedHostName = String(
    hostName || "",
  )
    .trim()
    .replace(/\s+/g, " ");

  if (!normalizedHostName) {
    throw new Error(
      "Enter your player name.",
    );
  }

  const boardSnapshot =
    createBoardSnapshot(category);

  return apiRequest("/api/rooms", {
    method: "POST",

    body: JSON.stringify({
      hostName: normalizedHostName,
      boardType: "standard",
      boardId: category.id,
      boardSnapshot,
    }),
  });
}

export async function joinMultiplayerRoom({
  roomCode,
  playerName,
}) {
  const normalizedRoomCode = String(
    roomCode || "",
  )
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

  const normalizedPlayerName = String(
    playerName || "",
  )
    .trim()
    .replace(/\s+/g, " ");

  if (!normalizedRoomCode) {
    throw new Error(
      "Enter the six-character room code.",
    );
  }

  if (!normalizedPlayerName) {
    throw new Error(
      "Enter your player name.",
    );
  }

  return apiRequest(
    `/api/rooms/${encodeURIComponent(
      normalizedRoomCode,
    )}/join`,
    {
      method: "POST",

      body: JSON.stringify({
        playerName:
          normalizedPlayerName,
      }),
    },
  );
}

export async function restoreMultiplayerSession(
  session,
) {
  const { roomCode } =
    getSessionCredentials(session);

  return apiRequest(
    `/api/rooms/${encodeURIComponent(
      roomCode,
    )}/session`,
    {
      method: "GET",

      headers:
        createAuthenticatedHeaders(
          session,
        ),
    },
  );
}

export async function selectMultiplayerSecret(
  session,
  itemId,
) {
  const { roomCode } =
    getSessionCredentials(session);

  const normalizedItemId = String(
    itemId || "",
  ).trim();

  if (!normalizedItemId) {
    throw new Error(
      "Choose a mystery item.",
    );
  }

  return apiRequest(
    `/api/rooms/${encodeURIComponent(
      roomCode,
    )}/secret`,
    {
      method: "POST",

      headers:
        createAuthenticatedHeaders(
          session,
        ),

      body: JSON.stringify({
        itemId: normalizedItemId,
      }),
    },
  );
}

export async function startMultiplayerGame(
  session,
) {
  const { roomCode } =
    getSessionCredentials(session);

  return apiRequest(
    `/api/rooms/${encodeURIComponent(
      roomCode,
    )}/start`,
    {
      method: "POST",

      headers:
        createAuthenticatedHeaders(
          session,
        ),

      body: JSON.stringify({}),
    },
  );
}

export async function updateMultiplayerState(
  session,
  eliminatedItemIds,
) {
  const { roomCode } =
    getSessionCredentials(session);

  const normalizedIds =
    Array.isArray(eliminatedItemIds)
      ? eliminatedItemIds
          .map((itemId) =>
            String(itemId || "").trim(),
          )
          .filter(Boolean)
      : [];

  return apiRequest(
    `/api/rooms/${encodeURIComponent(
      roomCode,
    )}/state`,
    {
      method: "PATCH",

      headers:
        createAuthenticatedHeaders(
          session,
        ),

      body: JSON.stringify({
        eliminatedItemIds:
          normalizedIds,
      }),
    },
  );
}

export async function submitMultiplayerGuess(
  session,
  itemId,
) {
  const { roomCode } =
    getSessionCredentials(session);

  const normalizedItemId = String(
    itemId || "",
  ).trim();

  if (!normalizedItemId) {
    throw new Error(
      "Choose your final answer.",
    );
  }

  return apiRequest(
    `/api/rooms/${encodeURIComponent(
      roomCode,
    )}/final-guess`,
    {
      method: "POST",

      headers:
        createAuthenticatedHeaders(
          session,
        ),

      body: JSON.stringify({
        itemId: normalizedItemId,
      }),
    },
  );
}

export async function resetMultiplayerGame(
  session,
) {
  const { roomCode } =
    getSessionCredentials(session);

  return apiRequest(
    `/api/rooms/${encodeURIComponent(
      roomCode,
    )}/reset`,
    {
      method: "POST",

      headers:
        createAuthenticatedHeaders(
          session,
        ),

      body: JSON.stringify({}),
    },
  );
}

export async function leaveMultiplayerRoom(
  session,
) {
  const { roomCode } =
    getSessionCredentials(session);

  return apiRequest(
    `/api/rooms/${encodeURIComponent(
      roomCode,
    )}/leave`,
    {
      method: "DELETE",

      headers:
        createAuthenticatedHeaders(
          session,
        ),
    },
  );
}

export function saveMultiplayerSession(
  session,
) {
  localStorage.setItem(
    multiplayerSessionKey,

    JSON.stringify({
      ...session,
      savedAt:
        new Date().toISOString(),
    }),
  );
}

export function getMultiplayerSession() {
  const storedSession =
    localStorage.getItem(
      multiplayerSessionKey,
    );

  if (!storedSession) {
    return null;
  }

  try {
    const parsedSession =
      JSON.parse(storedSession);

    if (
      !parsedSession?.room?.code ||
      !parsedSession?.player?.token
    ) {
      localStorage.removeItem(
        multiplayerSessionKey,
      );

      return null;
    }

    return parsedSession;
  } catch {
    localStorage.removeItem(
      multiplayerSessionKey,
    );

    return null;
  }
}

export function clearMultiplayerSession() {
  localStorage.removeItem(
    multiplayerSessionKey,
  );
}

export function getMultiplayerApiUrl() {
  return apiBaseUrl;
}