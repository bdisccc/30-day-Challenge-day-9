import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { QRCodeSVG } from "qrcode.react";
import "./MultiplayerLobby.css";

import {
  clearMultiplayerSession,
  leaveMultiplayerRoom,
  restoreMultiplayerSession,
  resetMultiplayerGame,
  saveMultiplayerSession,
  selectMultiplayerSecret,
  startMultiplayerGame,
  submitMultiplayerGuess,
  updateMultiplayerState,
} from "../utils/multiplayerApi";
import { connectMultiplayerSocket } from "../utils/multiplayerSocket";

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const temporaryInput =
    document.createElement("textarea");

  temporaryInput.value = value;
  temporaryInput.style.position = "fixed";
  temporaryInput.style.opacity = "0";

  document.body.appendChild(temporaryInput);
  temporaryInput.select();
  document.execCommand("copy");
  temporaryInput.remove();
}

function createSessionFromResponse(
  response,
  previousSession,
) {
  return {
    room: response.room || previousSession.room,
    player:
      response.player || previousSession.player,
    players:
      response.players ||
      previousSession.players ||
      [],
    game:
      response.game ||
      previousSession.game ||
      {},
    result:
      response.result ??
      previousSession.result ??
      null,
    revealedSecrets:
      response.revealedSecrets ||
      previousSession.revealedSecrets ||
      [],
    messages:
      response.messages ||
      previousSession.messages ||
      [],
  };
}

function formatMessageTime(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function ItemArtwork({
  item,
  className = "",
}) {
  if (item?.image) {
    return (
      <img
        className={`${className} item-artwork-image`}
        src={item.image}
        alt={item.name}
        draggable="false"
      />
    );
  }

  return (
    <span className={className} aria-hidden="true">
      {item?.emoji || "?"}
    </span>
  );
}

function ChatPanel({
  messages,
  currentPlayer,
  value,
  onChange,
  onSend,
  isOpen,
  onClose,
  isConnected,
  isSending,
  isMinimized,
  onToggleMinimize,
  unreadCount,
}) {
  const messageEndRef = useRef(null);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({
      block: "end",
    });
  }, [messages, isOpen]);

  return (
    <aside
      className={`mp-chat-panel ${
        isOpen ? "is-open" : ""
      } ${isMinimized ? "is-minimized" : ""}`}
      aria-label="Room chat and clues"
    >
      <div className="mp-chat-heading">
        <div>
          <span>💬</span>
          <div>
            <strong>Chat & clues</strong>
            <small>
              {isConnected
                ? "Live connection"
                : "Reconnecting..."}
            </small>
          </div>
        </div>

        <div className="mp-chat-heading-actions">
          {unreadCount > 0 && (
            <span className="mp-chat-unread">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}

          <button
            className="mp-chat-minimize"
            type="button"
            onClick={onToggleMinimize}
            aria-label={
              isMinimized
                ? "Expand chat"
                : "Minimize chat"
            }
          >
            {isMinimized ? "‹" : "›"}
          </button>

          <button
            className="mp-chat-close"
            type="button"
            onClick={onClose}
            aria-label="Close chat"
          >
            ×
          </button>
        </div>
      </div>

      <div className="mp-chat-tip">
        Ask yes-or-no questions, share clues, and
        keep the guessing conversation in one place.
      </div>

      <div className="mp-chat-messages">
        {messages.length === 0 ? (
          <div className="mp-chat-empty">
            <span>✨</span>
            <strong>No clues yet</strong>
            <p>Start with a question like “Is it an animal?”</p>
          </div>
        ) : (
          messages.map((message) => {
            const isOwnMessage =
              message.playerId === currentPlayer.id;

            return (
              <article
                className={`mp-chat-message ${
                  isOwnMessage ? "is-own" : ""
                }`}
                key={message.id}
              >
                <div className="mp-chat-message-meta">
                  <strong>
                    {isOwnMessage
                      ? "You"
                      : message.playerName}
                  </strong>
                  <span>
                    {formatMessageTime(
                      message.createdAt,
                    )}
                  </span>
                </div>

                <p>{message.message}</p>
              </article>
            );
          })
        )}

        <div ref={messageEndRef} />
      </div>

      <form
        className="mp-chat-form"
        onSubmit={onSend}
      >
        <label htmlFor="multiplayer-chat-message">
          Message or clue
        </label>

        <div>
          <textarea
            id="multiplayer-chat-message"
            value={value}
            maxLength={400}
            rows={2}
            placeholder="Type a question or clue..."
            onChange={(event) =>
              onChange(event.target.value)
            }
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey
              ) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />

          <button
            type="submit"
            disabled={
              isSending ||
              !value.trim() ||
              !isConnected
            }
          >
            {isSending ? "..." : "Send"}
          </button>
        </div>

        <small>{value.length}/400</small>
      </form>
    </aside>
  );
}

function PlayerCard({
  player,
  playerNumber,
  currentPlayerId,
}) {
  if (!player) {
    return (
      <article className="mp-player-card is-empty">
        <span className="mp-player-avatar">?</span>

        <div className="mp-player-information">
          <small>Player {playerNumber}</small>
          <strong>Waiting for player...</strong>
          <span>Share the room code to invite them.</span>
        </div>

        <span className="mp-player-badge is-open">
          Open
        </span>
      </article>
    );
  }

  const isCurrent = player.id === currentPlayerId;

  return (
    <article
      className={`mp-player-card ${
        player.isReady ? "is-ready" : ""
      }`}
    >
      <span className="mp-player-avatar">
        {player.name.charAt(0).toUpperCase()}
      </span>

      <div className="mp-player-information">
        <small>
          Player {player.playerNumber || player.number}
          {isCurrent ? " · You" : ""}
        </small>
        <strong>{player.name}</strong>

        <div className="mp-player-tags">
          {player.isHost && <span>Host</span>}
          <span
            className={
              player.isConnected
                ? "is-connected"
                : "is-disconnected"
            }
          >
            {player.isConnected
              ? "Connected"
              : "Reconnecting"}
          </span>
        </div>
      </div>

      <span
        className={`mp-player-badge ${
          player.isReady ? "is-ready" : ""
        }`}
      >
        {player.isReady ? "Ready ✓" : "Choosing"}
      </span>
    </article>
  );
}

function SecretPicker({
  items,
  selectedItemId,
  isReady,
  isSaving,
  onSelect,
  onRandomize,
  onSave,
  boardName,
  boardIcon,
  allPlayersReady,
  isHost,
  isStarting,
  onStart,
}) {
  const selectedItem = items.find(
    (item) => item.id === selectedItemId,
  );

  return (
    <section className="mp-secret-section mp-unified-setup-panel">
      <div className="mp-setup-header">
        <div className="mp-setup-board-summary">
          <span className="mp-setup-board-icon">
            {boardIcon || "🎲"}
          </span>

          <div>
            <small>Game board</small>
            <strong>
              {boardName || "Standard Board"}
            </strong>
            <span>{items.length} cards</span>
          </div>
        </div>

        <div className="mp-setup-heading-copy">
          <span>Private selection</span>
          <h3>Choose your mystery item</h3>
          <p>
            Your opponent will not see this choice until
            the round ends.
          </p>
        </div>

        <span
          className={`mp-setup-ready-pill ${
            isReady ? "is-ready" : ""
          }`}
        >
          {isReady ? "Ready ✓" : "Choosing"}
        </span>
      </div>

      <div className="mp-secret-grid">
        {items.map((item) => {
          const isSelected =
            item.id === selectedItemId;

          return (
            <button
              className={`mp-secret-option ${
                isSelected ? "is-selected" : ""
              }`}
              type="button"
              key={item.id}
              onClick={() => onSelect(item.id)}
              aria-pressed={isSelected}
            >
              <span className="mp-secret-check">
                {isSelected ? "✓" : ""}
              </span>
              <ItemArtwork
                item={item}
                className="mp-secret-option-art"
              />
              <strong>{item.name}</strong>
            </button>
          );
        })}
      </div>

      <div className="mp-setup-footer">
        <div className="mp-selected-secret-summary">
          <ItemArtwork
            item={selectedItem}
            className="mp-selected-secret-art"
          />

          <div>
            <small>
              {isReady
                ? "Locked mystery item"
                : "Current selection"}
            </small>
            <strong>
              {selectedItem
                ? selectedItem.name
                : "No item selected"}
            </strong>
            <span>
              {isReady
                ? "You can still change it before the host starts."
                : "Only your device and the server know this item."}
            </span>
          </div>
        </div>

        <div className="mp-secret-action-buttons">
          <button
            className="mp-random-secret-button"
            type="button"
            disabled={isSaving || items.length === 0}
            onClick={onRandomize}
          >
            🎲 Pick Randomly
          </button>

          <button
            className="primary-button mp-lock-secret-button"
            type="button"
            disabled={!selectedItemId || isSaving}
            onClick={onSave}
          >
            {isSaving
              ? "Saving..."
              : isReady
                ? "Update My Item"
                : "Lock In & Get Ready"}
          </button>
        </div>

        <div className="mp-inline-start-status">
          <div>
            <span>
              {allPlayersReady ? "🎉" : "⏳"}
            </span>

            <div>
              <strong>
                {allPlayersReady
                  ? "Both players are ready"
                  : "Waiting for both players"}
              </strong>
              <p>
                {allPlayersReady
                  ? isHost
                    ? "Start the match whenever you are ready."
                    : "The host can start the match now."
                  : "Each player must lock in one private item."}
              </p>
            </div>
          </div>

          {isHost ? (
            <button
              className="primary-button mp-start-button"
              type="button"
              disabled={!allPlayersReady || isStarting}
              onClick={onStart}
            >
              {isStarting
                ? "Starting..."
                : "Start Game"}
            </button>
          ) : (
            <span className="mp-host-will-start">
              {allPlayersReady
                ? "Host will start"
                : "Waiting"}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

function FinalGuessDialog({
  items,
  eliminatedIds,
  isSubmitting,
  onClose,
  onGuess,
}) {
  const activeItems = items.filter(
    (item) => !eliminatedIds.includes(item.id),
  );
  const guessItems =
    activeItems.length > 0 ? activeItems : items;

  return (
    <div
      className="modal-backdrop mp-final-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="final-guess-modal mp-final-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mp-final-title"
      >
        <button
          className="modal-close-button"
          type="button"
          onClick={onClose}
          aria-label="Close final guess"
        >
          ×
        </button>

        <div className="modal-heading">
          <span className="modal-icon">🎯</span>
          <span className="screen-eyebrow">
            Final answer
          </span>
          <h2 id="mp-final-title">
            Guess your opponent’s item
          </h2>
          <p>
            This ends the round immediately. Pick carefully!
          </p>
        </div>

        <div className="modal-filter-message">
          Showing {guessItems.length} card
          {guessItems.length === 1 ? "" : "s"} still
          standing.
        </div>

        <div className="final-guess-grid mp-final-grid">
          {guessItems.map((item) => (
            <button
              className="final-guess-option"
              type="button"
              key={item.id}
              disabled={isSubmitting}
              onClick={() => onGuess(item.id)}
            >
              <ItemArtwork
                item={item}
                className="final-guess-item-artwork"
              />
              <strong>{item.name}</strong>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function MultiplayerLobby({
  session,
  onLeave,
}) {
  const [liveSession, setLiveSession] =
    useState(session);
  const sessionRef = useRef(session);
  const socketRef = useRef(null);
  const refreshPromiseRef = useRef(null);

  const [selectedSecretId, setSelectedSecretId] =
    useState(session.game?.secretItemId || "");
  const [eliminatedIds, setEliminatedIds] =
    useState(
      session.game?.eliminatedItemIds || [],
    );
  const [messages, setMessages] = useState(
    session.messages || [],
  );
  const [chatValue, setChatValue] = useState("");
  const [isChatOpen, setIsChatOpen] =
    useState(false);
  const [isChatMinimized, setIsChatMinimized] =
    useState(() => {
      try {
        const savedValue = sessionStorage.getItem(
          `guessTheWhatChatMinimized:${session.room.code}`,
        );

        return savedValue === null
          ? true
          : savedValue === "true";
      } catch {
        return false;
      }
    });
  const [unreadChatCount, setUnreadChatCount] =
    useState(0);
  const isChatOpenRef = useRef(false);
  const isChatMinimizedRef = useRef(
    isChatMinimized,
  );
  const [isSecretVisible, setIsSecretVisible] =
    useState(false);
  const [isFinalGuessOpen, setIsFinalGuessOpen] =
    useState(false);
  const [copiedValue, setCopiedValue] =
    useState("");
  const [connectionState, setConnectionState] =
    useState("connecting");
  const [busyAction, setBusyAction] =
    useState("");
  const [errorMessage, setErrorMessage] =
    useState("");
  const [noticeMessage, setNoticeMessage] =
    useState("");
  const [isInitialLoading, setIsInitialLoading] =
    useState(true);

  const applyServerSession = useCallback(
    (response) => {
      const nextSession = createSessionFromResponse(
        response,
        sessionRef.current,
      );

      sessionRef.current = nextSession;
      setLiveSession(nextSession);
      setSelectedSecretId(
        nextSession.game?.secretItemId || "",
      );
      setEliminatedIds(
        nextSession.game?.eliminatedItemIds || [],
      );
      setMessages(nextSession.messages || []);
      saveMultiplayerSession(nextSession);

      return nextSession;
    },
    [],
  );

  const refreshRoom = useCallback(
    async ({ quiet = false } = {}) => {
      if (refreshPromiseRef.current) {
        return refreshPromiseRef.current;
      }

      if (!quiet) {
        setErrorMessage("");
      }

      const refreshPromise =
        restoreMultiplayerSession(
          sessionRef.current,
        )
          .then((response) =>
            applyServerSession(response),
          )
          .catch((error) => {
            setErrorMessage(
              error instanceof Error
                ? error.message
                : "Unable to restore the room.",
            );
            throw error;
          })
          .finally(() => {
            refreshPromiseRef.current = null;
            setIsInitialLoading(false);
          });

      refreshPromiseRef.current = refreshPromise;
      return refreshPromise;
    },
    [applyServerSession],
  );

  useEffect(() => {
    document.body.classList.add("mp-room-active");

    return () => {
      document.body.classList.remove("mp-room-active");
      document.body.classList.remove(
        "mp-room-setup-active",
      );
    };
  }, []);

  useEffect(() => {
    const isSetupScreen = ![
      "playing",
      "finished",
    ].includes(liveSession.room?.status);

    document.body.classList.toggle(
      "mp-room-setup-active",
      isSetupScreen,
    );

    return () => {
      document.body.classList.remove(
        "mp-room-setup-active",
      );
    };
  }, [liveSession.room?.status]);

  useEffect(() => {
    isChatOpenRef.current = isChatOpen;

    if (isChatOpen) {
      setUnreadChatCount(0);
    }
  }, [isChatOpen]);

  useEffect(() => {
    isChatMinimizedRef.current = isChatMinimized;

    try {
      sessionStorage.setItem(
        `guessTheWhatChatMinimized:${liveSession.room?.code || session.room.code}`,
        String(isChatMinimized),
      );
    } catch {
      // Chat preference is optional.
    }

    if (!isChatMinimized) {
      setUnreadChatCount(0);
    }
  }, [
    isChatMinimized,
    liveSession.room?.code,
    session.room.code,
  ]);

  useEffect(() => {
    refreshRoom().catch(() => {
      // The error is displayed in the room interface.
    });
  }, [refreshRoom]);

  useEffect(() => {
    let socket;

    try {
      socket = connectMultiplayerSocket(
        sessionRef.current,
      );
    } catch (error) {
      setConnectionState("disconnected");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to connect to the live room.",
      );
      return undefined;
    }

    socketRef.current = socket;

    const handleConnect = () => {
      setConnectionState("connected");
      setErrorMessage("");
    };

    const handleDisconnect = () => {
      setConnectionState("disconnected");
    };

    const handleConnectError = (error) => {
      setConnectionState("disconnected");
      setErrorMessage(
        error?.message ||
          "The live room connection was interrupted.",
      );
    };

    const handleRoomChanged = () => {
      refreshRoom({ quiet: true }).catch(() => {
        // The restore error is displayed above the room.
      });
    };

    const handleChatMessage = (message) => {
      setMessages((currentMessages) => {
        if (
          currentMessages.some(
            (currentMessage) =>
              currentMessage.id === message.id,
          )
        ) {
          return currentMessages;
        }

        return [...currentMessages, message];
      });

      const isOwnMessage =
        message.playerId ===
        sessionRef.current.player.id;

      if (
        !isOwnMessage &&
        (isChatMinimizedRef.current ||
          !isChatOpenRef.current)
      ) {
        setUnreadChatCount(
          (currentCount) => currentCount + 1,
        );
      }
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on(
      "connect_error",
      handleConnectError,
    );
    socket.on(
      "room:changed",
      handleRoomChanged,
    );
    socket.on(
      "chat:message",
      handleChatMessage,
    );

    return () => {
      socket.off("connect", handleConnect);
      socket.off(
        "disconnect",
        handleDisconnect,
      );
      socket.off(
        "connect_error",
        handleConnectError,
      );
      socket.off(
        "room:changed",
        handleRoomChanged,
      );
      socket.off(
        "chat:message",
        handleChatMessage,
      );
      socket.disconnect();
      socketRef.current = null;
    };
  }, [refreshRoom]);

  const room = liveSession.room;
  const currentPlayer = liveSession.player;
  const players = liveSession.players || [];
  const boardItems =
    room.boardSnapshot?.items || [];

  const opponent = players.find(
    (player) => player.id !== currentPlayer.id,
  );

  const selectedSecret = boardItems.find(
    (item) => item.id === selectedSecretId,
  );

  const allPlayersReady =
    players.length === room.maxPlayers &&
    players.every(
      (player) =>
        player.isReady && player.hasSecret,
    );

  const currentPlayerFromList = players.find(
    (player) => player.id === currentPlayer.id,
  );

  const currentPlayerReady = Boolean(
    currentPlayerFromList?.isReady &&
      currentPlayerFromList?.hasSecret,
  );

  const activeItems = useMemo(
    () =>
      boardItems.filter(
        (item) =>
          !eliminatedIds.includes(item.id),
      ),
    [boardItems, eliminatedIds],
  );

  const handleCopy = async (
    value,
    copyType,
  ) => {
    try {
      await copyText(value);
      setCopiedValue(copyType);

      window.setTimeout(() => {
        setCopiedValue("");
      }, 1800);
    } catch {
      setErrorMessage(
        "Unable to copy that value.",
      );
    }
  };

  const handleRandomSecret = () => {
    if (boardItems.length === 0) {
      return;
    }

    const availableItems = boardItems.filter(
      (item) => item.id !== selectedSecretId,
    );
    const randomPool =
      availableItems.length > 0
        ? availableItems
        : boardItems;
    const randomItem =
      randomPool[
        Math.floor(Math.random() * randomPool.length)
      ];

    setSelectedSecretId(randomItem.id);
    setNoticeMessage(
      `${randomItem.name} was selected randomly. Lock it in when ready.`,
    );
  };

  const handleSaveSecret = async () => {
    if (!selectedSecretId) {
      return;
    }

    setBusyAction("secret");
    setErrorMessage("");
    setNoticeMessage("");

    try {
      const response =
        await selectMultiplayerSecret(
          sessionRef.current,
          selectedSecretId,
        );

      applyServerSession(response);
      setNoticeMessage(
        "Your mystery item is locked in. You are ready!",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to save your mystery item.",
      );
    } finally {
      setBusyAction("");
    }
  };

  const handleStartGame = async () => {
    setBusyAction("start");
    setErrorMessage("");
    setNoticeMessage("");

    try {
      const response =
        await startMultiplayerGame(
          sessionRef.current,
        );

      applyServerSession(response);
      setNoticeMessage("Game started!");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to start the game.",
      );
    } finally {
      setBusyAction("");
    }
  };

  const handleToggleCard = async (itemId) => {
    const previousIds = eliminatedIds;
    const nextIds = previousIds.includes(itemId)
      ? previousIds.filter((id) => id !== itemId)
      : [...previousIds, itemId];

    setEliminatedIds(nextIds);
    setErrorMessage("");

    try {
      const response =
        await updateMultiplayerState(
          sessionRef.current,
          nextIds,
        );

      applyServerSession(response);
    } catch (error) {
      setEliminatedIds(previousIds);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to save your board progress.",
      );
    }
  };

  const handleFinalGuess = async (itemId) => {
    setBusyAction("guess");
    setErrorMessage("");

    try {
      const response =
        await submitMultiplayerGuess(
          sessionRef.current,
          itemId,
        );

      applyServerSession(response);
      setIsFinalGuessOpen(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to submit your final guess.",
      );
    } finally {
      setBusyAction("");
    }
  };

  const handleOpenChat = () => {
    setIsChatMinimized(false);
    setIsChatOpen(true);
    setUnreadChatCount(0);
  };

  const handleToggleChatMinimized = () => {
    setIsChatMinimized(true);
    setIsChatOpen(false);
  };

  const handleSendChat = (event) => {
    event.preventDefault();

    const message = chatValue.trim();
    const socket = socketRef.current;

    if (!message || !socket?.connected) {
      return;
    }

    setBusyAction("chat");
    setErrorMessage("");

    socket.emit(
      "chat:send",
      { message },
      (result) => {
        setBusyAction("");

        if (!result?.success) {
          setErrorMessage(
            result?.message ||
              "Unable to send the message.",
          );
          return;
        }

        setChatValue("");
      },
    );
  };

  const handleResetRound = async () => {
    const shouldReset = window.confirm(
      "Reset this round for both players? Mystery items, flipped cards, results, and chat clues will be cleared.",
    );

    if (!shouldReset) {
      return;
    }

    setBusyAction("reset");
    setErrorMessage("");
    setNoticeMessage("");

    try {
      const response =
        await resetMultiplayerGame(
          sessionRef.current,
        );

      applyServerSession(response);
      setSelectedSecretId("");
      setEliminatedIds([]);
      setMessages([]);
      setIsSecretVisible(false);
      setIsFinalGuessOpen(false);
      setNoticeMessage(
        "Round reset. Choose new mystery items.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to reset the round.",
      );
    } finally {
      setBusyAction("");
    }
  };

  const handleLeave = async () => {
    const shouldLeave = window.confirm(
      currentPlayer.isHost
        ? "Leave and close this multiplayer room for everyone?"
        : "Leave this multiplayer room?",
    );

    if (!shouldLeave) {
      return;
    }

    setBusyAction("leave");
    setErrorMessage("");

    try {
      await leaveMultiplayerRoom(
        sessionRef.current,
      );
    } catch (error) {
      const shouldLeaveLocally = window.confirm(
        `${
          error instanceof Error
            ? error.message
            : "The server could not process the request."
        }\n\nLeave this room on this device anyway?`,
      );

      if (!shouldLeaveLocally) {
        setBusyAction("");
        return;
      }
    }

    socketRef.current?.disconnect();
    clearMultiplayerSession();
    onLeave();
  };

  const renderMessages = () => (
    <>
      {errorMessage && (
        <div className="mp-alert is-error" role="alert">
          <span>!</span>
          <p>{errorMessage}</p>
          <button
            type="button"
            onClick={() => setErrorMessage("")}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {noticeMessage && (
        <div className="mp-alert is-success">
          <span>✓</span>
          <p>{noticeMessage}</p>
          <button
            type="button"
            onClick={() => setNoticeMessage("")}
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}
    </>
  );

  const renderPlayersPanel = () => (
    <section className="mp-panel mp-players-panel">
      <div className="mp-panel-heading">
        <div>
          <span>Players</span>
          <h3>
            {players.length}/{room.maxPlayers} in room
          </h3>
        </div>

        <span
          className={`mp-room-status ${
            allPlayersReady ? "is-ready" : ""
          }`}
        >
          {allPlayersReady
            ? "Everyone ready"
            : players.length < room.maxPlayers
              ? "Waiting for Player 2"
              : "Choosing mystery items"}
        </span>
      </div>

      <div className="mp-player-list">
        {[1, 2].map((playerNumber) => (
          <PlayerCard
            key={playerNumber}
            player={players.find(
              (player) =>
                (player.playerNumber ||
                  player.number) === playerNumber,
            )}
            playerNumber={playerNumber}
            currentPlayerId={currentPlayer.id}
          />
        ))}
      </div>
    </section>
  );


  const renderLobby = () => (
    <div className="mp-lobby-stage">
      <div
        className={`mp-lobby-grid ${
          currentPlayer.isHost
            ? "is-host"
            : "is-guest"
        }`}
      >
        <div className="mp-lobby-side">
          <aside className="mp-share-card">
            <span className="mp-share-label">
              Room code
            </span>
            <strong className="mp-share-code">
              {room.code}
            </strong>
            <p>
              {currentPlayer.isHost
                ? "Send this code or QR link to Player 2."
                : "You are connected to this private room."}
            </p>

            <button
              className="mp-copy-code-button"
              type="button"
              onClick={() =>
                handleCopy(room.code, "code")
              }
            >
              {copiedValue === "code"
                ? "✓ Code copied"
                : "Copy room code"}
            </button>

            {currentPlayer.isHost && room.joinUrl && (
              <>
                <div className="mp-qr-card">
                  <QRCodeSVG
                    value={room.joinUrl}
                    size={184}
                    bgColor="#ffffff"
                    fgColor="#29263d"
                    level="M"
                    title={`Join room ${room.code}`}
                  />
                </div>

                <button
                  className="mp-copy-link-button"
                  type="button"
                  onClick={() =>
                    handleCopy(
                      room.joinUrl,
                      "link",
                    )
                  }
                >
                  {copiedValue === "link"
                    ? "✓ Join link copied"
                    : "Copy join link"}
                </button>
              </>
            )}
          </aside>

          {renderPlayersPanel()}

          <button
            className="mp-leave-room-button"
            type="button"
            disabled={busyAction === "leave"}
            onClick={handleLeave}
          >
            {currentPlayer.isHost
              ? "Leave and close room"
              : "Leave room"}
          </button>
        </div>

        <div className="mp-lobby-main">
          {players.length < room.maxPlayers ? (
            <section className="mp-secret-section mp-unified-setup-panel is-waiting">
              <div className="mp-setup-header">
                <div className="mp-setup-board-summary">
                  <span className="mp-setup-board-icon">
                    {room.boardSnapshot?.icon || "🎲"}
                  </span>

                  <div>
                    <small>Game board</small>
                    <strong>
                      {room.boardSnapshot?.name ||
                        room.boardId ||
                        "Standard Board"}
                    </strong>
                    <span>{boardItems.length} cards</span>
                  </div>
                </div>

                <div className="mp-setup-heading-copy">
                  <span>Private selection</span>
                  <h3>Choose your mystery item</h3>
                  <p>
                    The board is ready. Player 2 must join
                    before private selections begin.
                  </p>
                </div>

                <span className="mp-setup-ready-pill">
                  Waiting
                </span>
              </div>

              <div className="mp-waiting-card mp-unified-waiting-card">
                <span className="mp-waiting-animation">
                  <i />
                  <i />
                  <i />
                </span>
                <div>
                  <strong>Waiting for Player 2</strong>
                  <p>
                    Keep this page open. The lobby updates
                    automatically when someone joins.
                  </p>
                </div>
              </div>
            </section>
          ) : (
            <SecretPicker
              items={boardItems}
              selectedItemId={selectedSecretId}
              isReady={currentPlayerReady}
              isSaving={busyAction === "secret"}
              onSelect={setSelectedSecretId}
              onRandomize={handleRandomSecret}
              onSave={handleSaveSecret}
              boardName={
                room.boardSnapshot?.name ||
                room.boardId ||
                "Standard Board"
              }
              boardIcon={
                room.boardSnapshot?.icon || "🎲"
              }
              allPlayersReady={allPlayersReady}
              isHost={currentPlayer.isHost}
              isStarting={busyAction === "start"}
              onStart={handleStartGame}
            />
          )}
        </div>
      </div>
    </div>
  );

  const renderGame = () => (
    <div className="mp-game-stage">
      <div className="mp-game-toolbar">
        <div className="mp-game-room">
          <span>Room</span>
          <strong>{room.code}</strong>
        </div>

        <div className="mp-game-matchup">
          <span className="mp-mini-avatar">
            {currentPlayer.name
              .charAt(0)
              .toUpperCase()}
          </span>
          <div>
            <small>You</small>
            <strong>{currentPlayer.name}</strong>
          </div>
          <span className="mp-versus">VS</span>
          <span className="mp-mini-avatar is-opponent">
            {opponent?.name
              ?.charAt(0)
              .toUpperCase() || "?"}
          </span>
          <div>
            <small>Opponent</small>
            <strong>
              {opponent?.name || "Player 2"}
            </strong>
          </div>
        </div>

        <div className="mp-opponent-progress">
          <small>Opponent’s board</small>
          <strong>
            {opponent?.standingCount ??
              boardItems.length}{" "}
            standing
          </strong>
        </div>
      </div>

      <div className="mp-mystery-row">
        <button
          className={`mystery-holder mp-mystery-holder ${
            isSecretVisible ? "is-revealed" : ""
          }`}
          type="button"
          onClick={() =>
            setIsSecretVisible(
              (currentValue) => !currentValue,
            )
          }
          aria-pressed={isSecretVisible}
        >
          <span className="mystery-holder-label">
            Your Mystery Item
          </span>

          <span className="mystery-holder-content">
            {isSecretVisible && selectedSecret ? (
              <>
                <ItemArtwork
                  item={selectedSecret}
                  className="mystery-holder-emoji"
                />
                <strong>{selectedSecret.name}</strong>
              </>
            ) : (
              <>
                <span className="mystery-holder-question">
                  ?
                </span>
                <strong>Tap to privately reveal</strong>
              </>
            )}
          </span>
        </button>

        <div className="mp-game-progress-card">
          <span>Board progress</span>
          <strong>
            {activeItems.length} standing
          </strong>
          <p>
            {eliminatedIds.length} eliminated · Your
            changes are saved automatically.
          </p>
        </div>
      </div>

      <div className="physical-game-board mp-online-board">
        <div className="board-top-detail">
          <span />
          <strong>Flip down eliminated cards</strong>
          <span />
        </div>

        <div className="guessing-card-grid">
          {boardItems.map((item) => {
            const isEliminated =
              eliminatedIds.includes(item.id);

            return (
              <button
                className={`guessing-card-slot ${
                  isEliminated
                    ? "is-eliminated"
                    : ""
                }`}
                type="button"
                key={item.id}
                onClick={() =>
                  handleToggleCard(item.id)
                }
                aria-pressed={isEliminated}
              >
                <span className="guessing-slot-cavity">
                  <span className="slot-status-symbol">
                    ×
                  </span>
                  <small>Eliminated</small>
                </span>

                <span className="guessing-card-panel">
                  <span className="guessing-card-hinge">
                    <span />
                    <span />
                  </span>

                  <span className="guessing-card-portrait">
                    <ItemArtwork
                      item={item}
                      className="guessing-card-emoji"
                    />
                  </span>

                  <strong className="guessing-card-name">
                    {item.name}
                  </strong>

                  <span className="guessing-card-handle" />
                </span>
              </button>
            );
          })}
        </div>

        <div className="board-bottom-detail">
          <span>ASK</span>
          <span>FLIP</span>
          <span>GUESS</span>
        </div>
      </div>

      <div className="mp-game-controls">
        <button
          className="secondary-game-button mp-restore-button"
          type="button"
          disabled={eliminatedIds.length === 0}
          onClick={() => {
            const previousIds = eliminatedIds;
            setEliminatedIds([]);

            updateMultiplayerState(
              sessionRef.current,
              [],
            )
              .then(applyServerSession)
              .catch((error) => {
                setEliminatedIds(previousIds);
                setErrorMessage(
                  error instanceof Error
                    ? error.message
                    : "Unable to restore the cards.",
                );
              });
          }}
        >
          ↶ Restore All
        </button>

        {currentPlayer.isHost && (
          <button
            className="secondary-game-button mp-reset-round-button"
            type="button"
            disabled={busyAction === "reset"}
            onClick={handleResetRound}
          >
            {busyAction === "reset"
              ? "Resetting..."
              : "↻ Reset Round"}
          </button>
        )}

        <button
          className="mp-chat-inline-button"
          type="button"
          onClick={handleOpenChat}
        >
          💬 Chat & clues
          {messages.length > 0 && (
            <span>{messages.length}</span>
          )}
        </button>

        <button
          className="final-guess-button mp-final-button"
          type="button"
          onClick={() =>
            setIsFinalGuessOpen(true)
          }
        >
          Make Final Guess
          <span>?</span>
        </button>
      </div>
    </div>
  );

  const renderFinished = () => {
    const result = liveSession.result;
    const winner = players.find(
      (player) =>
        player.id === result?.winnerPlayerId,
    );
    const guesser = players.find(
      (player) =>
        player.id === result?.guesserPlayerId,
    );
    const currentPlayerWon =
      winner?.id === currentPlayer.id;
    const guessedItem = boardItems.find(
      (item) =>
        item.id === result?.guessedItemId,
    );
    const opponentSecretRecord =
      liveSession.revealedSecrets?.find(
        (secret) =>
          secret.playerId === opponent?.id,
      );
    const opponentSecret = boardItems.find(
      (item) =>
        item.id === opponentSecretRecord?.itemId,
    );

    return (
      <div className="mp-finished-stage">
        <section
          className={`mp-result-card ${
            currentPlayerWon ? "is-winner" : "is-loser"
          }`}
        >
          <span className="mp-result-confetti">
            {currentPlayerWon ? "🎉" : "🎭"}
          </span>
          <span className="screen-eyebrow">
            Round finished
          </span>
          <h2>
            {currentPlayerWon
              ? "You won the round!"
              : `${winner?.name || "Your opponent"} won!`}
          </h2>
          <p>
            {result?.wasCorrect
              ? `${guesser?.name || "A player"} made the correct final guess.`
              : `${guesser?.name || "A player"} made an incorrect final guess.`}
          </p>

          <div className="mp-result-reveal-grid">
            <article>
              <small>Final guess</small>
              <ItemArtwork
                item={guessedItem}
                className="mp-result-art"
              />
              <strong>
                {guessedItem?.name || "Unknown"}
              </strong>
            </article>

            <article>
              <small>
                {opponent?.name || "Opponent"}’s item
              </small>
              <ItemArtwork
                item={opponentSecret}
                className="mp-result-art"
              />
              <strong>
                {opponentSecret?.name || "Unknown"}
              </strong>
            </article>
          </div>

          <div className="mp-result-actions">
            {currentPlayer.isHost && (
              <button
                className="primary-button"
                type="button"
                disabled={busyAction === "reset"}
                onClick={handleResetRound}
              >
                {busyAction === "reset"
                  ? "Resetting..."
                  : "Play Again — Reset Round"}
              </button>
            )}

            <button
              className="secondary-game-button"
              type="button"
              onClick={handleOpenChat}
            >
              View chat
            </button>

            <button
              className="secondary-game-button"
              type="button"
              onClick={handleLeave}
            >
              Leave Room
            </button>
          </div>
        </section>
      </div>
    );
  };

  if (isInitialLoading) {
    return (
      <section className="content-screen mp-loading-screen">
        <div className="mp-loading-card">
          <span>🎲</span>
          <h2>Restoring your room...</h2>
          <p>
            Checking the latest lobby and game state.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`content-screen multiplayer-lobby-screen mp-experience screen-enter mp-status-${room.status}`}
    >
      <div className="mp-experience-heading">
        <div>
          <span className="screen-eyebrow">
            {room.status === "playing"
              ? "Online Match"
              : room.status === "finished"
                ? "Game Result"
                : "Multiplayer Lobby"}
          </span>
          <div className="mp-title-row">
            <h2>
              {room.status === "playing"
                ? "Ask. Eliminate. Guess."
                : room.status === "finished"
                  ? "The mystery is revealed"
                  : currentPlayer.isHost
                    ? "Your room is ready"
                    : "You joined the room"}
            </h2>
          </div>
          <p>
            {room.status === "playing"
              ? "Use chat for questions and flip down cards that no longer match."
              : room.status === "finished"
                ? "See who won and reveal both mystery items."
                : currentPlayer.isHost
                  ? "Invite Player 2, choose private mystery items, then start the round."
                  : "Choose your private mystery item and wait for the host to start."}
          </p>
        </div>

        <div
          className={`mp-live-status ${
            connectionState === "connected"
              ? "is-connected"
              : ""
          }`}
        >
          <span />
          {connectionState === "connected"
            ? "Live"
            : "Reconnecting"}
        </div>
      </div>

      {renderMessages()}

      <div
        className={`mp-experience-layout ${
          isChatMinimized
            ? "is-chat-minimized"
            : ""
        }`}
      >
        <main className="mp-main-column">
          {room.status === "playing"
            ? renderGame()
            : room.status === "finished"
              ? renderFinished()
              : renderLobby()}
        </main>

        <ChatPanel
          messages={messages}
          currentPlayer={currentPlayer}
          value={chatValue}
          onChange={setChatValue}
          onSend={handleSendChat}
          isOpen={isChatOpen}
          onClose={handleToggleChatMinimized}
          isConnected={
            connectionState === "connected"
          }
          isSending={busyAction === "chat"}
          isMinimized={isChatMinimized}
          onToggleMinimize={
            handleToggleChatMinimized
          }
          unreadCount={unreadChatCount}
        />
      </div>

      {(!isChatOpen || isChatMinimized) && (
        <button
          className="mp-floating-chat-button"
          type="button"
          onClick={handleOpenChat}
          aria-label="Open chat and clues"
        >
          <span>💬</span>
          <span className="mp-floating-chat-label">Chat</span>
          {unreadChatCount > 0 && (
            <strong>
              {unreadChatCount > 99
                ? "99+"
                : unreadChatCount}
            </strong>
          )}
        </button>
      )}

      {isFinalGuessOpen && (
        <FinalGuessDialog
          items={boardItems}
          eliminatedIds={eliminatedIds}
          isSubmitting={busyAction === "guess"}
          onClose={() =>
            setIsFinalGuessOpen(false)
          }
          onGuess={handleFinalGuess}
        />
      )}
    </section>
  );
}

export default MultiplayerLobby;
