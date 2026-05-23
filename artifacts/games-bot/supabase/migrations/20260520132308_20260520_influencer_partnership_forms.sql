/*
  # Influencer Partnership Forms System

  ## Summary
  Creates a fully dynamic influencer partnership application system where:
  - The manager can define custom form questions (text, textarea, select, number, url)
  - Influencers fill in the form at /influencers
  - Submissions are stored and viewable/manageable from the manager dashboard
  - Manager can update submission status (pending, reviewing, approved, rejected)
  - Questions can be added, edited, reordered, or deleted at any time

  ## New Tables
  1. `influencer_form_questions` — dynamic question definitions with ordering
  2. `influencer_submissions` — influencer form responses

  ## Security
  - RLS enabled on both tables
  - Public can INSERT into influencer_submissions (fill form)
  - Public can SELECT questions (to render form)
  - Only service_role can manage questions and view/update submissions
  - Manager RPCs use admin_id validation against manager_admins table
*/

-- ─── 1. Form Questions Table ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS influencer_form_questions (
  id          serial PRIMARY KEY,
  label       text    NOT NULL,
  field_key   text    NOT NULL UNIQUE,
  field_type  text    NOT NULL DEFAULT 'text',  -- text | textarea | select | number | url | email
  placeholder text    NOT NULL DEFAULT '',
  options     text    NOT NULL DEFAULT '',       -- comma-separated for select type
  required    boolean NOT NULL DEFAULT true,
  sort_order  int     NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE influencer_form_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active questions"
  ON influencer_form_questions FOR SELECT TO anon, authenticated
  USING (is_active = true);

GRANT SELECT ON TABLE influencer_form_questions TO anon, authenticated;
GRANT ALL ON TABLE influencer_form_questions TO service_role;
GRANT USAGE, SELECT ON SEQUENCE influencer_form_questions_id_seq TO service_role;

-- ─── 2. Submissions Table ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS influencer_submissions (
  id          serial PRIMARY KEY,
  answers     jsonb   NOT NULL DEFAULT '{}',
  status      text    NOT NULL DEFAULT 'pending',  -- pending | reviewing | approved | rejected
  notes       text    NOT NULL DEFAULT '',         -- internal manager notes
  submitted_at timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE influencer_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit"
  ON influencer_submissions FOR INSERT TO anon, authenticated
  WITH CHECK (true);

GRANT INSERT ON TABLE influencer_submissions TO anon, authenticated;
GRANT ALL ON TABLE influencer_submissions TO service_role;
GRANT USAGE, SELECT ON SEQUENCE influencer_submissions_id_seq TO service_role;

-- ─── 3. Seed Default Questions ────────────────────────────────────────────────

INSERT INTO influencer_form_questions (label, field_key, field_type, placeholder, options, required, sort_order)
VALUES
  ('Full Name',              'full_name',      'text',     'Your full name',                          '', true,  0),
  ('Email Address',          'email',          'email',    'your@email.com',                          '', true,  1),
  ('Telegram Username',      'telegram',       'text',     '@yourusername',                           '', true,  2),
  ('Platform / Channel',     'platform',       'select',   'Select your primary platform',            'Telegram,Instagram,TikTok,YouTube,Twitter/X,Snapchat,Other', true, 3),
  ('Channel / Page Link',    'channel_link',   'url',      'https://',                               '', true,  4),
  ('Number of Followers',    'followers',      'number',   'e.g. 50000',                             '', true,  5),
  ('Average Post Views',     'avg_views',      'number',   'e.g. 10000',                             '', false, 6),
  ('Audience Country / Region', 'audience_geo','text',     'e.g. Saudi Arabia, Gulf Region',         '', true,  7),
  ('Content Niche',          'niche',          'select',   'Select your content niche',               'Gaming,Finance & Crypto,Lifestyle,Entertainment,Tech,Sports,Other', true, 8),
  ('Brief Bio / Introduction','bio',           'textarea', 'Tell us about yourself and your audience…','', true, 9),
  ('Expected Collaboration Type', 'collab_type','select',  'How would you like to collaborate?',      'Paid post,Revenue share,Affiliate link,Giveaway,Long-term partnership,Other', true, 10),
  ('Previous Brand Partnerships', 'past_collabs','textarea','List any relevant past collaborations…',  '', false, 11),
  ('Anything else you want to tell us?', 'extra_notes','textarea','Optional notes…',                  '', false, 12)
ON CONFLICT (field_key) DO NOTHING;

-- ─── 4. Manager RPCs ─────────────────────────────────────────────────────────

-- List all questions (manager view — includes inactive)
CREATE OR REPLACE FUNCTION manager_list_form_questions(p_admin_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM manager_admins WHERE admin_id = p_admin_id) THEN
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

GRANT EXECUTE ON FUNCTION manager_list_form_questions(text) TO anon, authenticated;

-- Upsert a question
CREATE OR REPLACE FUNCTION manager_upsert_form_question(
  p_admin_id   text,
  p_id         int     DEFAULT NULL,
  p_label      text    DEFAULT '',
  p_field_key  text    DEFAULT '',
  p_field_type text    DEFAULT 'text',
  p_placeholder text   DEFAULT '',
  p_options    text    DEFAULT '',
  p_required   boolean DEFAULT true,
  p_sort_order int     DEFAULT 0,
  p_is_active  boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM manager_admins WHERE admin_id = p_admin_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;
  IF p_label = '' OR p_field_key = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'label and field_key required');
  END IF;
  IF p_id IS NOT NULL THEN
    UPDATE influencer_form_questions SET
      label = p_label, field_key = p_field_key, field_type = p_field_type,
      placeholder = p_placeholder, options = p_options, required = p_required,
      sort_order = p_sort_order, is_active = p_is_active
    WHERE id = p_id;
  ELSE
    INSERT INTO influencer_form_questions (label, field_key, field_type, placeholder, options, required, sort_order, is_active)
    VALUES (p_label, p_field_key, p_field_type, p_placeholder, p_options, p_required, p_sort_order, p_is_active)
    ON CONFLICT (field_key) DO UPDATE SET
      label = EXCLUDED.label, field_type = EXCLUDED.field_type,
      placeholder = EXCLUDED.placeholder, options = EXCLUDED.options,
      required = EXCLUDED.required, sort_order = EXCLUDED.sort_order,
      is_active = EXCLUDED.is_active;
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION manager_upsert_form_question(text, int, text, text, text, text, text, boolean, int, boolean) TO anon, authenticated;

-- Delete a question
CREATE OR REPLACE FUNCTION manager_delete_form_question(p_admin_id text, p_id int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM manager_admins WHERE admin_id = p_admin_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;
  DELETE FROM influencer_form_questions WHERE id = p_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION manager_delete_form_question(text, int) TO anon, authenticated;

-- List submissions (with optional status filter)
CREATE OR REPLACE FUNCTION manager_list_submissions(
  p_admin_id text,
  p_status   text DEFAULT NULL,
  p_limit    int  DEFAULT 100,
  p_offset   int  DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM manager_admins WHERE admin_id = p_admin_id) THEN
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

GRANT EXECUTE ON FUNCTION manager_list_submissions(text, text, int, int) TO anon, authenticated;

-- Update submission status / notes
CREATE OR REPLACE FUNCTION manager_update_submission(
  p_admin_id text,
  p_id       int,
  p_status   text    DEFAULT NULL,
  p_notes    text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM manager_admins WHERE admin_id = p_admin_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;
  UPDATE influencer_submissions SET
    status     = COALESCE(p_status, status),
    notes      = COALESCE(p_notes, notes),
    updated_at = now()
  WHERE id = p_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION manager_update_submission(text, int, text, text) TO anon, authenticated;

-- Delete a submission
CREATE OR REPLACE FUNCTION manager_delete_submission(p_admin_id text, p_id int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM manager_admins WHERE admin_id = p_admin_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;
  DELETE FROM influencer_submissions WHERE id = p_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION manager_delete_submission(text, int) TO anon, authenticated;

-- Public submit function (called from form page)
CREATE OR REPLACE FUNCTION submit_influencer_form(p_answers jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id int;
BEGIN
  IF p_answers IS NULL OR p_answers = '{}'::jsonb THEN
    RETURN jsonb_build_object('ok', false, 'error', 'empty_submission');
  END IF;
  INSERT INTO influencer_submissions (answers) VALUES (p_answers) RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

GRANT EXECUTE ON FUNCTION submit_influencer_form(jsonb) TO anon, authenticated;
