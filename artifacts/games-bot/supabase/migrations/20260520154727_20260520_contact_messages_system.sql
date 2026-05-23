/*
  # Contact Messages System

  ## Overview
  Creates a full contact us system with:
  - `contact_messages` table to store messages sent from the app
  - Contact info stored in manager_config (WhatsApp, Telegram, Email)
  - RPCs for users to submit and admins to manage messages
  - Full RLS: users can only insert, admins can read/update all

  ## New Tables
  - `contact_messages`: stores messages from users (name, subject, body, status, reply)

  ## Security
  - RLS enabled, users can only INSERT (no read-back of others' messages)
  - Admin RPC `manager_list_contact_messages` reads all messages
  - Admin RPC `manager_update_contact_message` marks read/replied
*/

-- ─── contact_messages table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   text,
  telegram_id  bigint,
  name         text NOT NULL DEFAULT '',
  email        text NOT NULL DEFAULT '',
  subject      text NOT NULL DEFAULT '',
  body         text NOT NULL,
  status       text NOT NULL DEFAULT 'unread' CHECK (status IN ('unread','read','replied','archived')),
  admin_reply  text,
  replied_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- Users can submit messages (insert only, no select)
CREATE POLICY "Anyone can submit a contact message"
  ON contact_messages FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- ─── RPC: submit_contact_message (user-facing) ───────────────────────────────
CREATE OR REPLACE FUNCTION submit_contact_message(
  p_session_id  text,
  p_name        text,
  p_email       text,
  p_subject     text,
  p_body        text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tg_id bigint;
  v_id    uuid;
BEGIN
  -- Validate body
  IF p_body IS NULL OR length(trim(p_body)) < 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'message_too_short');
  END IF;

  -- Look up telegram_id from session if provided
  IF p_session_id IS NOT NULL AND p_session_id <> '' THEN
    SELECT telegram_id INTO v_tg_id
    FROM sessions WHERE id = p_session_id AND expires_at > now()
    LIMIT 1;
  END IF;

  INSERT INTO contact_messages(session_id, telegram_id, name, email, subject, body)
  VALUES (p_session_id, v_tg_id, trim(coalesce(p_name,'')), trim(coalesce(p_email,'')), trim(coalesce(p_subject,'')), trim(p_body))
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

-- ─── RPC: manager_list_contact_messages ─────────────────────────────────────
CREATE OR REPLACE FUNCTION manager_list_contact_messages(
  p_admin_id  int,
  p_status    text DEFAULT NULL,
  p_limit     int  DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM manager_admins WHERE id = p_admin_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'ok', true,
      'messages', coalesce(jsonb_agg(
        jsonb_build_object(
          'id',          m.id,
          'telegram_id', m.telegram_id,
          'name',        m.name,
          'email',       m.email,
          'subject',     m.subject,
          'body',        m.body,
          'status',      m.status,
          'admin_reply', m.admin_reply,
          'replied_at',  m.replied_at,
          'created_at',  m.created_at
        ) ORDER BY m.created_at DESC
      ), '[]'::jsonb)
    )
    FROM contact_messages m
    WHERE (p_status IS NULL OR m.status = p_status)
    LIMIT p_limit
  );
END;
$$;

-- ─── RPC: manager_update_contact_message ────────────────────────────────────
CREATE OR REPLACE FUNCTION manager_update_contact_message(
  p_admin_id  int,
  p_id        uuid,
  p_status    text DEFAULT NULL,
  p_reply     text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM manager_admins WHERE id = p_admin_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  UPDATE contact_messages
  SET
    status      = COALESCE(p_status, status),
    admin_reply = COALESCE(p_reply, admin_reply),
    replied_at  = CASE WHEN p_reply IS NOT NULL THEN now() ELSE replied_at END
  WHERE id = p_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ─── Insert default contact info into manager_config ─────────────────────────
INSERT INTO manager_config(key, value, category, label, description)
VALUES
  ('contact_whatsapp', '', 'contact', 'WhatsApp Number', 'WhatsApp contact number (e.g. +9661234567890)'),
  ('contact_telegram', '', 'contact', 'Telegram Username', 'Telegram support username (e.g. @SouqratesSupport)'),
  ('contact_email',    '', 'contact', 'Support Email',    'Support email address')
ON CONFLICT (key) DO NOTHING;

-- Grant execute
GRANT EXECUTE ON FUNCTION submit_contact_message TO anon, authenticated;
GRANT EXECUTE ON FUNCTION manager_list_contact_messages TO authenticated;
GRANT EXECUTE ON FUNCTION manager_update_contact_message TO authenticated;
