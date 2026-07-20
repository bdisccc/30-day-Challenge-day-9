const DATABASE_NAME = "guess-the-what-database";
const DATABASE_VERSION = 1;
const BOARD_STORE = "boards";

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onerror = () => {
      reject(new Error("Unable to open the board database."));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(BOARD_STORE)) {
        const boardStore = database.createObjectStore(BOARD_STORE, {
          keyPath: "id",
        });

        boardStore.createIndex("updatedAt", "updatedAt", {
          unique: false,
        });
      }
    };
  });
}

export async function saveBoard(board) {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      BOARD_STORE,
      "readwrite",
    );

    const boardStore = transaction.objectStore(BOARD_STORE);
    const request = boardStore.put(board);

    request.onsuccess = () => {
      resolve(board);
    };

    request.onerror = () => {
      reject(new Error("Unable to save this board."));
    };

    transaction.oncomplete = () => {
      database.close();
    };
  });
}

export async function getAllBoards() {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      BOARD_STORE,
      "readonly",
    );

    const boardStore = transaction.objectStore(BOARD_STORE);
    const request = boardStore.getAll();

    request.onsuccess = () => {
      const boards = request.result.sort(
        (firstBoard, secondBoard) =>
          new Date(secondBoard.updatedAt).getTime() -
          new Date(firstBoard.updatedAt).getTime(),
      );

      resolve(boards);
    };

    request.onerror = () => {
      reject(new Error("Unable to load your saved boards."));
    };

    transaction.oncomplete = () => {
      database.close();
    };
  });
}

export async function getBoard(boardId) {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      BOARD_STORE,
      "readonly",
    );

    const boardStore = transaction.objectStore(BOARD_STORE);
    const request = boardStore.get(boardId);

    request.onsuccess = () => {
      resolve(request.result || null);
    };

    request.onerror = () => {
      reject(new Error("Unable to load this board."));
    };

    transaction.oncomplete = () => {
      database.close();
    };
  });
}

export async function deleteBoard(boardId) {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      BOARD_STORE,
      "readwrite",
    );

    const boardStore = transaction.objectStore(BOARD_STORE);
    const request = boardStore.delete(boardId);

    request.onsuccess = () => {
      resolve(boardId);
    };

    request.onerror = () => {
      reject(new Error("Unable to delete this board."));
    };

    transaction.oncomplete = () => {
      database.close();
    };
  });
}

export async function duplicateBoard(board) {
  const timestamp = new Date().toISOString();

  const duplicatedBoard = {
    ...board,
    id: crypto.randomUUID(),
    title: `${board.title} Copy`,
    createdAt: timestamp,
    updatedAt: timestamp,
    items: board.items.map((item) => ({
      ...item,
      id: crypto.randomUUID(),
    })),
  };

  return saveBoard(duplicatedBoard);
}