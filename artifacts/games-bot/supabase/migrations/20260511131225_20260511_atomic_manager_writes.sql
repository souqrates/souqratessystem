
/*
  # Atomic Manager Writes

  ## Problem
  Previously, the client called set_admin_id() then performed a write
  in a separate HTTP request. Postgres `set_config(..., is_local=true)`
  only persists for the duration of the transaction, so the write
  request had no admin_id set and RLS rejected it silently.

  ## Solution
  Provide RPC functions that perform the auth check and the write in
  the SAME function call (and therefore the same transaction). The
  function uses SECURITY DEFINER and explicitly verifies the caller
  is an admin by reading manager_admins inside the function.

  ## New Functions
  - manager_upsert_staging
  - manager_discard_staging
  - manager_discard_all_staging
  - manager_publish_all
  - manager_update_config
  - manager_upsert_game_override
  - manager_add_admin
  - manager_remove_admin
*/

-- Helper to require admin auth inside a SECURITY DEFINER function
CREATE OR REPLACE FUNCTION require_manager_admin(tid bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF tid IS NULL OR NOT EXISTS (SELECT 1 FROM manager_admins WHERE telegram_id = tid) THEN
    RAISE EXCEPTION 'Unauthorized: admin telegram_id not found';
  END IF;
END;
$$;

-- ─── Staging Config ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION manager_upsert_staging(
  p_admin_id bigint,
  p_key text,
  p_value text,
  p_type text,
  p_category text,
  p_label text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM require_manager_admin(p_admin_id);
  INSERT INTO manager_preview_config (key, value, type, category, label, updated_at)
  VALUES (p_key, p_value, p_type, p_category, p_label, now())
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        type = EXCLUDED.type,
        category = EXCLUDED.category,
        label = EXCLUDED.label,
        updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION manager_discard_staging(p_admin_id bigint, p_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM require_manager_admin(p_admin_id);
  DELETE FROM manager_preview_config WHERE key = p_key;
END;
$$;

CREATE OR REPLACE FUNCTION manager_discard_all_staging(p_admin_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM require_manager_admin(p_admin_id);
  DELETE FROM manager_preview_config;
END;
$$;

-- ─── Publish: preserves description from existing manager_config rows ────────
CREATE OR REPLACE FUNCTION manager_publish_all(p_admin_id bigint)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer := 0;
  rec record;
BEGIN
  PERFORM require_manager_admin(p_admin_id);

  FOR rec IN SELECT * FROM manager_preview_config LOOP
    INSERT INTO manager_config (key, value, type, category, label, description, updated_at)
    VALUES (
      rec.key,
      rec.value,
      COALESCE(rec.type, 'text'),
      COALESCE(rec.category, 'general'),
      COALESCE(rec.label, rec.key),
      '',
      now()
    )
    ON CONFLICT (key) DO UPDATE
      SET value      = EXCLUDED.value,
          type       = EXCLUDED.type,
          category   = EXCLUDED.category,
          label      = EXCLUDED.label,
          -- preserve existing description (do NOT overwrite)
          updated_at = now();
    v_count := v_count + 1;
  END LOOP;

  DELETE FROM manager_preview_config;
  RETURN v_count;
END;
$$;

-- ─── Live config single-key update ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION manager_update_config(
  p_admin_id bigint,
  p_key text,
  p_value text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM require_manager_admin(p_admin_id);
  UPDATE manager_config SET value = p_value, updated_at = now() WHERE key = p_key;
END;
$$;

-- ─── Game overrides ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION manager_upsert_game_override(
  p_admin_id bigint,
  p_game_id integer,
  p_fields jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM require_manager_admin(p_admin_id);
  INSERT INTO manager_games (game_id, enabled, name_override, emoji_override, reward_override, difficulty_override, desc_override, updated_at)
  VALUES (
    p_game_id,
    COALESCE((p_fields->>'enabled')::boolean, true),
    p_fields->>'name_override',
    p_fields->>'emoji_override',
    p_fields->>'reward_override',
    p_fields->>'difficulty_override',
    p_fields->>'desc_override',
    now()
  )
  ON CONFLICT (game_id) DO UPDATE
    SET enabled             = COALESCE((p_fields->>'enabled')::boolean, manager_games.enabled),
        name_override       = COALESCE(p_fields->>'name_override', manager_games.name_override),
        emoji_override      = COALESCE(p_fields->>'emoji_override', manager_games.emoji_override),
        reward_override     = COALESCE(p_fields->>'reward_override', manager_games.reward_override),
        difficulty_override = COALESCE(p_fields->>'difficulty_override', manager_games.difficulty_override),
        desc_override       = COALESCE(p_fields->>'desc_override', manager_games.desc_override),
        updated_at          = now();
END;
$$;

-- ─── Admin management ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION manager_add_admin(
  p_admin_id bigint,
  p_new_telegram_id bigint,
  p_name text,
  p_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM require_manager_admin(p_admin_id);
  INSERT INTO manager_admins (telegram_id, name, role) VALUES (p_new_telegram_id, p_name, COALESCE(p_role, 'admin'));
END;
$$;

CREATE OR REPLACE FUNCTION manager_remove_admin(p_admin_id bigint, p_target_telegram_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM require_manager_admin(p_admin_id);
  IF p_admin_id = p_target_telegram_id THEN
    RAISE EXCEPTION 'Cannot remove yourself';
  END IF;
  DELETE FROM manager_admins WHERE telegram_id = p_target_telegram_id;
END;
$$;

GRANT EXECUTE ON FUNCTION manager_upsert_staging(bigint, text, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION manager_discard_staging(bigint, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION manager_discard_all_staging(bigint) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION manager_publish_all(bigint) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION manager_update_config(bigint, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION manager_upsert_game_override(bigint, integer, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION manager_add_admin(bigint, bigint, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION manager_remove_admin(bigint, bigint) TO anon, authenticated;
