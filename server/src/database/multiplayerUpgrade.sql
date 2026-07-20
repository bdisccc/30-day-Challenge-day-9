BEGIN;

CREATE TABLE IF NOT EXISTS online_player_secrets (
  player_id UUID PRIMARY KEY
    REFERENCES room_players(id)
    ON DELETE CASCADE,
  room_id UUID NOT NULL
    REFERENCES rooms(id)
    ON DELETE CASCADE,
  secret_item_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS online_player_secrets_room_idx
  ON online_player_secrets(room_id);

CREATE TABLE IF NOT EXISTS online_player_states (
  player_id UUID PRIMARY KEY
    REFERENCES room_players(id)
    ON DELETE CASCADE,
  room_id UUID NOT NULL
    REFERENCES rooms(id)
    ON DELETE CASCADE,
  eliminated_item_ids JSONB NOT NULL DEFAULT '[]'::JSONB,
  final_guess_item_id TEXT,
  result TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS online_player_states_room_idx
  ON online_player_states(room_id);

CREATE TABLE IF NOT EXISTS online_room_results (
  room_id UUID PRIMARY KEY
    REFERENCES rooms(id)
    ON DELETE CASCADE,
  guesser_player_id UUID NOT NULL
    REFERENCES room_players(id)
    ON DELETE CASCADE,
  winner_player_id UUID NOT NULL
    REFERENCES room_players(id)
    ON DELETE CASCADE,
  guessed_item_id TEXT NOT NULL,
  was_correct BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS room_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL
    REFERENCES rooms(id)
    ON DELETE CASCADE,
  player_id UUID NOT NULL
    REFERENCES room_players(id)
    ON DELETE CASCADE,
  player_name VARCHAR(40) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT room_chat_message_length
    CHECK (char_length(message) BETWEEN 1 AND 400)
);

CREATE INDEX IF NOT EXISTS room_chat_messages_room_time_idx
  ON room_chat_messages(room_id, created_at DESC);

COMMIT;
