CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  room_code VARCHAR(6) NOT NULL UNIQUE,

  board_type VARCHAR(20) NOT NULL
    CHECK (board_type IN ('standard', 'custom')),

  board_id VARCHAR(120),

  board_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,

  status VARCHAR(20) NOT NULL DEFAULT 'waiting'
    CHECK (
      status IN (
        'waiting',
        'selecting',
        'playing',
        'finished',
        'closed'
      )
    ),

  max_players SMALLINT NOT NULL DEFAULT 2
    CHECK (max_players BETWEEN 2 AND 2),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  expires_at TIMESTAMPTZ NOT NULL
    DEFAULT (NOW() + INTERVAL '12 hours'),

  started_at TIMESTAMPTZ,

  finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS room_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  room_id UUID NOT NULL
    REFERENCES rooms(id)
    ON DELETE CASCADE,

  player_token UUID NOT NULL
    DEFAULT gen_random_uuid()
    UNIQUE,

  player_name VARCHAR(40) NOT NULL,

  player_number SMALLINT NOT NULL
    CHECK (player_number IN (1, 2)),

  is_host BOOLEAN NOT NULL DEFAULT FALSE,

  is_ready BOOLEAN NOT NULL DEFAULT FALSE,

  is_connected BOOLEAN NOT NULL DEFAULT TRUE,

  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (room_id, player_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_host_per_room
ON room_players(room_id)
WHERE is_host = TRUE;

CREATE TABLE IF NOT EXISTS player_secrets (
  player_id UUID PRIMARY KEY
    REFERENCES room_players(id)
    ON DELETE CASCADE,

  room_id UUID NOT NULL
    REFERENCES rooms(id)
    ON DELETE CASCADE,

  secret_item_id VARCHAR(160) NOT NULL,

  selected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS player_game_states (
  player_id UUID PRIMARY KEY
    REFERENCES room_players(id)
    ON DELETE CASCADE,

  room_id UUID NOT NULL
    REFERENCES rooms(id)
    ON DELETE CASCADE,

  eliminated_item_ids JSONB NOT NULL DEFAULT '[]'::JSONB,

  final_guess_id VARCHAR(160),

  result VARCHAR(20)
    CHECK (
      result IS NULL OR
      result IN ('correct', 'incorrect')
    ),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rematch_votes (
  player_id UUID PRIMARY KEY
    REFERENCES room_players(id)
    ON DELETE CASCADE,

  room_id UUID NOT NULL
    REFERENCES rooms(id)
    ON DELETE CASCADE,

  accepted BOOLEAN NOT NULL DEFAULT FALSE,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rooms_room_code_index
ON rooms(room_code);

CREATE INDEX IF NOT EXISTS rooms_status_index
ON rooms(status);

CREATE INDEX IF NOT EXISTS rooms_expires_at_index
ON rooms(expires_at);

CREATE INDEX IF NOT EXISTS room_players_room_id_index
ON room_players(room_id);

CREATE INDEX IF NOT EXISTS player_secrets_room_id_index
ON player_secrets(room_id);

CREATE INDEX IF NOT EXISTS player_game_states_room_id_index
ON player_game_states(room_id);

CREATE INDEX IF NOT EXISTS rematch_votes_room_id_index
ON rematch_votes(room_id);