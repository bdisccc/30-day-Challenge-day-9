import { useRef } from "react";

const clamp = (value, minimum, maximum) =>
  Math.min(Math.max(value, minimum), maximum);

function ImagePositionEditor({
  item,
  onChange,
  onClose,
}) {
  const dragStateRef = useRef(null);

  const positionX = item.imagePositionX ?? 50;
  const positionY = item.imagePositionY ?? 50;
  const zoom = item.imageZoom ?? 1;

  const updatePosition = (field, value) => {
    onChange({
      [field]: Number(value),
    });
  };

  const handlePointerDown = (event) => {
    event.preventDefault();

    const frame = event.currentTarget;

    frame.setPointerCapture(event.pointerId);

    dragStateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPositionX: positionX,
      startPositionY: positionY,
      frameWidth: frame.clientWidth,
      frameHeight: frame.clientHeight,
    };
  };

  const handlePointerMove = (event) => {
    const dragState = dragStateRef.current;

    if (
      !dragState ||
      dragState.pointerId !== event.pointerId
    ) {
      return;
    }

    const horizontalMovement =
      ((event.clientX - dragState.startClientX) /
        dragState.frameWidth) *
      100;

    const verticalMovement =
      ((event.clientY - dragState.startClientY) /
        dragState.frameHeight) *
      100;

    /*
      Object-position works opposite to physically dragging an image.

      Dragging the image right decreases the focal X position.
      Dragging the image down decreases the focal Y position.
    */
    const nextPositionX = clamp(
      dragState.startPositionX - horizontalMovement,
      0,
      100,
    );

    const nextPositionY = clamp(
      dragState.startPositionY - verticalMovement,
      0,
      100,
    );

    onChange({
      imagePositionX: nextPositionX,
      imagePositionY: nextPositionY,
    });
  };

  const finishDragging = (event) => {
    const dragState = dragStateRef.current;

    if (
      dragState &&
      dragState.pointerId === event.pointerId
    ) {
      dragStateRef.current = null;

      try {
        event.currentTarget.releasePointerCapture(
          event.pointerId,
        );
      } catch {
        // Pointer capture may already be released.
      }
    }
  };

  const resetImage = () => {
    onChange({
      imagePositionX: 50,
      imagePositionY: 50,
      imageZoom: 1,
    });
  };

  return (
    <div
      className="image-editor-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="image-editor-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-editor-title"
      >
        <button
          className="image-editor-close"
          type="button"
          onClick={onClose}
          aria-label="Close image editor"
        >
          ×
        </button>

        <div className="image-editor-heading">
          <span className="screen-eyebrow">
            Adjust Image
          </span>

          <h2 id="image-editor-title">
            Fit {item.name || "this image"}
          </h2>

          <p>
            Drag the image inside the frame, then adjust
            the zoom and position until it fits the card.
          </p>
        </div>

        <div className="image-editor-content">
          <div className="image-editor-preview-area">
            <div
              className="image-editor-preview-frame"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={finishDragging}
              onPointerCancel={finishDragging}
            >
              <img
                src={item.image}
                alt={item.name || "Item preview"}
                draggable="false"
                style={{
                  objectPosition: `${positionX}% ${positionY}%`,
                  transform: `scale(${zoom})`,
                  transformOrigin: `${positionX}% ${positionY}%`,
                }}
              />

              <div className="image-editor-drag-message">
                <span>✥</span>
                Drag to reposition
              </div>
            </div>

            <div className="image-editor-name-preview">
              {item.name || "Unnamed Item"}
            </div>
          </div>

          <div className="image-editor-controls">
            <label className="image-editor-control">
              <span>
                <strong>Zoom</strong>
                <small>{zoom.toFixed(2)}×</small>
              </span>

              <input
  type="range"
  min="0.5"
  max="2.5"
                step="0.01"
                value={zoom}
                onChange={(event) =>
                  updatePosition(
                    "imageZoom",
                    event.target.value,
                  )
                }
              />
            </label>

            <label className="image-editor-control">
              <span>
                <strong>Horizontal position</strong>
                <small>{Math.round(positionX)}%</small>
              </span>

              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={positionX}
                onChange={(event) =>
                  updatePosition(
                    "imagePositionX",
                    event.target.value,
                  )
                }
              />
            </label>

            <label className="image-editor-control">
              <span>
                <strong>Vertical position</strong>
                <small>{Math.round(positionY)}%</small>
              </span>

              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={positionY}
                onChange={(event) =>
                  updatePosition(
                    "imagePositionY",
                    event.target.value,
                  )
                }
              />
            </label>

            <div className="image-editor-help">
              <span>💡</span>

              <p>
                Use zoom for small images. Drag or use the
                sliders when the subject is too high, low,
                left, or right.
              </p>
            </div>
          </div>
        </div>

        <div className="image-editor-actions">
          <button
            className="secondary-game-button"
            type="button"
            onClick={resetImage}
          >
            Reset Image
          </button>

          <button
            className="primary-button"
            type="button"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </section>
    </div>
  );
}

export default ImagePositionEditor;