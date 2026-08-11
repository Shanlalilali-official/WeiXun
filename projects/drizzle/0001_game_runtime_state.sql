CREATE TABLE IF NOT EXISTS "game_runtime_states" (
  "session_id" uuid PRIMARY KEY NOT NULL REFERENCES "game_sessions"("id") ON DELETE CASCADE,
  "scenario_code" varchar(32) NOT NULL,
  "action_points" integer DEFAULT 28 NOT NULL,
  "dimensions" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "npc_affinity" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "unlocked_npc_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "unlocked_clues" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "conversation_memories" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "last_action" varchar(64),
  "version" integer DEFAULT 1 NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "game_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL REFERENCES "game_sessions"("id") ON DELETE CASCADE,
  "npc_key" varchar(128),
  "round" integer NOT NULL,
  "event_type" varchar(64) NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "game_events_session_idx" ON "game_events" ("session_id");
CREATE INDEX IF NOT EXISTS "game_events_npc_idx" ON "game_events" ("npc_key");

ALTER TABLE "game_runtime_states" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "game_events" ENABLE ROW LEVEL SECURITY;
