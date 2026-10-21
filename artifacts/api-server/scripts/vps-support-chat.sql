-- Additive customer support storage; existing trade chats and finance are untouched.
CREATE TABLE IF NOT EXISTS public.support_conversations (
  user_id integer PRIMARY KEY REFERENCES public.users(id),
  member_read_id integer NOT NULL DEFAULT 0,
  admin_read_id integer NOT NULL DEFAULT 0,
  last_message_id integer NOT NULL DEFAULT 0,
  last_message_preview text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.support_messages (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES public.support_conversations(user_id),
  sender text NOT NULL CHECK (sender IN ('member','admin')),
  sender_id integer NOT NULL REFERENCES public.users(id),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  client_id text NOT NULL CHECK (length(client_id) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,sender,client_id)
);
CREATE INDEX IF NOT EXISTS support_messages_owner_id_idx ON public.support_messages(user_id,id);
CREATE INDEX IF NOT EXISTS support_conversations_latest_idx ON public.support_conversations(last_message_id DESC);
