import { useEffect, useMemo, useRef, useState } from "react";
import { saveBoard } from "../utils/boardDatabase";
import ImagePositionEditor from "./ImagePositionEditor";

const supportedBoardSizes = [8, 12, 16, 20, 24];

const maximumFileSize = 8 * 1024 * 1024;
const maximumImageDimension = 900;

function normalizeBoardItem(item) {
  return {
    ...item,
    imagePositionX: item.imagePositionX ?? 50,
    imagePositionY: item.imagePositionY ?? 50,
    imageZoom: item.imageZoom ?? 1,
  };
}

function createEmptyBoard() {
  return {
    id: crypto.randomUUID(),
    title: "",
    category: "",
    boardSize: 24,
    items: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function createItemName(filename) {
  return filename
    .replace(/\.[^/.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();

    fileReader.onload = () => {
      resolve(fileReader.result);
    };

    fileReader.onerror = () => {
      reject(new Error(`Unable to read ${file.name}.`));
    };

    fileReader.readAsDataURL(file);
  });
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      resolve(image);
    };

    image.onerror = () => {
      reject(new Error("Unable to process one of the images."));
    };

    image.src = source;
  });
}

async function compressImage(file) {
  const source = await readImageFile(file);
  const image = await loadImage(source);

  let width = image.naturalWidth;
  let height = image.naturalHeight;

  if (width > maximumImageDimension || height > maximumImageDimension) {
    const scale = Math.min(
      maximumImageDimension / width,
      maximumImageDimension / height,
    );

    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = width;
  canvas.height = height;

  if (!context) {
    throw new Error("Image compression is unavailable.");
  }

  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL("image/webp", 0.82);
}

function BoardBuilder({
  initialBoard = null,
  onSaved,
  onCancel,
  onStartPlaying,
  onDirtyChange,
}) {
  const [board, setBoard] = useState(
    initialBoard
      ? {
          ...initialBoard,
          items: initialBoard.items.map(normalizeBoardItem),
        }
      : createEmptyBoard(),
  );

  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [message, setMessage] = useState(null);
  const [editingImageItemId, setEditingImageItemId] = useState(null);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [draggedItemId, setDraggedItemId] = useState(null);

  const [dragOverItemId, setDragOverItemId] = useState(null);

  const markDirty = () => {
    setHasUnsavedChanges(true);
  };
  useEffect(() => {
    if (onDirtyChange) {
      onDirtyChange(hasUnsavedChanges);
    }
  }, [hasUnsavedChanges, onDirtyChange]);

  useEffect(() => {
    return () => {
      if (onDirtyChange) {
        onDirtyChange(false);
      }
    };
  }, [onDirtyChange]);

  const fileInputRef = useRef(null);

  const editingImageItem =
    board.items.find((item) => item.id === editingImageItemId) || null;

  const updateImageSettings = (itemId, updates) => {
    markDirty();

    setBoard((currentBoard) => ({
      ...currentBoard,
      items: currentBoard.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              ...updates,
            }
          : item,
      ),
      updatedAt: new Date().toISOString(),
    }));
  };

  useEffect(() => {
    if (!initialBoard) {
      return;
    }

    setBoard({
      ...initialBoard,
      items: initialBoard.items.map(normalizeBoardItem),
    });

    setHasUnsavedChanges(false);
  }, [initialBoard]);

  const duplicateNames = useMemo(() => {
    const nameCounts = {};

    board.items.forEach((item) => {
      const normalizedName = item.name.trim().toLowerCase();

      if (!normalizedName) {
        return;
      }

      nameCounts[normalizedName] = (nameCounts[normalizedName] || 0) + 1;
    });

    return Object.keys(nameCounts).filter((name) => nameCounts[name] > 1);
  }, [board.items]);

  const blankNameCount = useMemo(
    () => board.items.filter((item) => !item.name.trim()).length,
    [board.items],
  );

  const hasExactItemCount = board.items.length === Number(board.boardSize);

  const isReadyToPlay =
    Boolean(board.title.trim()) &&
    Boolean(board.category.trim()) &&
    hasExactItemCount &&
    blankNameCount === 0 &&
    duplicateNames.length === 0;

  const updateBoardField = (field, value) => {
    markDirty();

    setBoard((currentBoard) => ({
      ...currentBoard,
      [field]: value,
      updatedAt: new Date().toISOString(),
    }));
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
  };

  const clearMessage = () => {
    setMessage(null);
  };

  const processFiles = async (fileList) => {
    clearMessage();

    const files = Array.from(fileList);
    const availableSlots = Number(board.boardSize) - board.items.length;

    if (availableSlots <= 0) {
      showMessage(
        "error",
        `This board already contains ${board.boardSize} items.`,
      );
      return;
    }

    const validFiles = files
      .filter((file) => file.type.startsWith("image/"))
      .filter((file) => file.size <= maximumFileSize)
      .slice(0, availableSlots);

    const invalidTypeCount = files.filter(
      (file) => !file.type.startsWith("image/"),
    ).length;

    const oversizedCount = files.filter(
      (file) => file.type.startsWith("image/") && file.size > maximumFileSize,
    ).length;

    if (validFiles.length === 0) {
      showMessage(
        "error",
        "Please upload valid image files smaller than 8 MB.",
      );
      return;
    }

    setIsProcessingImages(true);

    try {
      const processedItems = [];

      for (const file of validFiles) {
        const compressedImage = await compressImage(file);

        processedItems.push({
          id: crypto.randomUUID(),
          name: createItemName(file.name),
          image: compressedImage,
          imagePositionX: 50,
          imagePositionY: 50,
          imageZoom: 1,
          description: "",
          traits: [],
          hints: [],
        });
      }

      markDirty();

      setBoard((currentBoard) => ({
        ...currentBoard,
        items: [...currentBoard.items, ...processedItems],
        updatedAt: new Date().toISOString(),
      }));

      const ignoredMessages = [];

      if (files.length > availableSlots) {
        ignoredMessages.push(
          `${files.length - availableSlots} image${
            files.length - availableSlots === 1 ? "" : "s"
          } exceeded the selected board size`,
        );
      }

      if (invalidTypeCount > 0) {
        ignoredMessages.push(
          `${invalidTypeCount} non-image file${
            invalidTypeCount === 1 ? "" : "s"
          }`,
        );
      }

      if (oversizedCount > 0) {
        ignoredMessages.push(
          `${oversizedCount} image${
            oversizedCount === 1 ? "" : "s"
          } larger than 8 MB`,
        );
      }

      if (ignoredMessages.length > 0) {
        showMessage(
          "warning",
          `Images added. Ignored: ${ignoredMessages.join(", ")}.`,
        );
      } else {
        showMessage(
          "success",
          `${processedItems.length} image${
            processedItems.length === 1 ? "" : "s"
          } added successfully.`,
        );
      }
    } catch (error) {
      showMessage(
        "error",
        error instanceof Error
          ? error.message
          : "Unable to process the selected images.",
      );
    } finally {
      setIsProcessingImages(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleFileInput = (event) => {
    processFiles(event.target.files);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDraggingOver(false);

    if (event.dataTransfer.files.length > 0) {
      processFiles(event.dataTransfer.files);
    }
  };

  const updateItemName = (itemId, name) => {
    markDirty();

    setBoard((currentBoard) => ({
      ...currentBoard,
      items: currentBoard.items.map((item) =>
        item.id === itemId ? { ...item, name } : item,
      ),
      updatedAt: new Date().toISOString(),
    }));
  };

  const replaceItemImage = async (itemId, file) => {
    clearMessage();

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      showMessage("error", "Please select a valid image file.");
      return;
    }

    if (file.size > maximumFileSize) {
      showMessage("error", "The replacement image must be smaller than 8 MB.");
      return;
    }

    setIsProcessingImages(true);

    try {
      const compressedImage = await compressImage(file);

      markDirty();

      setBoard((currentBoard) => ({
        ...currentBoard,
        items: currentBoard.items.map((item) =>
          item.id === itemId
            ? {
                ...item,
                image: compressedImage,
                imagePositionX: 50,
                imagePositionY: 50,
                imageZoom: 1,
              }
            : item,
        ),
        updatedAt: new Date().toISOString(),
      }));

      showMessage("success", "Image replaced successfully.");
    } catch (error) {
      showMessage(
        "error",
        error instanceof Error ? error.message : "Unable to replace the image.",
      );
    } finally {
      setIsProcessingImages(false);
    }
  };

  const deleteItem = (itemId) => {
    markDirty();

    setBoard((currentBoard) => ({
      ...currentBoard,
      items: currentBoard.items.filter((item) => item.id !== itemId),
      updatedAt: new Date().toISOString(),
    }));
  };

  const moveItem = (itemIndex, direction) => {
    const destinationIndex = itemIndex + direction;

    if (destinationIndex < 0 || destinationIndex >= board.items.length) {
      return;
    }

    markDirty();

    setBoard((currentBoard) => {
      const reorderedItems = [...currentBoard.items];

      [reorderedItems[itemIndex], reorderedItems[destinationIndex]] = [
        reorderedItems[destinationIndex],
        reorderedItems[itemIndex],
      ];

      return {
        ...currentBoard,
        items: reorderedItems,
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const moveItemToPosition = (draggedId, destinationId) => {
    if (!draggedId || !destinationId || draggedId === destinationId) {
      return;
    }

    markDirty();

    setBoard((currentBoard) => {
      const reorderedItems = [...currentBoard.items];

      const draggedIndex = reorderedItems.findIndex(
        (item) => item.id === draggedId,
      );

      const destinationIndex = reorderedItems.findIndex(
        (item) => item.id === destinationId,
      );

      if (draggedIndex === -1 || destinationIndex === -1) {
        return currentBoard;
      }

      const [draggedItem] = reorderedItems.splice(draggedIndex, 1);

      reorderedItems.splice(destinationIndex, 0, draggedItem);

      return {
        ...currentBoard,
        items: reorderedItems,
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const clearDragState = () => {
    setDraggedItemId(null);
    setDragOverItemId(null);
  };

  const handleBoardSizeChange = (event) => {
    const nextBoardSize = Number(event.target.value);

    if (board.items.length > nextBoardSize) {
      const shouldReduceBoard = window.confirm(
        `Changing to ${nextBoardSize} cards will remove ${
          board.items.length - nextBoardSize
        } item${
          board.items.length - nextBoardSize === 1 ? "" : "s"
        } from the end of the board. Continue?`,
      );

      if (!shouldReduceBoard) {
        return;
      }
    }

    markDirty();

    setBoard((currentBoard) => ({
      ...currentBoard,
      boardSize: nextBoardSize,
      items: currentBoard.items.slice(0, nextBoardSize),
      updatedAt: new Date().toISOString(),
    }));
  };

  const validateForSaving = () => {
    if (!board.title.trim()) {
      showMessage("error", "Enter a title for your board.");
      return false;
    }

    if (!board.category.trim()) {
      showMessage("error", "Enter a category name.");
      return false;
    }

    if (board.items.length === 0) {
      showMessage("error", "Upload at least one image before saving.");
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    clearMessage();

    if (!validateForSaving()) {
      return;
    }

    setIsSaving(true);

    try {
      const timestamp = new Date().toISOString();

      const boardToSave = {
        ...board,
        title: board.title.trim(),
        category: board.category.trim(),
        updatedAt: timestamp,
        createdAt: board.createdAt || timestamp,
        isComplete: isReadyToPlay,
      };

      await saveBoard(boardToSave);

      setHasUnsavedChanges(false);
      setBoard(boardToSave);

      showMessage(
        "success",
        isReadyToPlay
          ? "Board saved and ready to play."
          : "Board saved as a draft.",
      );

      if (onSaved) {
        onSaved(boardToSave);
      }
    } catch (error) {
      showMessage(
        "error",
        error instanceof Error ? error.message : "Unable to save the board.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartPlaying = async () => {
    clearMessage();

    if (!isReadyToPlay) {
      showMessage(
        "error",
        "Complete the board and resolve all validation issues before playing.",
      );
      return;
    }

    setIsSaving(true);

    try {
      const boardToSave = {
        ...board,
        title: board.title.trim(),
        category: board.category.trim(),
        updatedAt: new Date().toISOString(),
        isComplete: true,
      };

      await saveBoard(boardToSave);

      setHasUnsavedChanges(false);
      setBoard(boardToSave);

      if (onSaved) {
        onSaved(boardToSave);
      }

      if (onStartPlaying) {
        onStartPlaying(boardToSave);
      }
    } catch (error) {
      showMessage(
        "error",
        error instanceof Error ? error.message : "Unable to prepare the board.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="content-screen board-builder-screen screen-enter">
      <div className="screen-heading">
        <span className="screen-eyebrow">Custom Mode</span>
        <h2>{initialBoard ? "Edit your board" : "Create your board"}</h2>
        <p>
          Upload your images, name every item, arrange the cards, and save the
          board on this device.
        </p>
      </div>

      {message && (
        <div
          className={`builder-message builder-message-${message.type}`}
          role="status"
        >
          <span>{message.text}</span>

          <button
            type="button"
            onClick={clearMessage}
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}

      <div className="builder-layout">
        <aside className="builder-settings-panel">
          <div className="builder-panel-heading">
            <span>1</span>

            <div>
              <strong>Board details</strong>
              <small>Name and configure your board.</small>
            </div>
          </div>

          <label className="builder-field">
            <span>Board title</span>

            <input
              type="text"
              value={board.title}
              maxLength={60}
              placeholder="Example: Guess the Pokémon"
              onChange={(event) =>
                updateBoardField("title", event.target.value)
              }
            />

            <small>{board.title.length}/60</small>
          </label>

          <label className="builder-field">
            <span>Category</span>

            <input
              type="text"
              value={board.category}
              maxLength={40}
              placeholder="Example: Pokémon"
              onChange={(event) =>
                updateBoardField("category", event.target.value)
              }
            />
          </label>

          <label className="builder-field">
            <span>Board size</span>

            <select value={board.boardSize} onChange={handleBoardSizeChange}>
              {supportedBoardSizes.map((boardSize) => (
                <option value={boardSize} key={boardSize}>
                  {boardSize} cards
                </option>
              ))}
            </select>
          </label>

          <div className="builder-progress">
            <div className="builder-progress-heading">
              <span>Board progress</span>

              <strong>
                {board.items.length}/{board.boardSize}
              </strong>
            </div>

            <div className="builder-progress-track">
              <span
                style={{
                  width: `${Math.min(
                    (board.items.length / board.boardSize) * 100,
                    100,
                  )}%`,
                }}
              />
            </div>
          </div>

          <div className="builder-validation-list">
            <ValidationRow
              complete={Boolean(board.title.trim())}
              text="Board title added"
            />

            <ValidationRow
              complete={Boolean(board.category.trim())}
              text="Category added"
            />

            <ValidationRow
              complete={hasExactItemCount}
              text={`${board.boardSize} images added`}
            />

            <ValidationRow
              complete={blankNameCount === 0}
              text={
                blankNameCount === 0
                  ? "All items have names"
                  : `${blankNameCount} blank item name${
                      blankNameCount === 1 ? "" : "s"
                    }`
              }
            />

            <ValidationRow
              complete={duplicateNames.length === 0}
              text={
                duplicateNames.length === 0
                  ? "No duplicate names"
                  : "Duplicate item names found"
              }
            />
          </div>
        </aside>

        <div className="builder-workspace">
          <div className="builder-section-heading">
            <div className="builder-panel-heading">
              <span>2</span>

              <div>
                <strong>Upload your items</strong>
                <small>Add up to {board.boardSize} images.</small>
              </div>
            </div>

            {board.items.length > 0 && (
              <button
                className="builder-preview-button"
                type="button"
                onClick={() => setShowPreview((currentValue) => !currentValue)}
              >
                {showPreview ? "Edit Items" : "Preview Board"}
              </button>
            )}
          </div>

          {!showPreview && (
            <>
              <button
                className={`builder-upload-zone ${
                  isDraggingOver ? "is-dragging-over" : ""
                }`}
                type="button"
                disabled={
                  isProcessingImages || board.items.length >= board.boardSize
                }
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsDraggingOver(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDraggingOver(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();

                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    setIsDraggingOver(false);
                  }
                }}
                onDrop={handleDrop}
              >
                <span className="builder-upload-icon">🖼️</span>

                <strong>
                  {isProcessingImages
                    ? "Processing images..."
                    : board.items.length >= board.boardSize
                      ? "Board is full"
                      : "Upload or drop images here"}
                </strong>

                <small>PNG, JPG, WEBP, or GIF · Maximum 8 MB each</small>

                <span className="builder-upload-action">Select Images</span>
              </button>

              <input
                ref={fileInputRef}
                className="visually-hidden"
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileInput}
              />

              {board.items.length > 0 && (
                <div className="builder-item-grid">
                  {board.items.map((item, itemIndex) => (
                    <article
                      className={[
                        "builder-item-card",
                        draggedItemId === item.id ? "is-dragging" : "",
                        dragOverItemId === item.id && draggedItemId !== item.id
                          ? "is-drag-over"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      key={item.id}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";

                        if (draggedItemId && draggedItemId !== item.id) {
                          setDragOverItemId(item.id);
                        }
                      }}
                      onDragLeave={(event) => {
                        if (
                          !event.currentTarget.contains(event.relatedTarget)
                        ) {
                          setDragOverItemId((currentId) =>
                            currentId === item.id ? null : currentId,
                          );
                        }
                      }}
                      onDrop={(event) => {
                        event.preventDefault();

                        const sourceItemId =
                          event.dataTransfer.getData("text/plain") ||
                          draggedItemId;

                        moveItemToPosition(sourceItemId, item.id);

                        clearDragState();
                      }}
                    >
                      <div className="builder-item-number">{itemIndex + 1}</div>

                      <span
                        className="builder-drag-handle"
                        role="button"
                        tabIndex={0}
                        draggable="true"
                        title="Drag to reorder"
                        aria-label={`Drag ${
                          item.name || `item ${itemIndex + 1}`
                        } to reorder`}
                        onDragStart={(event) => {
                          setDraggedItemId(item.id);
                          setDragOverItemId(null);

                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", item.id);
                        }}
                        onDragEnd={clearDragState}
                      >
                        ⠿
                      </span>

                      <button
                        className="builder-delete-item"
                        type="button"
                        onClick={() => {
                          const shouldDelete = window.confirm(
                            `Remove ${item.name || "this item"}?`,
                          );

                          if (shouldDelete) {
                            deleteItem(item.id);
                          }
                        }}
                        aria-label={`Delete ${item.name || "item"}`}
                      >
                        ×
                      </button>

                      <div className="builder-item-image">
                        <div className="builder-item-image-frame">
                          <img
                            src={item.image}
                            alt={item.name || `Item ${itemIndex + 1}`}
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

                        <div className="builder-image-actions">
                          <button
                            type="button"
                            onClick={() => setEditingImageItemId(item.id)}
                          >
                            Adjust
                          </button>

                          <label>
                            Replace
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(event) => {
                                replaceItemImage(
                                  item.id,
                                  event.target.files?.[0],
                                );

                                event.target.value = "";
                              }}
                            />
                          </label>
                        </div>
                      </div>

                      <label className="builder-item-name">
                        <span>Item name</span>

                        <input
                          type="text"
                          value={item.name}
                          maxLength={40}
                          placeholder={`Item ${itemIndex + 1}`}
                          onChange={(event) =>
                            updateItemName(item.id, event.target.value)
                          }
                        />
                      </label>

                      <div className="builder-reorder-actions">
                        <button
                          type="button"
                          disabled={itemIndex === 0}
                          onClick={() => moveItem(itemIndex, -1)}
                          aria-label={`Move ${item.name || "item"} backward`}
                        >
                          ←
                        </button>

                        <button
                          type="button"
                          disabled={itemIndex === board.items.length - 1}
                          onClick={() => moveItem(itemIndex, 1)}
                          aria-label={`Move ${item.name || "item"} forward`}
                        >
                          →
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}

          {showPreview && <BoardPreview board={board} />}
        </div>
      </div>

      <div className="builder-footer-actions">
        {onCancel && (
          <button
            className="secondary-game-button"
            type="button"
            onClick={onCancel}
          >
            Cancel
          </button>
        )}

        <button
          className="secondary-game-button"
          type="button"
          disabled={isSaving || board.items.length === 0}
          onClick={handleSave}
        >
          {isSaving ? "Saving..." : "Save Board"}
        </button>

        <button
          className="primary-button"
          type="button"
          disabled={!isReadyToPlay || isSaving}
          onClick={handleStartPlaying}
        >
          Save and Start Playing
        </button>
      </div>

      {editingImageItem && (
        <ImagePositionEditor
          item={editingImageItem}
          onChange={(updates) =>
            updateImageSettings(editingImageItem.id, updates)
          }
          onClose={() => setEditingImageItemId(null)}
        />
      )}
    </section>
  );
}

function ValidationRow({ complete, text }) {
  return (
    <div className={`builder-validation-row ${complete ? "is-complete" : ""}`}>
      <span>{complete ? "✓" : "!"}</span>
      <small>{text}</small>
    </div>
  );
}

function BoardPreview({ board }) {
  return (
    <div className="custom-board-preview">
      <div className="custom-board-preview-heading">
        <span>{board.category || "Custom Category"}</span>
        <strong>{board.title || "Untitled Board"}</strong>
        <small>
          {board.items.length}/{board.boardSize} cards
        </small>
      </div>

      <div
        className={`custom-board-preview-grid preview-size-${board.boardSize}`}
      >
        {board.items.map((item) => (
          <article className="custom-board-preview-card" key={item.id}>
            <img
              src={item.image}
              alt={item.name}
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
            <strong>{item.name || "Unnamed Item"}</strong>
          </article>
        ))}

        {Array.from({
          length: Math.max(Number(board.boardSize) - board.items.length, 0),
        }).map((_, index) => (
          <article
            className="custom-board-preview-card is-empty"
            key={`empty-preview-${index}`}
          >
            <span>?</span>
            <strong>Empty</strong>
          </article>
        ))}
      </div>
    </div>
  );
}

export default BoardBuilder;
