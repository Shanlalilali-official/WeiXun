-- Five-stage, action-point-only multiplayer foundation.
DROP INDEX IF EXISTS public.game_sessions_one_playing_per_user_idx;
CREATE UNIQUE INDEX game_sessions_one_solo_playing_per_user_idx
  ON public.game_sessions (user_id)
  WHERE status = 'playing' AND multiplayer = false;

CREATE TABLE public.multiplayer_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code varchar(12) NOT NULL UNIQUE,
  scenario_code varchar(32) NOT NULL DEFAULT 'project-1',
  host_user_id varchar(64) NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','running','finished','cancelled')),
  current_stage integer NOT NULL DEFAULT 1 CHECK (current_stage BETWEEN 1 AND 5),
  max_stages integer NOT NULL DEFAULT 5 CHECK (max_stages = 5),
  stage_duration_seconds integer CHECK (stage_duration_seconds IS NULL OR stage_duration_seconds >= 60),
  stage_deadline_at timestamptz,
  shared_customer_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  stage_version integer NOT NULL DEFAULT 1 CHECK (stage_version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.multiplayer_company_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.multiplayer_rooms(id) ON DELETE CASCADE,
  company_id varchar(64) NOT NULL,
  company_name varchar(128) NOT NULL,
  player_user_id varchar(64),
  game_session_id uuid REFERENCES public.game_sessions(id) ON DELETE SET NULL,
  hidden_progress_score integer NOT NULL DEFAULT 50 CHECK (hidden_progress_score BETWEEN 0 AND 100),
  ready_stage integer CHECK (ready_stage IS NULL OR ready_stage BETWEEN 1 AND 5),
  ready_by_admin boolean NOT NULL DEFAULT false,
  connected boolean NOT NULL DEFAULT true,
  initial_personal_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(room_id, company_id)
);
CREATE UNIQUE INDEX multiplayer_company_slots_room_player_unique
  ON public.multiplayer_company_slots(room_id, player_user_id)
  WHERE player_user_id IS NOT NULL;

CREATE TABLE public.competitor_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.multiplayer_rooms(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  company_id varchar(64) NOT NULL,
  npc_key varchar(128) NOT NULL,
  stage integer NOT NULL CHECK (stage BETWEEN 1 AND 5),
  statement text NOT NULL,
  truth_status varchar(24) NOT NULL DEFAULT 'unverified' CHECK (truth_status IN ('unverified','corroborated','contradicted','false')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX competitor_claims_session_idx ON public.competitor_claims(session_id);

ALTER TABLE public.multiplayer_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.multiplayer_company_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY multiplayer_rooms_service_role_only ON public.multiplayer_rooms AS RESTRICTIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY multiplayer_company_slots_service_role_only ON public.multiplayer_company_slots AS RESTRICTIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY competitor_claims_service_role_only ON public.competitor_claims AS RESTRICTIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
REVOKE ALL ON public.multiplayer_rooms, public.multiplayer_company_slots, public.competitor_claims FROM anon, authenticated;
GRANT ALL ON public.multiplayer_rooms, public.multiplayer_company_slots, public.competitor_claims TO service_role;

-- Atomic, idempotent stage transition. The room, every company slot and each
-- attached runtime are locked in this transaction before any stage data moves.
-- A retry with an older expected version returns the already-committed room and
-- does not grant action points twice.
CREATE OR REPLACE FUNCTION public.advance_multiplayer_stage(p_room_id uuid, p_expected_version integer)
RETURNS public.multiplayer_rooms
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.multiplayer_rooms;
  slot_row public.multiplayer_company_slots;
  runtime_row public.game_runtime_states;
  slot_count integer := 0;
  occupied_count integer := 0;
  ready_count integer := 0;
  next_stage integer;
  next_action_points integer;
  average_dimension numeric;
  average_affinity numeric;
  progress_delta integer;
  next_hidden_progress integer;
  next_simulation jsonb;
  next_shared_customer_state jsonb;
  final_stage boolean;
BEGIN
  IF p_expected_version IS NULL OR p_expected_version < 1 THEN
    RAISE EXCEPTION 'ROOM_VERSION_INVALID';
  END IF;

  SELECT * INTO r FROM public.multiplayer_rooms WHERE id = p_room_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'ROOM_NOT_FOUND'; END IF;

  -- A concurrent/retried request observes the committed result after waiting
  -- on the room lock. It is intentionally idempotent rather than a second
  -- transition with another point grant.
  IF r.stage_version = p_expected_version + 1 THEN RETURN r; END IF;
  IF r.stage_version > p_expected_version THEN RAISE EXCEPTION 'ROOM_VERSION_CONFLICT'; END IF;
  IF r.stage_version < p_expected_version THEN RAISE EXCEPTION 'ROOM_VERSION_CONFLICT'; END IF;
  IF r.status = 'finished' THEN RETURN r; END IF;
  IF r.status <> 'running' THEN RAISE EXCEPTION 'ROOM_NOT_RUNNING'; END IF;

  -- Lock and inspect all slots before deciding whether the transition is
  -- allowed. The deadline path is the only exception to all-player readiness.
  FOR slot_row IN
    SELECT * FROM public.multiplayer_company_slots
    WHERE room_id = p_room_id
    ORDER BY id
    FOR UPDATE
  LOOP
    slot_count := slot_count + 1;
    IF slot_row.player_user_id IS NOT NULL THEN occupied_count := occupied_count + 1; END IF;
    IF slot_row.player_user_id IS NOT NULL AND slot_row.ready_stage = r.current_stage THEN ready_count := ready_count + 1; END IF;
  END LOOP;
  IF slot_count < 2 OR occupied_count < slot_count THEN RAISE EXCEPTION 'ALL_COMPANIES_REQUIRE_PLAYERS'; END IF;
  IF (r.stage_deadline_at IS NULL OR r.stage_deadline_at > now()) AND ready_count < slot_count THEN
    RAISE EXCEPTION 'ROOM_NOT_READY';
  END IF;

  final_stage := r.current_stage >= r.max_stages;
  next_stage := CASE WHEN final_stage THEN r.current_stage ELSE r.current_stage + 1 END;

  -- Every attached runtime advances in the same transaction as the room. The
  -- relational action_points/version columns and the JSON snapshot are kept in
  -- sync so normal game-session reads observe the same stage.
  FOR slot_row IN
    SELECT * FROM public.multiplayer_company_slots
    WHERE room_id = p_room_id
    ORDER BY id
    FOR UPDATE
  LOOP
    IF slot_row.game_session_id IS NULL THEN
      RAISE EXCEPTION 'COMPANY_RUNTIME_MISSING';
    END IF;
    SELECT * INTO runtime_row
      FROM public.game_runtime_states
      WHERE session_id = slot_row.game_session_id
      FOR UPDATE;
    IF runtime_row.session_id IS NULL THEN RAISE EXCEPTION 'COMPANY_RUNTIME_MISSING'; END IF;

    next_action_points := CASE
      WHEN final_stage THEN GREATEST(0, runtime_row.action_points)
      ELSE LEAST(28, GREATEST(0, runtime_row.action_points) + 8)
    END;
    next_simulation := COALESCE(runtime_row.simulation_state, '{}'::jsonb);
    next_simulation := jsonb_set(next_simulation, '{currentRound}', to_jsonb(next_stage), true);
    next_simulation := jsonb_set(next_simulation, '{currentStage}', to_jsonb(next_stage), true);
    next_simulation := jsonb_set(next_simulation, '{maxRounds}', to_jsonb(r.max_stages), true);
    next_simulation := jsonb_set(next_simulation, '{maxStages}', to_jsonb(r.max_stages), true);
    next_simulation := jsonb_set(next_simulation, '{actionPoints}', to_jsonb(next_action_points), true);
    next_simulation := jsonb_set(next_simulation, '{submissionReady}', to_jsonb(final_stage), true);
    next_simulation := jsonb_set(next_simulation, '{lastAction}', to_jsonb('multiplayer_stage_advance'), true);

    UPDATE public.game_runtime_states
       SET action_points = next_action_points,
           simulation_state = next_simulation,
           last_action = 'multiplayer_stage_advance',
           version = runtime_row.version + 1,
           updated_at = now()
     WHERE session_id = slot_row.game_session_id;
    UPDATE public.game_sessions
       SET current_round = next_stage,
           max_round = r.max_stages
     WHERE id = slot_row.game_session_id;

    -- Hidden company progress is derived server-side from the runtime and is
    -- never placed in shared_customer_state or returned to player APIs.
    average_dimension := (
      CASE WHEN jsonb_typeof(runtime_row.dimensions->'decisionAnalysis') = 'number' THEN (runtime_row.dimensions->>'decisionAnalysis')::numeric ELSE 50 END
      + CASE WHEN jsonb_typeof(runtime_row.dimensions->'relationshipBuilding') = 'number' THEN (runtime_row.dimensions->>'relationshipBuilding')::numeric ELSE 50 END
      + CASE WHEN jsonb_typeof(runtime_row.dimensions->'valuePresentation') = 'number' THEN (runtime_row.dimensions->>'valuePresentation')::numeric ELSE 50 END
      + CASE WHEN jsonb_typeof(runtime_row.dimensions->'objectionHandling') = 'number' THEN (runtime_row.dimensions->>'objectionHandling')::numeric ELSE 50 END
      + CASE WHEN jsonb_typeof(runtime_row.dimensions->'informationDiscovery') = 'number' THEN (runtime_row.dimensions->>'informationDiscovery')::numeric ELSE 50 END
    ) / 5;
    average_affinity := (
      SELECT COALESCE(avg(value::numeric), 35)
      FROM jsonb_each_text(COALESCE(runtime_row.npc_affinity, '{}'::jsonb))
      WHERE value ~ '^-?[0-9]+([.][0-9]+)?$'
    );
    progress_delta := GREATEST(-5, LEAST(5, round((average_dimension - 50) / 10 + (average_affinity - 35) / 10)::integer));
    next_hidden_progress := GREATEST(0, LEAST(100, slot_row.hidden_progress_score + progress_delta));
    UPDATE public.multiplayer_company_slots
       SET hidden_progress_score = next_hidden_progress,
           ready_stage = NULL,
           ready_by_admin = false,
           updated_at = now()
     WHERE id = slot_row.id;
  END LOOP;

  next_shared_customer_state := COALESCE(r.shared_customer_state, '{}'::jsonb)
    || jsonb_build_object(
      'currentStage', next_stage,
      'lastCompletedStage', r.current_stage,
      'companyCount', slot_count,
      'updatedAt', now()
    );
  UPDATE public.multiplayer_rooms
     SET current_stage = next_stage,
         status = CASE WHEN final_stage THEN 'finished' ELSE status END,
         stage_version = stage_version + 1,
         stage_deadline_at = CASE
           WHEN final_stage OR stage_duration_seconds IS NULL THEN NULL
           ELSE now() + make_interval(secs => stage_duration_seconds)
         END,
         shared_customer_state = next_shared_customer_state,
         updated_at = now()
   WHERE id = p_room_id
   RETURNING * INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.advance_multiplayer_stage(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.advance_multiplayer_stage(uuid, integer) TO service_role;

-- Marking a player's stage complete and deciding whether to advance must also
-- be atomic. It prevents two ready requests from observing the same old slot
-- set and racing a separate read/update/RPC sequence in the API.
CREATE OR REPLACE FUNCTION public.mark_multiplayer_ready(p_room_id uuid, p_user_id text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.multiplayer_rooms;
  slot_row public.multiplayer_company_slots;
  slot_count integer;
  occupied_count integer;
  ready_count integer;
  advance_reason text;
  advanced_room public.multiplayer_rooms;
BEGIN
  SELECT * INTO r FROM public.multiplayer_rooms WHERE id = p_room_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'ROOM_NOT_FOUND'; END IF;
  IF r.status <> 'running' THEN RAISE EXCEPTION 'ROOM_NOT_RUNNING'; END IF;
  SELECT * INTO slot_row FROM public.multiplayer_company_slots
    WHERE room_id = p_room_id AND player_user_id = p_user_id FOR UPDATE;
  IF slot_row.id IS NULL THEN RAISE EXCEPTION 'NOT_A_ROOM_PLAYER'; END IF;

  UPDATE public.multiplayer_company_slots
     SET ready_stage = r.current_stage, ready_by_admin = false, updated_at = now()
   WHERE id = slot_row.id;
  SELECT count(*), count(player_user_id), count(*) FILTER (WHERE player_user_id IS NOT NULL AND ready_stage = r.current_stage)
    INTO slot_count, occupied_count, ready_count
    FROM public.multiplayer_company_slots
   WHERE room_id = p_room_id;
  IF slot_count < 2 OR occupied_count < slot_count THEN RAISE EXCEPTION 'ALL_COMPANIES_REQUIRE_PLAYERS'; END IF;
  IF ready_count = slot_count THEN
    advance_reason := 'all_ready';
  ELSIF r.stage_deadline_at IS NOT NULL AND r.stage_deadline_at <= now() THEN
    advance_reason := 'timeout';
  ELSE
    RETURN jsonb_build_object('advanced', false, 'reason', NULL, 'room', to_jsonb(r));
  END IF;

  SELECT * INTO advanced_room FROM public.advance_multiplayer_stage(p_room_id, r.stage_version);
  RETURN jsonb_build_object('advanced', true, 'reason', advance_reason, 'room', to_jsonb(advanced_room));
END $$;
REVOKE ALL ON FUNCTION public.mark_multiplayer_ready(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_multiplayer_ready(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.join_multiplayer_company(
  p_room_code text, p_company_id text, p_user_id text, p_user_name text, p_state jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r multiplayer_rooms; s multiplayer_company_slots; scenario_uuid uuid; new_session_id uuid;
BEGIN
  SELECT * INTO r FROM multiplayer_rooms WHERE room_code=upper(p_room_code) FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'ROOM_NOT_FOUND'; END IF;
  IF r.status <> 'waiting' THEN RAISE EXCEPTION 'ROOM_ALREADY_STARTED'; END IF;
  IF EXISTS (SELECT 1 FROM multiplayer_company_slots WHERE room_id=r.id AND player_user_id=p_user_id) THEN RAISE EXCEPTION 'PLAYER_ALREADY_JOINED'; END IF;
  SELECT * INTO s FROM multiplayer_company_slots WHERE room_id=r.id AND company_id=p_company_id FOR UPDATE;
  IF s.id IS NULL THEN RAISE EXCEPTION 'COMPANY_SLOT_NOT_FOUND'; END IF;
  IF s.player_user_id IS NOT NULL THEN RAISE EXCEPTION 'COMPANY_SLOT_OCCUPIED'; END IF;
  SELECT id INTO scenario_uuid FROM project_scenarios WHERE code=r.scenario_code;
  IF scenario_uuid IS NULL THEN RAISE EXCEPTION 'SCENARIO_NOT_CONFIGURED'; END IF;
  INSERT INTO game_sessions(user_id,user_name,scenario_id,difficulty,mode,multiplayer,current_round,max_round,total_score,win_probability,status)
  VALUES(p_user_id,p_user_name,scenario_uuid,1,'ai_dialog',true,1,5,50,50,'playing') RETURNING id INTO new_session_id;
  INSERT INTO game_runtime_states(session_id,scenario_code,action_points,dimensions,npc_affinity,unlocked_npc_ids,unlocked_clues,conversation_memories,npc_contacts,active_meeting,simulation_state,last_action,version)
  VALUES(
    new_session_id,
    r.scenario_code,
    LEAST(28, GREATEST(0, COALESCE((p_state->>'actionPoints')::int, 28))),
    COALESCE(p_state->'dimensions','{}'),
    COALESCE(p_state->'npcAffinity','{}'),
    COALESCE(p_state->'unlockedNpcIds','[]'),
    COALESCE(p_state->'unlockedClues','[]'),
    COALESCE(p_state->'conversationMemories','{}'),
    COALESCE(p_state->'npcContacts','{}'),
    p_state->'activeMeeting',
    COALESCE(p_state, '{}'::jsonb) || jsonb_build_object(
      'gameMode', 'multiplayer',
      'companyId', p_company_id,
      'knownPersonalInfo', COALESCE(s.initial_personal_info, '{}'::jsonb),
      'currentRound', 1,
      'currentStage', 1,
      'maxRounds', 5,
      'maxStages', 5,
      'actionPoints', LEAST(28, GREATEST(0, COALESCE((p_state->>'actionPoints')::int, 28))),
      'version', 1
    ),
    NULL,
    1
  );
  UPDATE multiplayer_company_slots SET player_user_id=p_user_id,game_session_id=new_session_id,connected=true,updated_at=now() WHERE id=s.id;
  RETURN jsonb_build_object('roomId',r.id,'slotId',s.id,'sessionId',new_session_id,'companyId',p_company_id);
END $$;
REVOKE ALL ON FUNCTION public.join_multiplayer_company(text,text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_multiplayer_company(text,text,text,text,jsonb) TO service_role;
