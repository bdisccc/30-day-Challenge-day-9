import { useEffect, useMemo, useState } from "react";
import "./App.css";
import BoardBuilder from "./components/BoardBuilder";
import SavedBoards from "./components/SavedBoards";
import MultiplayerSetup from "./components/MultiplayerSetup";
import MultiplayerLobby from "./components/MultiplayerLobby";

import {
  clearMultiplayerSession,
  getMultiplayerSession,
} from "./utils/multiplayerApi";

const createItems = (items) =>
  items.map(([id, name, emoji]) => ({
    id,
    name,
    emoji,
  }));

const standardCategories = [
  {
    id: "animals",
    name: "Animals",
    icon: "🐾",
    description: "Guess animals from around the world.",
    items: createItems([
      ["panda", "Panda", "🐼"],
      ["lion", "Lion", "🦁"],
      ["fox", "Fox", "🦊"],
      ["frog", "Frog", "🐸"],
      ["penguin", "Penguin", "🐧"],
      ["koala", "Koala", "🐨"],
      ["tiger", "Tiger", "🐯"],
      ["rabbit", "Rabbit", "🐰"],
      ["monkey", "Monkey", "🐵"],
      ["owl", "Owl", "🦉"],
      ["elephant", "Elephant", "🐘"],
      ["octopus", "Octopus", "🐙"],
      ["giraffe", "Giraffe", "🦒"],
      ["zebra", "Zebra", "🦓"],
      ["gorilla", "Gorilla", "🦍"],
      ["dog", "Dog", "🐶"],
      ["cat", "Cat", "🐱"],
      ["bear", "Bear", "🐻"],
      ["cow", "Cow", "🐮"],
      ["pig", "Pig", "🐷"],
      ["mouse", "Mouse", "🐭"],
      ["chicken", "Chicken", "🐔"],
      ["unicorn", "Unicorn", "🦄"],
      ["dolphin", "Dolphin", "🐬"],
    ]),
  },
  {
    id: "food",
    name: "Food",
    icon: "🍕",
    description: "Guess meals, snacks, fruits, and desserts.",
    items: createItems([
      ["pizza", "Pizza", "🍕"],
      ["burger", "Burger", "🍔"],
      ["taco", "Taco", "🌮"],
      ["sushi", "Sushi", "🍣"],
      ["donut", "Donut", "🍩"],
      ["cake", "Cake", "🍰"],
      ["apple", "Apple", "🍎"],
      ["watermelon", "Watermelon", "🍉"],
      ["spaghetti", "Spaghetti", "🍝"],
      ["fries", "Fries", "🍟"],
      ["ice-cream", "Ice Cream", "🍦"],
      ["pancakes", "Pancakes", "🥞"],
      ["hotdog", "Hotdog", "🌭"],
      ["sandwich", "Sandwich", "🥪"],
      ["salad", "Salad", "🥗"],
      ["cookie", "Cookie", "🍪"],
      ["chocolate", "Chocolate", "🍫"],
      ["popcorn", "Popcorn", "🍿"],
      ["banana", "Banana", "🍌"],
      ["strawberry", "Strawberry", "🍓"],
      ["grapes", "Grapes", "🍇"],
      ["avocado", "Avocado", "🥑"],
      ["rice", "Rice", "🍚"],
      ["ramen", "Ramen", "🍜"],
    ]),
  },
  {
    id: "objects",
    name: "Objects",
    icon: "🧸",
    description: "Guess familiar everyday objects.",
    items: createItems([
      ["camera", "Camera", "📷"],
      ["phone", "Phone", "📱"],
      ["lamp", "Lamp", "💡"],
      ["clock", "Clock", "⏰"],
      ["key", "Key", "🔑"],
      ["umbrella", "Umbrella", "☂️"],
      ["backpack", "Backpack", "🎒"],
      ["book", "Book", "📚"],
      ["headphones", "Headphones", "🎧"],
      ["television", "Television", "📺"],
      ["chair", "Chair", "🪑"],
      ["gift", "Gift", "🎁"],
      ["laptop", "Laptop", "💻"],
      ["keyboard", "Keyboard", "⌨️"],
      ["flashlight", "Flashlight", "🔦"],
      ["scissors", "Scissors", "✂️"],
      ["pencil", "Pencil", "✏️"],
      ["paintbrush", "Paintbrush", "🖌️"],
      ["balloon", "Balloon", "🎈"],
      ["teddy-bear", "Teddy Bear", "🧸"],
      ["game-controller", "Controller", "🎮"],
      ["microphone", "Microphone", "🎤"],
      ["guitar", "Guitar", "🎸"],
      ["bicycle", "Bicycle", "🚲"],
    ]),
  },
  {
    id: "places",
    name: "Places",
    icon: "🌍",
    description: "Guess landmarks and destinations.",
    items: createItems([
      ["beach", "Beach", "🏖️"],
      ["mountain", "Mountain", "🏔️"],
      ["city", "City", "🏙️"],
      ["castle", "Castle", "🏰"],
      ["forest", "Forest", "🌲"],
      ["desert", "Desert", "🏜️"],
      ["island", "Island", "🏝️"],
      ["stadium", "Stadium", "🏟️"],
      ["school", "School", "🏫"],
      ["hospital", "Hospital", "🏥"],
      ["airport", "Airport", "✈️"],
      ["campground", "Campground", "🏕️"],
      ["farm", "Farm", "🚜"],
      ["park", "Park", "🏞️"],
      ["museum", "Museum", "🏛️"],
      ["church", "Church", "⛪"],
      ["hotel", "Hotel", "🏨"],
      ["factory", "Factory", "🏭"],
      ["bank", "Bank", "🏦"],
      ["store", "Store", "🏬"],
      ["house", "House", "🏠"],
      ["office", "Office", "🏢"],
      ["train-station", "Train Station", "🚉"],
      ["amusement-park", "Theme Park", "🎡"],
    ]),
  },
  {
    id: "flags",
    name: "Flags",
    icon: "🚩",
    description: "Identify countries using their flags.",
    items: createItems([
      ["philippines", "Philippines", "🇵🇭"],
      ["japan", "Japan", "🇯🇵"],
      ["south-korea", "South Korea", "🇰🇷"],
      ["france", "France", "🇫🇷"],
      ["italy", "Italy", "🇮🇹"],
      ["canada", "Canada", "🇨🇦"],
      ["brazil", "Brazil", "🇧🇷"],
      ["australia", "Australia", "🇦🇺"],
      ["germany", "Germany", "🇩🇪"],
      ["india", "India", "🇮🇳"],
      ["thailand", "Thailand", "🇹🇭"],
      ["mexico", "Mexico", "🇲🇽"],
      ["united-states", "United States", "🇺🇸"],
      ["united-kingdom", "United Kingdom", "🇬🇧"],
      ["spain", "Spain", "🇪🇸"],
      ["china", "China", "🇨🇳"],
      ["singapore", "Singapore", "🇸🇬"],
      ["indonesia", "Indonesia", "🇮🇩"],
      ["malaysia", "Malaysia", "🇲🇾"],
      ["vietnam", "Vietnam", "🇻🇳"],
      ["new-zealand", "New Zealand", "🇳🇿"],
      ["switzerland", "Switzerland", "🇨🇭"],
      ["argentina", "Argentina", "🇦🇷"],
      ["south-africa", "South Africa", "🇿🇦"],
    ]),
  },
  {
    id: "characters",
    name: "Characters",
    icon: "🦸",
    description: "Guess familiar fantasy character types.",
    items: createItems([
      ["wizard", "Wizard", "🧙"],
      ["superhero", "Superhero", "🦸"],
      ["detective", "Detective", "🕵️"],
      ["pirate", "Pirate", "🏴‍☠️"],
      ["vampire", "Vampire", "🧛"],
      ["mermaid", "Mermaid", "🧜"],
      ["ninja", "Ninja", "🥷"],
      ["astronaut", "Astronaut", "🧑‍🚀"],
      ["fairy", "Fairy", "🧚"],
      ["zombie", "Zombie", "🧟"],
      ["genie", "Genie", "🧞"],
      ["robot", "Robot", "🤖"],
      ["princess", "Princess", "👸"],
      ["prince", "Prince", "🤴"],
      ["knight", "Knight", "🛡️"],
      ["scientist", "Scientist", "🧑‍🔬"],
      ["chef", "Chef", "🧑‍🍳"],
      ["artist", "Artist", "🧑‍🎨"],
      ["firefighter", "Firefighter", "🧑‍🚒"],
      ["police-officer", "Police Officer", "👮"],
      ["pilot", "Pilot", "🧑‍✈️"],
      ["farmer", "Farmer", "🧑‍🌾"],
      ["ghost", "Ghost", "👻"],
      ["alien", "Alien", "👽"],
    ]),
  },
];

const homeMenuItems = [
  {
    id: "play",
    title: "Play",
    description: "Choose a ready-made board and start guessing.",
    icon: "▶",
    accent: "yellow",
  },
  {
    id: "create",
    title: "Create a Board",
    description: "Upload images and build your own category.",
    icon: "＋",
    accent: "pink",
  },
  {
    id: "saved",
    title: "Saved Boards",
    description: "Continue playing or edit your custom boards.",
    icon: "▣",
    accent: "blue",
  },
  {
    id: "how-to-play",
    title: "How to Play",
    description: "Learn the rules and game controls.",
    icon: "?",
    accent: "green",
  },
];

const howToPlaySteps = [
  {
    number: "01",
    title: "Choose a board",
    description:
      "Select a built-in category or create your own board using uploaded images.",
  },
  {
    number: "02",
    title: "Pick the mystery item",
    description: "Choose an item yourself or let the game select one randomly.",
  },
  {
    number: "03",
    title: "Ask questions",
    description:
      "Ask yes-or-no questions and use the answers to narrow down the choices.",
  },
  {
    number: "04",
    title: "Flip cards down",
    description:
      "Tap cards that no longer match. Tap them again to return them upright.",
  },
  {
    number: "05",
    title: "Make your final guess",
    description: "Select the item you think is correct and reveal the result.",
  },
];

function getStoredBoolean(key, fallbackValue) {
  const storedValue = localStorage.getItem(key);

  if (storedValue === null) {
    return fallbackValue;
  }

  return storedValue === "true";
}

function getRandomItem(items, excludedId = null) {
  const availableItems = excludedId
    ? items.filter((item) => item.id !== excludedId)
    : items;

  if (availableItems.length === 0) {
    return items[0];
  }

  const randomIndex = Math.floor(Math.random() * availableItems.length);
  return availableItems[randomIndex];
}

function App() {
  const [currentScreen, setCurrentScreen] = useState("home");
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [gameType, setGameType] = useState(null);
  const [secretItemId, setSecretItemId] = useState(null);
  const [eliminatedIds, setEliminatedIds] = useState([]);
  const [isSecretVisible, setIsSecretVisible] = useState(false);
  const [isGuessModalOpen, setIsGuessModalOpen] = useState(false);
  const [guessResult, setGuessResult] = useState(null);
  const [builderHasUnsavedChanges, setBuilderHasUnsavedChanges] =
  useState(false);

  const [soundEnabled, setSoundEnabled] = useState(() =>
    getStoredBoolean("guessTheWhatSound", true),
  );

  const [animationsEnabled, setAnimationsEnabled] = useState(() =>
    getStoredBoolean("guessTheWhatAnimations", true),
  );

  const [multiplayerSession, setMultiplayerSession] =
  useState(() => getMultiplayerSession());

const [incomingRoomCode, setIncomingRoomCode] =
  useState(() => {
    const searchParameters =
      new URLSearchParams(
        window.location.search,
      );

    return (
      searchParameters
        .get("room")
        ?.trim()
        .toUpperCase() || ""
    );
  });

  const [darkMode, setDarkMode] = useState(() =>
    getStoredBoolean("guessTheWhatDarkMode", false),
  );

  const [selectedCustomBoard, setSelectedCustomBoard] = useState(null);

  const [editingBoard, setEditingBoard] = useState(null);

  const [savedBoardsRefreshKey, setSavedBoardsRefreshKey] = useState(0);

  const handleMultiplayerSessionReady = (
  session,
) => {
  setMultiplayerSession(session);
  setGameType("online");

  if (
    session.room.boardType === "standard" &&
    session.room.boardId
  ) {
    setSelectedCustomBoard(null);
    setSelectedCategoryId(
      session.room.boardId,
    );
  }

  setIncomingRoomCode("");

  const currentUrl = new URL(
    window.location.href,
  );

  currentUrl.searchParams.delete("room");

  window.history.replaceState(
    {},
    "",
    currentUrl,
  );

  navigateTo("multiplayer-lobby", {
    skipUnsavedWarning: true,
  });
};

const handleLeaveMultiplayer = () => {
  clearMultiplayerSession();
  setMultiplayerSession(null);
  setIncomingRoomCode("");
  setGameType(null);

  navigateTo(
    selectedCategory
      ? "game-type"
      : "home",
    {
      skipUnsavedWarning: true,
    },
  );
};

  const selectedCategory = useMemo(() => {
    if (selectedCustomBoard) {
      return {
        id: selectedCustomBoard.id,
        name: selectedCustomBoard.title,
        icon: "🖼️",
        description: selectedCustomBoard.category || "Custom guessing board",
        isCustom: true,
        boardSize: Number(selectedCustomBoard.boardSize),
        items: selectedCustomBoard.items.map((item) => ({
          ...item,
          image: item.image,
          emoji: null,
        })),
      };
    }

    return (
      standardCategories.find(
        (category) => category.id === selectedCategoryId,
      ) || null
    );
  }, [selectedCategoryId, selectedCustomBoard]);

  const secretItem = useMemo(
    () =>
      selectedCategory?.items.find((item) => item.id === secretItemId) || null,
    [selectedCategory, secretItemId],
  );

  const activeItems = useMemo(() => {
    if (!selectedCategory) {
      return [];
    }

    return selectedCategory.items.filter(
      (item) => !eliminatedIds.includes(item.id),
    );
  }, [selectedCategory, eliminatedIds]);

  useEffect(() => {
  if (!incomingRoomCode) {
    return;
  }

  setCurrentScreen("multiplayer-setup");
}, [incomingRoomCode]);

  useEffect(() => {
    localStorage.setItem("guessTheWhatSound", String(soundEnabled));
  }, [soundEnabled]);

  useEffect(() => {
    localStorage.setItem("guessTheWhatAnimations", String(animationsEnabled));
  }, [animationsEnabled]);

  useEffect(() => {
    localStorage.setItem("guessTheWhatDarkMode", String(darkMode));
  }, [darkMode]);

  useEffect(() => {
  const handleBeforeUnload = (event) => {
    if (
      currentScreen === "create-board" &&
      builderHasUnsavedChanges
    ) {
      event.preventDefault();
      event.returnValue = "";
    }
  };

  window.addEventListener(
    "beforeunload",
    handleBeforeUnload,
  );

  return () => {
    window.removeEventListener(
      "beforeunload",
      handleBeforeUnload,
    );
  };
}, [currentScreen, builderHasUnsavedChanges]);

  const playSound = (type = "click") => {
    if (!soundEnabled) {
      return;
    }

    try {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) {
        return;
      }

      const audioContext = new AudioContextClass();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      const frequencyMap = {
        click: 320,
        flip: 210,
        restore: 390,
        correct: 620,
        incorrect: 150,
      };

      oscillator.type = type === "incorrect" ? "sawtooth" : "sine";
      oscillator.frequency.value = frequencyMap[type] || 320;

      gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + 0.12,
      );

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.12);

      oscillator.addEventListener("ended", () => {
        audioContext.close();
      });
    } catch {
      // Sound is optional, so the game continues if audio is unavailable.
    }
  };

  const navigateTo = (
  screen,
  { skipUnsavedWarning = false } = {},
) => {
  if (
    !skipUnsavedWarning &&
    currentScreen === "create-board" &&
    builderHasUnsavedChanges
  ) {
    const shouldLeave = window.confirm(
      "You have unsaved changes. Leave this page and discard them?",
    );

    if (!shouldLeave) {
      return false;
    }
  }

  setCurrentScreen(screen);
  setIsGuessModalOpen(false);

  if (screen !== "create-board") {
    setBuilderHasUnsavedChanges(false);
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });

  return true;
};

  const clearCurrentGame = () => {
    setGameType(null);
    setSecretItemId(null);
    setEliminatedIds([]);
    setIsSecretVisible(false);
    setIsGuessModalOpen(false);
    setGuessResult(null);
  };

  const goHome = () => {
  const didNavigate = navigateTo("home");

  if (!didNavigate) {
    return;
  }

  clearCurrentGame();

  setSelectedCategoryId(null);
  setSelectedCustomBoard(null);
  setEditingBoard(null);
};

  const handleHomeMenu = (itemId) => {
  if (itemId === "create") {
    handleCreateBoard();
    return;
  }

  playSound("click");

  const screenMap = {
    play: "play",
    saved: "saved-boards",
    "how-to-play": "how-to-play",
  };

  const destination = screenMap[itemId];

  if (destination) {
    navigateTo(destination);
  }
};

  const handleCategorySelect = (categoryId) => {
    playSound("click");
    clearCurrentGame();

    setSelectedCustomBoard(null);
    setEditingBoard(null);
    setSelectedCategoryId(categoryId);

    navigateTo("game-type");
  };

  const handleCreateBoard = () => {
    playSound("click");

    setEditingBoard(null);
    navigateTo("create-board");
  };

  const handleEditBoard = (board) => {
    playSound("click");

    setEditingBoard(board);
    navigateTo("create-board");
  };

  const handleBoardSaved = (board) => {
  setEditingBoard(board);
  setBuilderHasUnsavedChanges(false);

  setSavedBoardsRefreshKey(
    (currentKey) => currentKey + 1,
  );
};

  const handleCustomBoardPlay = (board) => {
  playSound("click");
  clearCurrentGame();

  setBuilderHasUnsavedChanges(false);
  setSelectedCategoryId(null);
  setSelectedCustomBoard(board);
  setEditingBoard(null);

  navigateTo("game-type", {
    skipUnsavedWarning: true,
  });
};

  const handleBuilderCancel = () => {
  const didNavigate = navigateTo("saved-boards");

  if (!didNavigate) {
    return;
  }

  setEditingBoard(null);
};

  const handleGameTypeSelect = (selectedGameType) => {
    if (!selectedCategory) {
      return;
    }

    playSound("click");
    setGameType(selectedGameType);
    setEliminatedIds([]);
    setGuessResult(null);
    setIsSecretVisible(false);

    if (selectedGameType === "online") {
      navigateTo("multiplayer-setup");
      return;
    }

    if (selectedGameType === "solo") {
      const randomItem = getRandomItem(selectedCategory.items);

      setSecretItemId(randomItem.id);
      navigateTo("privacy-screen");
      return;
    }

    setSecretItemId(null);
    navigateTo("secret-selection");
  };

  const handleSecretSelection = (itemId) => {
    playSound("click");
    setSecretItemId(itemId);
  };

  const chooseRandomSecret = () => {
    if (!selectedCategory) {
      return;
    }

    const randomItem = getRandomItem(selectedCategory.items, secretItemId);

    playSound("click");
    setSecretItemId(randomItem.id);
  };

  const continueFromSecretSelection = () => {
    if (!secretItemId) {
      return;
    }

    playSound("click");
    setIsSecretVisible(false);
    navigateTo("privacy-screen");
  };

  const beginGame = () => {
    if (!secretItemId) {
      return;
    }

    playSound("click");
    setEliminatedIds([]);
    setIsSecretVisible(false);
    setGuessResult(null);
    navigateTo("game-board");
  };

  const toggleCard = (itemId) => {
    setEliminatedIds((currentIds) => {
      if (currentIds.includes(itemId)) {
        playSound("restore");
        return currentIds.filter((id) => id !== itemId);
      }

      playSound("flip");
      return [...currentIds, itemId];
    });
  };

  const restoreAllCards = () => {
    playSound("restore");
    setEliminatedIds([]);
  };

  const submitFinalGuess = (guessedItemId) => {
    const isCorrect = guessedItemId === secretItemId;

    playSound(isCorrect ? "correct" : "incorrect");
    setGuessResult({
      guessedItemId,
      isCorrect,
    });

    setIsGuessModalOpen(false);
    navigateTo("result");
  };

  const startNewRound = () => {
    if (!selectedCategory) {
      return;
    }

    playSound("click");
    setEliminatedIds([]);
    setGuessResult(null);
    setIsSecretVisible(false);

    if (gameType === "solo") {
      const nextItem = getRandomItem(selectedCategory.items, secretItemId);

      setSecretItemId(nextItem.id);
      navigateTo("privacy-screen");
      return;
    }

    setSecretItemId(null);
    navigateTo("secret-selection");
  };

  const changeCategory = () => {
  playSound("click");
  clearCurrentGame();

  if (selectedCustomBoard) {
    setSelectedCustomBoard(null);
    navigateTo("saved-boards");
    return;
  }

  navigateTo("standard-categories");
};

  const getBackScreen = () => {
  const backScreenMap = {
    play: "home",
    "standard-categories": "play",
    "create-board": editingBoard ? "saved-boards" : "home",
    "saved-boards": "home",
    "how-to-play": "home",
    settings: "home",

    "game-type": selectedCustomBoard
      ? "saved-boards"
      : "standard-categories",

    "secret-selection": "game-type",

    "privacy-screen":
      gameType === "two-player"
        ? "secret-selection"
        : "game-type",
    
        "multiplayer-setup": selectedCategory
  ? "game-type"
  : "home",

"multiplayer-lobby": "multiplayer-setup",
  };

  return backScreenMap[currentScreen] || "home";

};

  const showBackButton = ![
  "home",
  "game-board",
  "result",
  "multiplayer-lobby",
].includes(currentScreen);

  return (
    <div
      className={[
        "app",
        darkMode ? "dark-theme" : "",
        animationsEnabled ? "" : "animations-disabled",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="background-decoration background-decoration-one" />
      <div className="background-decoration background-decoration-two" />
      <div className="background-decoration background-decoration-three" />

      <header className="app-header">
        <button
          className="brand-button"
          type="button"
          onClick={goHome}
          aria-label="Return to home"
        >
          <span className="brand-logo">
            <span className="brand-logo-question">?</span>
          </span>

          <span className="brand-text">
            <strong>Guess the What</strong>
            <small>Guess absolutely anything.</small>
          </span>
        </button>

        <button
          className="settings-button"
          type="button"
          onClick={() => {
            playSound("click");
            navigateTo("settings");
          }}
          aria-label="Open settings"
        >
          <span aria-hidden="true">⚙</span>
          <span className="settings-button-text">Settings</span>
        </button>
      </header>

      <main className="app-main">
        {showBackButton && (
          <button
            className="back-button"
            type="button"
            onClick={() => {
              playSound("click");
              navigateTo(getBackScreen());
            }}
          >
            <span aria-hidden="true">←</span>
            Back
          </button>
        )}

        {currentScreen === "home" && (
          <HomeScreen onMenuSelect={handleHomeMenu} />
        )}

        {currentScreen === "play" && (
          <PlayModeScreen navigateTo={navigateTo} playSound={playSound} />
        )}

        {currentScreen === "standard-categories" && (
          <CategoryScreen onCategorySelect={handleCategorySelect} />
        )}

        {currentScreen === "game-type" && selectedCategory && (
          <GameTypeScreen
            category={selectedCategory}
            onSelect={handleGameTypeSelect}
          />
        )}

        {currentScreen === "secret-selection" && selectedCategory && (
          <SecretSelectionScreen
            category={selectedCategory}
            selectedItemId={secretItemId}
            onSelect={handleSecretSelection}
            onRandomize={chooseRandomSecret}
            onContinue={continueFromSecretSelection}
          />
        )}

        {currentScreen === "privacy-screen" &&
          selectedCategory &&
          secretItem && (
            <PrivacyScreen
              gameType={gameType}
              category={selectedCategory}
              onBegin={beginGame}
            />
          )}

        {currentScreen === "game-board" && selectedCategory && secretItem && (
          <GameBoardScreen
            category={selectedCategory}
            secretItem={secretItem}
            eliminatedIds={eliminatedIds}
            activeItems={activeItems}
            isSecretVisible={isSecretVisible}
            onToggleSecret={() => {
              playSound("click");
              setIsSecretVisible((currentValue) => !currentValue);
            }}
            onToggleCard={toggleCard}
            onRestoreAll={restoreAllCards}
            onOpenGuess={() => {
              playSound("click");
              setIsGuessModalOpen(true);
            }}
            onChangeCategory={changeCategory}
          />
        )}

        {currentScreen === "result" &&
          selectedCategory &&
          secretItem &&
          guessResult && (
            <ResultScreen
              category={selectedCategory}
              secretItem={secretItem}
              guessedItem={selectedCategory.items.find(
                (item) => item.id === guessResult.guessedItemId,
              )}
              isCorrect={guessResult.isCorrect}
              onPlayAgain={startNewRound}
              onChangeCategory={changeCategory}
              onGoHome={goHome}
            />
          )}

        {currentScreen === "create-board" && (
          <BoardBuilder
  initialBoard={editingBoard}
  onSaved={handleBoardSaved}
  onCancel={handleBuilderCancel}
  onStartPlaying={handleCustomBoardPlay}
  onDirtyChange={setBuilderHasUnsavedChanges}
/>
        )}

        {currentScreen === "saved-boards" && (
          <SavedBoards
            refreshKey={savedBoardsRefreshKey}
            onCreate={handleCreateBoard}
            onEdit={handleEditBoard}
            onPlay={handleCustomBoardPlay}
          />
        )}

        {currentScreen === "how-to-play" && <HowToPlayScreen />}

        {currentScreen === "settings" && (
          <SettingsScreen
            soundEnabled={soundEnabled}
            animationsEnabled={animationsEnabled}
            darkMode={darkMode}
            onToggleSound={() => setSoundEnabled((value) => !value)}
            onToggleAnimations={() => setAnimationsEnabled((value) => !value)}
            onToggleDarkMode={() => setDarkMode((value) => !value)}
          />
        )}

        {currentScreen === "multiplayer-setup" && (
  <MultiplayerSetup
    category={selectedCategory}
    initialRoomCode={incomingRoomCode}
    onSessionReady={
      handleMultiplayerSessionReady
    }
  />
)}

{currentScreen === "multiplayer-lobby" &&
  multiplayerSession && (
    <MultiplayerLobby
      session={multiplayerSession}
      onLeave={handleLeaveMultiplayer}
    />
  )}
      
      </main>

      <footer className="app-footer">
        <span>Guess the What</span>
        <span>© 2026 bonsd</span>
      </footer>

      {isGuessModalOpen && selectedCategory && (
        <FinalGuessModal
          items={selectedCategory.items}
          activeItems={activeItems}
          eliminatedIds={eliminatedIds}
          onClose={() => setIsGuessModalOpen(false)}
          onGuess={submitFinalGuess}
        />
      )}
    </div>
  );

}

function HomeScreen({ onMenuSelect }) {
  return (
    <section className="home-screen screen-enter">
      <div className="hero-section">
        <div className="challenge-label">
          <span>Day 9</span>
          <span className="challenge-label-divider" />
          <span>30-Day Coding Challenge</span>
        </div>

        <h1>
          Guess the
          <span className="hero-highlight"> What?</span>
        </h1>

        <p className="hero-description">
          Guess people, animals, food, places, characters, logos, or anything
          else you can imagine.
        </p>

        <div className="hero-board-preview" aria-hidden="true">
          <div className="preview-board-base">
            <div className="preview-secret-slot">
              <span>?</span>
            </div>

            <div className="preview-card-row">
              <div className="preview-card preview-card-yellow">
                <span>🐼</span>
              </div>

              <div className="preview-card preview-card-pink">
                <span>🍕</span>
              </div>

              <div className="preview-card preview-card-blue is-folded">
                <span>🎮</span>
              </div>

              <div className="preview-card preview-card-green">
                <span>🚀</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="home-menu-grid">
        {homeMenuItems.map((item) => (
          <button
            className={`home-menu-card home-menu-card-${item.accent}`}
            type="button"
            key={item.id}
            onClick={() => onMenuSelect(item.id)}
          >
            <span className="home-menu-icon">{item.icon}</span>

            <span className="home-menu-content">
              <strong>{item.title}</strong>
              <small>{item.description}</small>
            </span>

            <span className="home-menu-arrow" aria-hidden="true">
              →
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function PlayModeScreen({ navigateTo, playSound }) {
  const handleNavigation = (screen) => {
    playSound("click");
    navigateTo(screen);
  };

  return (
    <section className="content-screen screen-enter">
      <div className="screen-heading">
        <span className="screen-eyebrow">Choose how to play</span>
        <h2>Pick your board type</h2>
        <p>
          Start with a ready-made category or use one of your own saved boards.
        </p>
      </div>

      <div className="mode-selection-grid">
        <button
          className="mode-selection-card standard-mode-card"
          type="button"
          onClick={() => handleNavigation("standard-categories")}
        >
          <span className="mode-card-badge">Ready to play</span>
          <span className="mode-card-icon">🎲</span>
          <strong>Standard Mode</strong>
          <p>Choose from built-in categories with complete guessing boards.</p>
          <span className="primary-card-action">
            Browse categories
            <span aria-hidden="true">→</span>
          </span>
        </button>

        <button
          className="mode-selection-card custom-mode-card"
          type="button"
          onClick={() => handleNavigation("saved-boards")}
        >
          <span className="mode-card-badge">Your creations</span>
          <span className="mode-card-icon">🖼️</span>
          <strong>Custom Mode</strong>
          <p>
            Play using boards you created with your own images and item names.
          </p>
          <span className="primary-card-action">
            Open saved boards
            <span aria-hidden="true">→</span>
          </span>
        </button>
      </div>
    </section>
  );
}

function CategoryScreen({ onCategorySelect }) {
  return (
    <section className="content-screen screen-enter">
      <div className="screen-heading">
        <span className="screen-eyebrow">Standard Mode</span>
        <h2>Choose a category</h2>
        <p>
          Pick a board and decide whether to play solo or with another player.
        </p>
      </div>

      <div className="category-grid">
        {standardCategories.map((category) => (
          <button
            className="category-card"
            type="button"
            key={category.id}
            onClick={() => onCategorySelect(category.id)}
          >
            <span className="category-icon">{category.icon}</span>

            <span className="category-card-content">
              <strong>{category.name}</strong>
              <small>{category.description}</small>
            </span>

            <span className="category-count">
              {category.items.length} cards
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function GameTypeScreen({ category, onSelect }) {
  return (
    <section className="content-screen screen-enter">
      <SelectedCategoryBanner category={category} />

      <div className="screen-heading">
        <span className="screen-eyebrow">Game setup</span>
        <h2>Who is playing?</h2>
        <p>
  Play alone, share one device, or connect from
  separate devices online.
</p>
      </div>

      <div className="game-type-grid">
        <button
          className="game-type-card"
          type="button"
          onClick={() => onSelect("solo")}
        >
          <span className="game-type-number">1</span>
          <span className="game-type-icon">🧠</span>
          <strong>Solo Practice</strong>
          <p>The game randomly chooses a mystery item for you to identify.</p>
          <span className="game-type-action">Play solo →</span>
        </button>

        <button
          className="game-type-card"
          type="button"
          onClick={() => onSelect("two-player")}
        >
          <span className="game-type-number">2</span>
          <span className="game-type-icon">🤝</span>
          <strong>Two Players</strong>
          <p>
            Player 1 chooses the mystery item and passes the device to Player 2.
          </p>
          <span className="game-type-action">Play together →</span>
        </button>

        {!category.isCustom && (
          <button
            className="game-type-card online-game-type-card"
            type="button"
            onClick={() => onSelect("online")}
          >
            <span className="game-type-number">🌐</span>
            <span className="game-type-icon">📱</span>

            <strong>Online Multiplayer</strong>

            <p>
              Create a room and play from separate devices
              using a code or QR code.
            </p>

            <span className="game-type-action">
              Create or join room →
            </span>
          </button>
        )}
        
      </div>
    </section>
  );
}

function SecretSelectionScreen({
  category,
  selectedItemId,
  onSelect,
  onRandomize,
  onContinue,
}) {
  return (
    <section className="content-screen secret-selection-screen screen-enter">
      <SelectedCategoryBanner category={category} />

      <div className="screen-heading">
        <span className="screen-eyebrow">Player 1</span>
        <h2>Choose the mystery item</h2>
        <p>
          Select one item without showing Player 2. The app will hide it before
          the game begins.
        </p>
      </div>

      <div className="secret-selection-actions">
        <button
          className="secondary-game-button"
          type="button"
          onClick={onRandomize}
        >
          🎲 Choose randomly
        </button>

        <span>
          {selectedItemId
            ? "Mystery item selected"
            : "No mystery item selected"}
        </span>
      </div>

      <div className="selection-card-grid">
        {category.items.map((item) => {
          const isSelected = item.id === selectedItemId;

          return (
            <button
              className={`selection-item-card ${
                isSelected ? "is-selected" : ""
              }`}
              type="button"
              key={item.id}
              onClick={() => onSelect(item.id)}
              aria-pressed={isSelected}
            >
              <span className="selection-item-check">
                {isSelected ? "✓" : ""}
              </span>

              <ItemArtwork item={item} className="selection-item-emoji" />
              <strong>{item.name}</strong>
            </button>
          );
        })}
      </div>

      <div className="sticky-game-action">
        <button
          className="primary-button"
          type="button"
          disabled={!selectedItemId}
          onClick={onContinue}
        >
          Hide Item and Continue
        </button>
      </div>
    </section>
  );
}

function PrivacyScreen({ gameType, category, onBegin }) {
  const isSolo = gameType === "solo";

  return (
    <section className="privacy-screen screen-enter">
      <div className="privacy-card">
        <span className="privacy-icon">{isSolo ? "🧠" : "🙈"}</span>

        <span className="screen-eyebrow">
          {isSolo ? "Solo Practice" : "Pass the device"}
        </span>

        <h2>
          {isSolo ? "Your mystery item is ready" : "Player 1, pass the device"}
        </h2>

        <p>
          {isSolo
            ? `The game selected a secret ${category.name.toLowerCase()} item. Do not reveal it until you are ready to check.`
            : "Make sure Player 2 cannot see the mystery item that was selected."}
        </p>

        <div className="privacy-hidden-card">
          <span>?</span>
          <strong>Mystery Item Hidden</strong>
        </div>

        <button
          className="primary-button privacy-start-button"
          type="button"
          onClick={onBegin}
        >
          {isSolo ? "Start Guessing" : "I’m Player 2 — Start Game"}
        </button>
      </div>
    </section>
  );
}

function GameBoardScreen({
  category,
  secretItem,
  eliminatedIds,
  activeItems,
  isSecretVisible,
  onToggleSecret,
  onToggleCard,
  onRestoreAll,
  onOpenGuess,
  onChangeCategory,
}) {
  return (
    <section className="game-board-screen screen-enter">
      <div className="game-board-toolbar">
        <div className="game-board-category">
          <span>{category.icon}</span>

          <div>
            <small>Current board</small>
            <strong>{category.name}</strong>
          </div>
        </div>

        <div className="game-board-status">
          <span>
            <strong>{activeItems.length}</strong> standing
          </span>

          <span>
            <strong>{eliminatedIds.length}</strong> eliminated
          </span>
        </div>

        <button
          className="toolbar-text-button"
          type="button"
          onClick={onChangeCategory}
        >
          Change board
        </button>
      </div>

      <div className="mystery-holder-section">
        <button
          className={`mystery-holder ${isSecretVisible ? "is-revealed" : ""}`}
          type="button"
          onClick={onToggleSecret}
          aria-pressed={isSecretVisible}
        >
          <span className="mystery-holder-label">Your Mystery Item</span>

          <span className="mystery-holder-content">
            {isSecretVisible ? (
              <>
                <ItemArtwork
                  item={secretItem}
                  className="mystery-holder-emoji"
                />
                <strong>{secretItem.name}</strong>
              </>
            ) : (
              <>
                <span className="mystery-holder-question">?</span>
                <strong>Tap to privately reveal</strong>
              </>
            )}
          </span>
        </button>

        <p>Tap again to hide it before another player looks at the screen.</p>
      </div>

      <div className="physical-game-board">
        <div className="board-top-detail">
          <span />
          <strong>Flip down eliminated cards</strong>
          <span />
        </div>

        <div className="guessing-card-grid">
          {category.items.map((item) => {
            const isEliminated = eliminatedIds.includes(item.id);

            return (
              <button
                className={`guessing-card-slot ${
                  isEliminated ? "is-eliminated" : ""
                }`}
                type="button"
                key={item.id}
                onClick={() => onToggleCard(item.id)}
                aria-pressed={isEliminated}
                aria-label={`${item.name}. ${
                  isEliminated
                    ? "Currently folded down. Click to restore."
                    : "Click to fold down and eliminate."
                }`}
              >
                <span className="guessing-slot-cavity">
                  <span className="slot-status-symbol">×</span>
                  <small>Eliminated</small>
                </span>

                <span className="guessing-card-panel">
                  <span className="guessing-card-hinge">
                    <span />
                    <span />
                  </span>

                  <span className="guessing-card-portrait">
                    <ItemArtwork item={item} className="guessing-card-emoji" />
                  </span>

                  <strong className="guessing-card-name">{item.name}</strong>

                  <span className="guessing-card-handle" />
                </span>
              </button>
            );
          })}
        </div>

        <div className="board-bottom-detail">
          <span>GUESS</span>
          <span>THE</span>
          <span>WHAT?</span>
        </div>
      </div>

      <div className="game-board-controls">
        <button
          className="secondary-game-button"
          type="button"
          onClick={onRestoreAll}
          disabled={eliminatedIds.length === 0}
        >
          ↶ Restore All
        </button>

        <button
          className="final-guess-button"
          type="button"
          onClick={onOpenGuess}
        >
          Make Final Guess
          <span>?</span>
        </button>
      </div>
    </section>
  );
}

function FinalGuessModal({
  items,
  activeItems,
  eliminatedIds,
  onClose,
  onGuess,
}) {
  const guessItems = activeItems.length > 0 ? activeItems : items;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="final-guess-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="final-guess-title"
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
          <span className="screen-eyebrow">Final answer</span>
          <h2 id="final-guess-title">Who—or what—is it?</h2>
          <p>
            Select your final answer. This choice cannot be changed after it is
            submitted.
          </p>
        </div>

        {eliminatedIds.length > 0 && (
          <div className="modal-filter-message">
            Showing {guessItems.length} card
            {guessItems.length === 1 ? "" : "s"} still standing.
          </div>
        )}

        <div className="final-guess-grid">
          {guessItems.map((item) => (
            <button
              className="final-guess-option"
              type="button"
              key={item.id}
              onClick={() => onGuess(item.id)}
            >
              <ItemArtwork item={item} className="final-guess-item-artwork" />
              <strong>{item.name}</strong>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function ResultScreen({
  category,
  secretItem,
  guessedItem,
  isCorrect,
  onPlayAgain,
  onChangeCategory,
  onGoHome,
}) {
  return (
    <section
      className={`result-screen ${
        isCorrect ? "correct-result" : "incorrect-result"
      } screen-enter`}
    >
      <div className="result-card">
        <span className="result-celebration">{isCorrect ? "🎉" : "😵"}</span>

        <span className="screen-eyebrow">
          {isCorrect ? "Correct guess" : "Not quite"}
        </span>

        <h2>
          {isCorrect ? "You guessed it!" : "That was not the mystery item"}
        </h2>

        <p>
          {isCorrect
            ? `Great work! You correctly identified the mystery ${category.name.toLowerCase()} item.`
            : `You selected ${guessedItem?.name || "an item"}, but the correct answer was:`}
        </p>

        <div className="result-answer-card">
          <ItemArtwork item={secretItem} className="result-item-artwork" />
          <strong>{secretItem.name}</strong>
        </div>

        <div className="result-actions">
          <button
            className="primary-button"
            type="button"
            onClick={onPlayAgain}
          >
            Play Another Round
          </button>

          <button
            className="secondary-game-button"
            type="button"
            onClick={onChangeCategory}
          >
            Change Category
          </button>

          <button
            className="toolbar-text-button"
            type="button"
            onClick={onGoHome}
          >
            Return Home
          </button>
        </div>
      </div>
    </section>
  );
}

function HowToPlayScreen() {
  return (
    <section className="content-screen screen-enter">
      <div className="screen-heading">
        <span className="screen-eyebrow">Instructions</span>
        <h2>How to play</h2>
        <p>
          Narrow down the board by asking questions and flipping down cards that
          no longer match.
        </p>
      </div>

      <div className="instruction-list">
        {howToPlaySteps.map((step) => (
          <article className="instruction-card" key={step.number}>
            <span className="instruction-number">{step.number}</span>

            <div>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function SettingsScreen({
  soundEnabled,
  animationsEnabled,
  darkMode,
  onToggleSound,
  onToggleAnimations,
  onToggleDarkMode,
}) {
  return (
    <section className="content-screen settings-screen screen-enter">
      <div className="screen-heading">
        <span className="screen-eyebrow">Preferences</span>
        <h2>Game settings</h2>
        <p>Customize the sound, animation, and appearance of the game.</p>
      </div>

      <div className="settings-panel">
        <SettingToggle
          icon="🔊"
          title="Sound effects"
          description="Play sounds when cards flip and guesses are revealed."
          enabled={soundEnabled}
          onToggle={onToggleSound}
        />

        <SettingToggle
          icon="✨"
          title="Animations"
          description="Enable card flips, transitions, and board movement."
          enabled={animationsEnabled}
          onToggle={onToggleAnimations}
        />

        <SettingToggle
          icon="🌙"
          title="Dark theme"
          description="Use a darker color theme throughout the game."
          enabled={darkMode}
          onToggle={onToggleDarkMode}
        />
      </div>
    </section>
  );
}

function SelectedCategoryBanner({ category }) {
  return (
    <div className="selected-category-banner">
      <span className="selected-category-icon">{category.icon}</span>

      <div>
        <small>Selected board</small>
        <strong>{category.name}</strong>
      </div>
    </div>
  );
}

function SettingToggle({ icon, title, description, enabled, onToggle }) {
  return (
    <div className="setting-row">
      <span className="setting-icon">{icon}</span>

      <div className="setting-information">
        <strong>{title}</strong>
        <small>{description}</small>
      </div>

      <button
        className={`toggle-button ${enabled ? "is-enabled" : ""}`}
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={onToggle}
      >
        <span className="toggle-knob" />
      </button>
    </div>
  );
}

function ItemArtwork({
  item,
  className = "",
}) {
  if (item.image) {
    const positionX = item.imagePositionX ?? 50;
    const positionY = item.imagePositionY ?? 50;
    const zoom = item.imageZoom ?? 1;

    return (
      <img
        className={`${className} item-artwork-image`}
        src={item.image}
        alt={item.name}
        draggable="false"
        style={{
          objectPosition: `${positionX}% ${positionY}%`,
          transform: `scale(${zoom})`,
          transformOrigin: `${positionX}% ${positionY}%`,
        }}
      />
    );
  }

  return (
    <span
      className={className}
      aria-hidden="true"
    >
      {item.emoji || "?"}
    </span>
  );
}

export default App;
