/*
  # Manager broadcasts + in-app notification banners

  Tables:
    - app_notifications: manager banners (with target/window/dismiss controls)
    - app_notification_dismissals: per-user dismissals
    - telegram_broadcasts: queue + status of bot broadcasts

  RLS: end-users only read active notifications targeted to them; broadcasts are
  reachable only via SECURITY DEFINER RPCs guarded by is_manager_admin().
*/

CREATE OR REPLACE FUNCTION public.is_manager_admin(p_telegram_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM manager_admins WHERE telegram_id = p_telegram_id
  );
$$;

CREATE TABLE IF NOT EXISTS public.app_notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL DEFAULT '',
  body            text NOT NULL DEFAULT '',
  image_url       text DEFAULT '',
  link_url        text DEFAULT '',
  link_label      text DEFAULT '',
  accent_color    text DEFAULT '#00d4ff',
  priority        integer NOT NULL DEFAULT 0,
  target_type     text NOT NULL DEFAULT 'all',
  target_ids      bigint[] NOT NULL DEFAULT '{}',
  starts_at       timestamptz NOT NULL DEFAULT now(),
  ends_at         timestamptz,
  is_active       boolean NOT NULL DEFAULT true,
  dismissible     boolean NOT NULL DEFAULT true,
  created_by      bigint,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_notifications_window_idx
  ON public.app_notifications (is_active, starts_at, ends_at);

ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon read active notifications" ON public.app_notifications;
CREATE POLICY "anon read active notifications"
  ON public.app_notifications FOR SELECT
  TO anon, authenticated
  USING (
    is_active = true
    AND starts_at <= now()
    AND (ends_at IS NULL OR ends_at > now())
  );

CREATE TABLE IF NOT EXISTS public.app_notification_dismissals (
  notification_id uuid NOT NULL REFERENCES public.app_notifications(id) ON DELETE CASCADE,
  telegram_id     bigint NOT NULL,
  dismissed_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id, telegram_id)
);
ALTER TABLE public.app_notification_dismissals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owners read dismissals" ON public.app_notification_dismissals;
CREATE POLICY "owners read dismissals"
  ON public.app_notification_dismissals FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS public.telegram_broadcasts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_telegram_id   bigint NOT NULL,
  target_type         text NOT NULL DEFAULT 'all',
  target_ids          bigint[] NOT NULL DEFAULT '{}',
  message             text NOT NULL DEFAULT '',
  parse_mode          text NOT NULL DEFAULT 'HTML',
  inline_button_text  text DEFAULT '',
  inline_button_url   text DEFAULT '',
  status              text NOT NULL DEFAULT 'pending',
  total               integer NOT NULL DEFAULT 0,
  sent                integer NOT NULL DEFAULT 0,
  failed              integer NOT NULL DEFAULT 0,
  error_text          text DEFAULT '',
  started_at          timestamptz,
  finished_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.telegram_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.manager_create_app_notification(
  p_admin_id      bigint,
  p_title         text,
  p_body          text,
  p_image_url     text DEFAULT '',
  p_link_url      text DEFAULT '',
  p_link_label    text DEFAULT '',
  p_accent_color  text DEFAULT '#00d4ff',
  p_priority      integer DEFAULT 0,
  p_target_type   text DEFAULT 'all',
  p_target_ids    bigint[] DEFAULT '{}',
  p_starts_at     timestamptz DEFAULT NULL,
  p_ends_at       timestamptz DEFAULT NULL,
  p_dismissible   boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.is_manager_admin(p_admin_id) THEN RAISE EXCEPTION 'not_admin'; END IF;

  INSERT INTO public.app_notifications (
    title, body, image_url, link_url, link_label, accent_color, priority,
    target_type, target_ids, starts_at, ends_at, dismissible, created_by
  ) VALUES (
    COALESCE(p_title,''), COALESCE(p_body,''), COALESCE(p_image_url,''),
    COALESCE(p_link_url,''), COALESCE(p_link_label,''),
    COALESCE(p_accent_color,'#00d4ff'), COALESCE(p_priority,0),
    COALESCE(p_target_type,'all'), COALESCE(p_target_ids,'{}'::bigint[]),
    COALESCE(p_starts_at, now()), p_ends_at, COALESCE(p_dismissible,true),
    p_admin_id
  )
  RETURNING id INTO v_id;

  BEGIN PERFORM _manager_log(p_admin_id, 'app_notification_create', jsonb_build_object('id', v_id, 'title', p_title));
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.manager_list_app_notifications(p_admin_id bigint)
RETURNS SETOF public.app_notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_manager_admin(p_admin_id) THEN RAISE EXCEPTION 'not_admin'; END IF;
  RETURN QUERY SELECT * FROM public.app_notifications ORDER BY created_at DESC LIMIT 200;
END;
$$;

CREATE OR REPLACE FUNCTION public.manager_delete_app_notification(p_admin_id bigint, p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_manager_admin(p_admin_id) THEN RAISE EXCEPTION 'not_admin'; END IF;
  UPDATE public.app_notifications SET is_active = false WHERE id = p_id;
  BEGIN PERFORM _manager_log(p_admin_id, 'app_notification_delete', jsonb_build_object('id', p_id));
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_active_app_notifications(p_telegram_id bigint)
RETURNS TABLE (
  id uuid, title text, body text, image_url text, link_url text, link_label text,
  accent_color text, priority integer, starts_at timestamptz, ends_at timestamptz, dismissible boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT n.id, n.title, n.body, n.image_url, n.link_url, n.link_label,
         n.accent_color, n.priority, n.starts_at, n.ends_at, n.dismissible
  FROM public.app_notifications n
  WHERE n.is_active = true
    AND n.starts_at <= now()
    AND (n.ends_at IS NULL OR n.ends_at > now())
    AND (n.target_type = 'all'
         OR (n.target_type IN ('user','group') AND p_telegram_id = ANY(n.target_ids)))
    AND NOT EXISTS (
      SELECT 1 FROM public.app_notification_dismissals d
      WHERE d.notification_id = n.id AND d.telegram_id = p_telegram_id
    )
  ORDER BY n.priority DESC, n.created_at DESC
  LIMIT 25;
$$;

CREATE OR REPLACE FUNCTION public.dismiss_app_notification(p_telegram_id bigint, p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_telegram_id IS NULL OR p_id IS NULL THEN RETURN false; END IF;
  INSERT INTO public.app_notification_dismissals (notification_id, telegram_id)
  VALUES (p_id, p_telegram_id) ON CONFLICT DO NOTHING;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.manager_create_broadcast(
  p_admin_id bigint, p_target_type text, p_target_ids bigint[], p_message text,
  p_parse_mode text DEFAULT 'HTML',
  p_inline_button_text text DEFAULT '', p_inline_button_url text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_total integer := 0;
BEGIN
  IF NOT public.is_manager_admin(p_admin_id) THEN RAISE EXCEPTION 'not_admin'; END IF;

  IF COALESCE(p_target_type,'all') = 'all' THEN
    SELECT COUNT(*) INTO v_total FROM public.visitors WHERE telegram_id IS NOT NULL;
  ELSE
    v_total := COALESCE(array_length(p_target_ids, 1), 0);
  END IF;

  INSERT INTO public.telegram_broadcasts (
    admin_telegram_id, target_type, target_ids, message, parse_mode,
    inline_button_text, inline_button_url, total, status
  ) VALUES (
    p_admin_id, COALESCE(p_target_type,'all'), COALESCE(p_target_ids,'{}'::bigint[]),
    COALESCE(p_message,''), COALESCE(p_parse_mode,'HTML'),
    COALESCE(p_inline_button_text,''), COALESCE(p_inline_button_url,''),
    v_total, 'pending'
  )
  RETURNING id INTO v_id;

  BEGIN PERFORM _manager_log(p_admin_id, 'broadcast_create',
        jsonb_build_object('id', v_id, 'target_type', p_target_type, 'total', v_total));
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.manager_list_broadcasts(p_admin_id bigint, p_limit integer DEFAULT 50)
RETURNS SETOF public.telegram_broadcasts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_manager_admin(p_admin_id) THEN RAISE EXCEPTION 'not_admin'; END IF;
  RETURN QUERY SELECT * FROM public.telegram_broadcasts ORDER BY created_at DESC LIMIT GREATEST(1, p_limit);
END;
$$;

CREATE OR REPLACE FUNCTION public.manager_get_broadcast_recipients(p_admin_id bigint, p_id uuid)
RETURNS TABLE (telegram_id bigint, first_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_target_type text;
  v_target_ids  bigint[];
BEGIN
  IF NOT public.is_manager_admin(p_admin_id) THEN RAISE EXCEPTION 'not_admin'; END IF;
  SELECT b.target_type, b.target_ids INTO v_target_type, v_target_ids
  FROM public.telegram_broadcasts b WHERE b.id = p_id;

  IF v_target_type = 'all' THEN
    RETURN QUERY
      SELECT v.telegram_id, COALESCE(v.first_name, '') FROM public.visitors v WHERE v.telegram_id IS NOT NULL;
  ELSE
    RETURN QUERY
      SELECT t::bigint, COALESCE(v.first_name, '')
      FROM unnest(COALESCE(v_target_ids,'{}'::bigint[])) AS t
      LEFT JOIN public.visitors v ON v.telegram_id = t;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.manager_update_broadcast_status(
  p_admin_id bigint, p_id uuid, p_status text,
  p_sent integer, p_failed integer, p_error text DEFAULT ''
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_prev text;
BEGIN
  IF NOT public.is_manager_admin(p_admin_id) THEN RAISE EXCEPTION 'not_admin'; END IF;
  SELECT status INTO v_prev FROM public.telegram_broadcasts WHERE id = p_id;
  UPDATE public.telegram_broadcasts
  SET status      = COALESCE(p_status, status),
      sent        = COALESCE(p_sent, sent),
      failed      = COALESCE(p_failed, failed),
      error_text  = COALESCE(p_error, error_text),
      started_at  = CASE WHEN v_prev = 'pending' AND p_status IN ('sending','done','failed')
                         THEN now() ELSE started_at END,
      finished_at = CASE WHEN p_status IN ('done','failed') THEN now() ELSE finished_at END
  WHERE id = p_id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_app_notifications(bigint) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dismiss_app_notification(bigint, uuid) TO anon, authenticated;
