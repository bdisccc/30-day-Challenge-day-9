import { useState } from "react";

import {
  createMultiplayerRoom,
  joinMultiplayerRoom,
  saveMultiplayerSession,
} from "../utils/multiplayerApi";

function createLocalBoardSnapshot(category) {
  if (!category) {
    return null;
  }

  return {
    id: category.id,
    name: category.name,
    icon: category.icon || "❓",
    description: category.description || "",
    boardSize: category.items?.length || 0,
    items:
      category.items?.map((item) => ({
        id: item.id,
        name: item.name,
        emoji: item.emoji || "❓",
      })) || [],
  };
}

function MultiplayerSetup({
  category,
  initialRoomCode = "",
  onChooseBoard,
  onSessionReady,
}) {
  const hasIncomingCode = Boolean(initialRoomCode);

  const [mode, setMode] = useState(
    hasIncomingCode ? "join" : "create",
  );
  const [hostName, setHostName] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState(initialRoomCode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setErrorMessage("");
  };

  const handleCreateRoom = async (event) => {
    event.preventDefault();
    setErrorMessage("");

    if (!category) {
      onChooseBoard();
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createMultiplayerRoom({
        hostName,
        category,
      });

      const session = {
        room: {
          ...result.room,
          boardSnapshot:
            result.room.boardSnapshot ||
            createLocalBoardSnapshot(category),
        },
        player: result.player,
        players: result.players || [result.player],
        savedAt: new Date().toISOString(),
      };

      saveMultiplayerSession(session);
      onSessionReady(session);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to create the multiplayer room.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinRoom = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const result = await joinMultiplayerRoom({
        roomCode,
        playerName,
      });

      const session = {
        room: result.room,
        player: result.player,
        players: result.players || [result.player],
        savedAt: new Date().toISOString(),
      };

      saveMultiplayerSession(session);
      onSessionReady(session);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to join the multiplayer room.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="content-screen multiplayer-setup-screen screen-enter">
      <div className="screen-heading playful-screen-heading">
        <span className="screen-eyebrow">Online Multiplayer</span>
        <h2>Play together, anywhere</h2>
        <p>
          Host a private game or jump straight into a friend’s room
          using their code.
        </p>
      </div>

      <div className="multiplayer-shell">
        <div
          className="multiplayer-mode-tabs"
          role="tablist"
          aria-label="Multiplayer room action"
        >
          <button
            className={mode === "create" ? "is-active" : ""}
            type="button"
            role="tab"
            aria-selected={mode === "create"}
            onClick={() => switchMode("create")}
          >
            <span>＋</span>
            Create Room
          </button>

          <button
            className={mode === "join" ? "is-active" : ""}
            type="button"
            role="tab"
            aria-selected={mode === "join"}
            onClick={() => switchMode("join")}
          >
            <span>→</span>
            Join Room
          </button>
        </div>

        {errorMessage && (
          <div className="multiplayer-alert" role="alert">
            <span className="multiplayer-alert-icon">!</span>
            <span>{errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage("")}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        {mode === "create" ? (
          <form
            className="multiplayer-setup-card multiplayer-create-card"
            onSubmit={handleCreateRoom}
          >
            <div className="multiplayer-form-intro">
              <div className="multiplayer-form-icon">🎮</div>

              <div>
                <span className="multiplayer-form-kicker">Host a game</span>
                <h3>Create your private room</h3>
                <p>
                  Pick the board, enter your name, then share the room
                  code or QR link with Player 2.
                </p>
              </div>
            </div>

            <div className="multiplayer-step-card">
              <span className="multiplayer-step-number">1</span>

              <div className="multiplayer-step-content">
                <span className="multiplayer-step-label">Game board</span>

                {category ? (
                  <div className="multiplayer-selected-board">
                    <span className="multiplayer-board-icon">
                      {category.icon}
                    </span>

                    <div>
                      <small>Selected board</small>
                      <strong>{category.name}</strong>
                      <span>{category.items.length} cards</span>
                    </div>

                    <button
                      className="multiplayer-change-board-button"
                      type="button"
                      onClick={onChooseBoard}
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <button
                    className="multiplayer-board-picker"
                    type="button"
                    onClick={onChooseBoard}
                  >
                    <span className="multiplayer-board-picker-icon">🎲</span>
                    <span>
                      <strong>Choose a board</strong>
                      <small>
                        Select the category both players will receive.
                      </small>
                    </span>
                    <span aria-hidden="true">→</span>
                  </button>
                )}
              </div>
            </div>

            <div className="multiplayer-step-card">
              <span className="multiplayer-step-number">2</span>

              <label className="multiplayer-field multiplayer-step-content">
                <span className="multiplayer-step-label">Your player name</span>
                <input
                  type="text"
                  value={hostName}
                  maxLength={40}
                  placeholder="Enter your name"
                  autoComplete="nickname"
                  onChange={(event) => setHostName(event.target.value)}
                />
                <small>This name appears in the lobby and chat.</small>
              </label>
            </div>

            <button
              className="primary-button multiplayer-submit-button"
              type="submit"
              disabled={
                isSubmitting ||
                !category ||
                !hostName.trim()
              }
            >
              <span>{isSubmitting ? "⌛" : "✨"}</span>
              {isSubmitting ? "Creating Room..." : "Create My Room"}
            </button>
          </form>
        ) : (
          <form
            className="multiplayer-setup-card multiplayer-join-card"
            onSubmit={handleJoinRoom}
          >
            <div className="multiplayer-form-intro">
              <div className="multiplayer-form-icon">🔗</div>

              <div>
                <span className="multiplayer-form-kicker">Join a friend</span>
                <h3>Enter the room</h3>
                <p>
                  No board selection needed. The host’s board loads
                  automatically after you join.
                </p>
              </div>
            </div>

            <div className="multiplayer-join-fields">
              <label className="multiplayer-field">
                <span>Room code</span>
                <input
                  className="multiplayer-room-code-input"
                  type="text"
                  value={roomCode}
                  maxLength={6}
                  placeholder="ABC123"
                  autoComplete="off"
                  inputMode="text"
                  onChange={(event) =>
                    setRoomCode(
                      event.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, ""),
                    )
                  }
                />
                <small>Six characters shown on the host’s lobby.</small>
              </label>

              <label className="multiplayer-field">
                <span>Your player name</span>
                <input
                  type="text"
                  value={playerName}
                  maxLength={40}
                  placeholder="Enter your name"
                  autoComplete="nickname"
                  onChange={(event) => setPlayerName(event.target.value)}
                />
                <small>This name appears in the lobby and chat.</small>
              </label>
            </div>

            <button
              className="primary-button multiplayer-submit-button"
              type="submit"
              disabled={
                isSubmitting ||
                roomCode.length !== 6 ||
                !playerName.trim()
              }
            >
              <span>{isSubmitting ? "⌛" : "🚪"}</span>
              {isSubmitting ? "Joining Room..." : "Join the Room"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

export default MultiplayerSetup;
