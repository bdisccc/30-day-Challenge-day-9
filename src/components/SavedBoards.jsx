import { useCallback, useEffect, useState } from "react";
import {
  deleteBoard,
  duplicateBoard,
  getAllBoards,
} from "../utils/boardDatabase";

function isBoardPlayable(board) {
  const expectedSize = Number(board.boardSize);

  return (
    Boolean(board.title?.trim()) &&
    Boolean(board.category?.trim()) &&
    board.items?.length === expectedSize &&
    board.items.every((item) => item.name?.trim())
  );
}

function formatUpdatedDate(dateValue) {
  if (!dateValue) {
    return "Unknown date";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function SavedBoards({
  refreshKey = 0,
  onCreate,
  onEdit,
  onPlay,
}) {
  const [boards, setBoards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyBoardId, setBusyBoardId] = useState(null);
  const [message, setMessage] = useState(null);

  const loadBoards = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      const savedBoards = await getAllBoards();
      setBoards(savedBoards);
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Unable to load saved boards.",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBoards();
  }, [loadBoards, refreshKey]);

  const handleDuplicate = async (board) => {
    setBusyBoardId(board.id);
    setMessage(null);

    try {
      await duplicateBoard(board);
      await loadBoards();

      setMessage({
        type: "success",
        text: `"${board.title}" was duplicated.`,
      });
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Unable to duplicate this board.",
      });
    } finally {
      setBusyBoardId(null);
    }
  };

  const handleDelete = async (board) => {
    const shouldDelete = window.confirm(
      `Delete "${board.title}"? This cannot be undone.`,
    );

    if (!shouldDelete) {
      return;
    }

    setBusyBoardId(board.id);
    setMessage(null);

    try {
      await deleteBoard(board.id);

      setBoards((currentBoards) =>
        currentBoards.filter(
          (currentBoard) => currentBoard.id !== board.id,
        ),
      );

      setMessage({
        type: "success",
        text: `"${board.title}" was deleted.`,
      });
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Unable to delete this board.",
      });
    } finally {
      setBusyBoardId(null);
    }
  };

  if (isLoading) {
    return (
      <section className="content-screen saved-boards-screen screen-enter">
        <div className="saved-boards-loading">
          <span className="saved-boards-loading-icon">▣</span>
          <strong>Loading your boards...</strong>
        </div>
      </section>
    );
  }

  return (
    <section className="content-screen saved-boards-screen screen-enter">
      <div className="saved-boards-heading">
        <div className="screen-heading">
          <span className="screen-eyebrow">Custom Mode</span>
          <h2>Your saved boards</h2>
          <p>
            Play, edit, duplicate, or delete boards stored on this device.
          </p>
        </div>

        <button
          className="primary-button saved-boards-create-button"
          type="button"
          onClick={onCreate}
        >
          <span>＋</span>
          Create a Board
        </button>
      </div>

      {message && (
        <div
          className={`builder-message builder-message-${message.type}`}
          role="status"
        >
          <span>{message.text}</span>

          <button
            type="button"
            onClick={() => setMessage(null)}
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}

      {boards.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon">▣</span>
          <h3>No saved boards yet</h3>

          <p>
            Upload your own images and create a board for people, animals,
            characters, logos, classroom topics, or anything else.
          </p>

          <button
            className="primary-button"
            type="button"
            onClick={onCreate}
          >
            Create Your First Board
          </button>
        </div>
      ) : (
        <div className="saved-board-grid">
          {boards.map((board) => {
            const playable = isBoardPlayable(board);
            const isBusy = busyBoardId === board.id;
            const previewItems = board.items?.slice(0, 4) || [];

            return (
              <article className="saved-board-card" key={board.id}>
                <div className="saved-board-preview">
                  <div
                    className={`saved-board-preview-grid preview-count-${Math.min(
                      previewItems.length,
                      4,
                    )}`}
                  >
                    {previewItems.map((item) => (
                      <div
                        className="saved-board-preview-item"
                        key={item.id}
                      >
                        <img
  src={item.image}
  alt=""
  draggable="false"
  style={{
    objectPosition: `${
      item.imagePositionX ?? 50
    }% ${item.imagePositionY ?? 50}%`,
    transform: `scale(${item.imageZoom ?? 1})`,
    transformOrigin: `${
      item.imagePositionX ?? 50
    }% ${item.imagePositionY ?? 50}%`,
  }}
/>
                      </div>
                    ))}

                    {previewItems.length === 0 && (
                      <div className="saved-board-no-preview">
                        <span>?</span>
                      </div>
                    )}
                  </div>

                  <span
                    className={`saved-board-status ${
                      playable ? "is-complete" : "is-draft"
                    }`}
                  >
                    {playable ? "Ready to Play" : "Draft"}
                  </span>
                </div>

                <div className="saved-board-information">
                  <span className="saved-board-category">
                    {board.category || "Uncategorized"}
                  </span>

                  <h3>{board.title || "Untitled Board"}</h3>

                  <div className="saved-board-metadata">
                    <span>
                      <strong>{board.items?.length || 0}</strong>/
                      {board.boardSize} cards
                    </span>

                    <span>
                      Updated {formatUpdatedDate(board.updatedAt)}
                    </span>
                  </div>
                </div>

                <div className="saved-board-actions">
                  <button
                    className="saved-board-play-button"
                    type="button"
                    disabled={!playable || isBusy}
                    onClick={() => onPlay(board)}
                    title={
                      playable
                        ? "Play this board"
                        : "Complete this board before playing"
                    }
                  >
                    ▶ Play
                  </button>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => onEdit(board)}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleDuplicate(board)}
                  >
                    Duplicate
                  </button>

                  <button
                    className="saved-board-delete-button"
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleDelete(board)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default SavedBoards;