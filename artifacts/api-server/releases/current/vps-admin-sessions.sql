-- One-time, additive separation of administrator sessions. Never re-import
-- logged-out legacy sessions on subsequent releases; never touch finance data.
DO $migration$
BEGIN
  IF to_regclass('public.admin_sessions') IS NULL THEN
    CREATE TABLE public.admin_sessions (
      sid varchar NOT NULL PRIMARY KEY,
      sess json NOT NULL,
      expire timestamp(6) NOT NULL
    );
    CREATE INDEX admin_sessions_expire_idx ON public.admin_sessions (expire);
    INSERT INTO public.admin_sessions (sid, sess, expire)
      SELECT sid, json_build_object(
        'cookie', sess->'cookie',
        'adminId', sess->'adminId',
        'adminRole', sess->'adminRole'
      ), expire
      FROM public.user_sessions
      WHERE expire > now() AND sess->>'adminRole' = 'admin'
        AND sess->>'adminId' IS NOT NULL
        -- Conflicting identities require fresh administrator authentication,
        -- rather than preserving a member's accidentally shared credential.
        AND (sess->>'userId' IS NULL OR sess->>'userId' = sess->>'adminId');
  END IF;
END
$migration$;
