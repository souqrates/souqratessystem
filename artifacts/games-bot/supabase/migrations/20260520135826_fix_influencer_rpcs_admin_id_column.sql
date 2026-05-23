/*
  # Fix influencer RPCs - wrong column name in admin check

  The manager_admins table uses `telegram_id` not `admin_id`.
  All influencer-related RPCs were checking `WHERE admin_id = p_admin_id`
  which always failed (column does not exist silently in some contexts,
  or returned unauthorized for every request).

  This migration rewrites all 5 affected RPCs to use `telegram_id::text`.
*/

-- ── manager_list_submissions ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.manager_list_submissions(
  p_admin_id text,
  p_status   text    DEFAULT NULL,
  p_limit    integer DEFAULT 100,
  p_offset   integer DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM manager_admins WHERE telegram_id::text = p_admin_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'submissions', (
      SELECT COALESCE(jsonb_agg(row_to_json(s) ORDER BY s.submitted_at DESC), '[]'::jsonb)
      FROM (
        SELECT id, answers, status, notes, submitted_at, updated_at
        FROM influencer_submissions
        WHERE (p_status IS NULL OR status = p_status)
        ORDER BY submitted_at DESC
        LIMIT p_limit OFFSET p_offset
      ) s
    ),
    'total', (SELECT COUNT(*) FROM influencer_submissions WHERE (p_status IS NULL OR status = p_status))
  );
END;
$$;

-- ── manager_update_submission ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.manager_update_submission(
  p_admin_id text,
  p_id       integer,
  p_status   text    DEFAULT NULL,
  p_notes    text    DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM manager_admins WHERE telegram_id::text = p_admin_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  UPDATE influencer_submissions
  SET
    status     = COALESCE(p_status, status),
    notes      = COALESCE(p_notes,  notes),
    updated_at = now()
  WHERE id = p_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── manager_delete_submission ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.manager_delete_submission(
  p_admin_id text,
  p_id       integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM manager_admins WHERE telegram_id::text = p_admin_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  DELETE FROM influencer_submissions WHERE id = p_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── manager_list_form_questions ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.manager_list_form_questions(
  p_admin_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM manager_admins WHERE telegram_id::text = p_admin_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'questions', (
      SELECT COALESCE(jsonb_agg(row_to_json(q) ORDER BY q.sort_order), '[]'::jsonb)
      FROM influencer_form_questions q
    )
  );
END;
$$;

-- ── manager_upsert_form_question ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.manager_upsert_form_question(
  p_admin_id    text,
  p_id          integer DEFAULT NULL,
  p_label       text    DEFAULT '',
  p_field_key   text    DEFAULT '',
  p_field_type  text    DEFAULT 'text',
  p_placeholder text    DEFAULT '',
  p_options     text    DEFAULT '',
  p_required    boolean DEFAULT true,
  p_sort_order  integer DEFAULT 0,
  p_is_active   boolean DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM manager_admins WHERE telegram_id::text = p_admin_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  IF p_id IS NOT NULL THEN
    UPDATE influencer_form_questions
    SET
      label       = p_label,
      field_key   = p_field_key,
      field_type  = p_field_type,
      placeholder = p_placeholder,
      options     = p_options,
      required    = p_required,
      sort_order  = p_sort_order,
      is_active   = p_is_active,
      updated_at  = now()
    WHERE id = p_id;
  ELSE
    INSERT INTO influencer_form_questions
      (label, field_key, field_type, placeholder, options, required, sort_order, is_active)
    VALUES
      (p_label, p_field_key, p_field_type, p_placeholder, p_options, p_required, p_sort_order, p_is_active);
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── manager_delete_form_question ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.manager_delete_form_question(
  p_admin_id text,
  p_id       integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM manager_admins WHERE telegram_id::text = p_admin_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  DELETE FROM influencer_form_questions WHERE id = p_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;
