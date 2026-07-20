import { randomInt } from "node:crypto";

const ROOM_CODE_CHARACTERS =
  "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const ROOM_CODE_LENGTH = 6;

export function generateRoomCode() {
  let roomCode = "";

  for (
    let index = 0;
    index < ROOM_CODE_LENGTH;
    index += 1
  ) {
    const characterIndex = randomInt(
      0,
      ROOM_CODE_CHARACTERS.length,
    );

    roomCode += ROOM_CODE_CHARACTERS[characterIndex];
  }

  return roomCode;
}